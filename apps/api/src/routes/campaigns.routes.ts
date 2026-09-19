import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, inArray, desc, ilike, isNull } from 'drizzle-orm';
import { db } from '../db';
import { campaigns, leads } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const campaignsRouter = new Hono<AppEnv>();

campaignsRouter.use('*', requireAuth, requireTenant);

// GET /campaigns - List campaigns with multi-level filtering and lead counts
campaignsRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const query = c.req.query();

  const channel = query['channel'];
  const status = query['status'];
  const name = query['name'];
  const branchParam = query['branch_ids'] || query['branch_id'];
  const verticalId = query['vertical_id'];
  const pipelineId = query['pipeline_id'];
  const verticalIdsParam = query['vertical_ids'];
  const includeInactive = query['include_inactive'] === 'true';

  const conditions = [eq(campaigns.tenantId, scope.tenant_id)];

  if (branchParam) {
    const branchIds = branchParam.split(',').filter(Boolean);
    if (branchIds.length > 0) {
      conditions.push(inArray(campaigns.branchId, branchIds));
    }
  }
  if (verticalId) conditions.push(eq(campaigns.verticalId, verticalId));
  if (pipelineId) conditions.push(eq(campaigns.pipelineId, pipelineId));

  const isAdmin = ['admin', 'tenant_admin', 'super_admin', 'platform_admin', 'owner'].includes(scope.role);
  let allowedVerticals = isAdmin ? [] : scope.vertical_ids;
  if (verticalIdsParam) {
    const requested = verticalIdsParam.split(',').filter(Boolean);
    allowedVerticals = allowedVerticals.length
      ? requested.filter((id) => allowedVerticals.includes(id))
      : requested;
  }
  if (allowedVerticals.length > 0) {
    conditions.push(inArray(campaigns.verticalId, allowedVerticals));
  }

  if (channel) conditions.push(eq(campaigns.channel, channel));
  if (status) {
    conditions.push(eq(campaigns.status, status));
  }
  if (name) conditions.push(ilike(campaigns.name, `%${name}%`));

  const [rawCampaigns, tenantLeads] = await Promise.all([
    db.query.campaigns.findMany({
      where: and(...conditions),
      orderBy: [desc(campaigns.createdAt)],
      with: {
        branch: { columns: { id: true, name: true } },
        vertical: { columns: { id: true, name: true } },
        pipeline: { columns: { id: true, name: true } },
      },
    }),
    db.query.leads.findMany({
      where: and(eq(leads.tenantId, scope.tenant_id), isNull(leads.deletedAt)),
      columns: { id: true, campaignId: true, status: true, stage: true, attributes: true, assignedToId: true },
    }),
  ]);

  const assignedTo = query['assigned_to'];

  const results = rawCampaigns
    .filter((camp) => {
      if (!includeInactive && !status && camp.status === 'inactive') return false;
      if (assignedTo) {
        const cLeads = tenantLeads.filter((l) => l.campaignId === camp.id);
        const hasAgent = cLeads.some((l) => l.assignedToId === assignedTo) ||
          (Array.isArray((camp.attributes as any)?.agent_ids) && (camp.attributes as any).agent_ids.includes(assignedTo));
        if (!hasAgent) return false;
      }
      return true;
    })
    .map((camp) => {
      const cLeads = tenantLeads.filter((l) => l.campaignId === camp.id);
      const leadsCount = cLeads.length;
      const wonLeads = cLeads.filter((l) => l.status === 'converted' || l.stage === 'won' || l.stage === 'closed_won');
      const wonCount = wonLeads.length;
      const revenue = wonLeads.reduce((acc, l) => {
        const attr = (l.attributes as any) || {};
        return acc + (Number(attr.deal_value || attr.amount || attr.value) || 0);
      }, 0);
      const spend = Number((camp.attributes as any)?.spend) || 0;
      const cpl = leadsCount > 0 && spend > 0 ? Math.round(spend / leadsCount) : null;

      return {
        ...camp,
        leads_count: leadsCount,
        won_count: wonCount,
        revenue,
        cpl,
      };
    });

  return c.json(results);
});

// GET /campaigns/stats - Aggregate stats summary across campaigns matching the 8 operational KPIs
campaignsRouter.get('/stats', async (c) => {
  const scope = c.get('scope');
  const query = c.req.query();
  const branchParam = query['branch_ids'] || query['branch_id'];
  const verticalId = query['vertical_id'];
  const pipelineId = query['pipeline_id'];
  const verticalIdsParam = query['vertical_ids'];

  const conditions = [eq(campaigns.tenantId, scope.tenant_id)];
  if (branchParam) {
    const branchIds = branchParam.split(',').filter(Boolean);
    if (branchIds.length > 0) {
      conditions.push(inArray(campaigns.branchId, branchIds));
    }
  }
  if (verticalId) conditions.push(eq(campaigns.verticalId, verticalId));
  if (pipelineId) conditions.push(eq(campaigns.pipelineId, pipelineId));

  const isAdmin = ['admin', 'tenant_admin', 'super_admin', 'platform_admin', 'owner'].includes(scope.role);
  let allowedVerticals = isAdmin ? [] : scope.vertical_ids;
  if (verticalIdsParam) {
    const requested = verticalIdsParam.split(',').filter(Boolean);
    allowedVerticals = allowedVerticals.length
      ? requested.filter((id) => allowedVerticals.includes(id))
      : requested;
  }
  if (allowedVerticals.length > 0) {
    conditions.push(inArray(campaigns.verticalId, allowedVerticals));
  }

  const [allCampaigns, tenantLeads] = await Promise.all([
    db.query.campaigns.findMany({
      where: and(...conditions),
      orderBy: [desc(campaigns.createdAt)],
    }),
    db.query.leads.findMany({
      where: and(eq(leads.tenantId, scope.tenant_id), isNull(leads.deletedAt)),
      columns: { id: true, campaignId: true, status: true, stage: true, attributes: true, createdAt: true },
    }),
  ]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const activeCampaignsCount = allCampaigns.filter((c) => c.status === 'active').length;

  const campaignIds = new Set(allCampaigns.map((c) => c.id));
  const relevantLeads = tenantLeads.filter((l) => l.campaignId && campaignIds.has(l.campaignId));

  const totalLeads = relevantLeads.length;
  const leadsMtd = relevantLeads.filter((l) => new Date(l.createdAt) >= startOfMonth).length;

  const wonLeads = relevantLeads.filter(
    (l) => l.status === 'converted' || l.stage === 'won' || l.stage === 'closed_won'
  );
  const lostLeads = relevantLeads.filter(
    (l) => l.status === 'lost' || l.stage === 'lost' || l.stage === 'closed_lost' || l.stage === 'disqualified'
  );

  const wonCount = wonLeads.length;
  const lostCount = lostLeads.length;
  const closedCount = wonCount + lostCount;
  const activeLeadsCount = Math.max(0, totalLeads - closedCount);

  const totalRevenue = wonLeads.reduce((acc, l) => {
    const attr = (l.attributes as any) || {};
    return acc + (Number(attr.deal_value || attr.amount || attr.value) || 0);
  }, 0);

  const campaignStatsList = allCampaigns.map((camp) => {
    const cLeads = tenantLeads.filter((l) => l.campaignId === camp.id);
    const total = cLeads.length;
    const cWon = cLeads.filter((l) => l.status === 'converted' || l.stage === 'won' || l.stage === 'closed_won').length;
    const cLost = cLeads.filter((l) => l.status === 'lost' || l.stage === 'lost' || l.stage === 'closed_lost').length;
    const untouched = cLeads.filter((l) => l.status === 'new').length;
    const rate = total > 0 ? Math.round((cWon / total) * 100) : 0;
    const spend = Number((camp.attributes as any)?.spend) || 0;
    const cpl = total > 0 && spend > 0 ? Math.round(spend / total) : null;

    return {
      id: camp.id,
      name: camp.name,
      channel: camp.channel,
      status: camp.status,
      total_leads: total,
      converted: cWon,
      lost: cLost,
      conversion_rate: rate,
      spend,
      cpl,
      untouched_leads: untouched,
    };
  });

  return c.json({
    active_campaigns: activeCampaignsCount,
    total_leads: totalLeads,
    leads_mtd: leadsMtd,
    won: wonCount,
    lost: lostCount,
    revenue: totalRevenue,
    active_leads: activeLeadsCount,
    closed: closedCount,
    campaigns: campaignStatsList,
    total_converted: wonCount,
    overall_conversion_rate: totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0,
  });
});

// GET /campaigns/:id
campaignsRouter.get('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.tenantId, scope.tenant_id)),
    with: {
      vertical: true,
      pipeline: true,
    },
  });

  if (!campaign) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  return c.json(campaign);
});

// GET /campaigns/:id/leads - Attributed leads for a campaign
campaignsRouter.get('/:id/leads', async (c) => {
  const scope = c.get('scope');
  const campaignId = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

  const matchedLeads = await db.query.leads.findMany({
    where: and(
      eq(leads.tenantId, scope.tenant_id),
      eq(leads.campaignId, campaignId),
      isNull(leads.deletedAt)
    ),
    orderBy: [desc(leads.createdAt)],
    limit,
    with: {
      assignedTo: { columns: { id: true, name: true, email: true } },
      party: { columns: { id: true, name: true, email: true, phoneRaw: true } },
    },
  });

  return c.json({ data: matchedLeads });
});

// POST /campaigns
const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  branch_id: z.string().min(1, 'Branch is required'),
  vertical_id: z.string().min(1, 'Vertical is required'),
  pipeline_id: z.string().min(1, 'Pipeline is required'),
  channel: z.string().default('meta_ad'),
  status: z.string().default('active'),
  start_date: z.string().default(() => new Date().toISOString()),
  end_date: z.string().optional().nullable(),
  target_leads: z.number().optional().nullable(),
  utm_source: z.string().optional().nullable(),
  utm_medium: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
  attributes: z.record(z.string(), z.any()).optional().default({}),
});

campaignsRouter.post('/', validateJson(createCampaignSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof createCampaignSchema>;

  const [created] = await db
    .insert(campaigns)
    .values({
      tenantId: scope.tenant_id,
      branchId: body.branch_id,
      verticalId: body.vertical_id,
      pipelineId: body.pipeline_id,
      name: body.name,
      channel: body.channel,
      status: body.status,
      startDate: new Date(body.start_date),
      endDate: body.end_date ? new Date(body.end_date) : null,
      targetLeads: body.target_leads,
      utmSource: body.utm_source,
      utmMedium: body.utm_medium,
      utmCampaign: body.utm_campaign,
      attributes: body.attributes || {},
      createdBy: scope.user_id,
    })
    .returning();

  return c.json(created, 201);
});

// PATCH /campaigns/:id
campaignsRouter.patch('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const updateData: Record<string, any> = {};
  if (body.name !== undefined) updateData['name'] = body.name;
  if (body.status !== undefined) updateData['status'] = body.status;
  if (body.channel !== undefined) updateData['channel'] = body.channel;
  if (body.target_leads !== undefined) updateData['targetLeads'] = body.target_leads;
  if (body.utm_campaign !== undefined) updateData['utmCampaign'] = body.utm_campaign;
  if (body.attributes !== undefined) updateData['attributes'] = body.attributes;

  const [updated] = await db
    .update(campaigns)
    .set(updateData)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  return c.json(updated);
});

// PATCH /campaigns/:id/status
campaignsRouter.patch('/:id/status', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  if (!body.status) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Status is required' }, 400);
  }

  const [updated] = await db
    .update(campaigns)
    .set({ status: body.status })
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  return c.json(updated);
});

// DELETE /campaigns/:id
campaignsRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [deleted] = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, scope.tenant_id)))
    .returning();

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  return c.json({ success: true });
});
