import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, inArray, desc, ilike } from 'drizzle-orm';
import { db } from '../db';
import { campaigns } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const campaignsRouter = new Hono<AppEnv>();

campaignsRouter.use('*', requireAuth, requireTenant);

// GET /campaigns - List campaigns with vertical filtering (Fixes BUG-10!)
campaignsRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const query = c.req.query();

  const channel = query['channel'];
  const status = query['status'];
  const name = query['name'];
  const verticalIdsParam = query['vertical_ids'];

  const conditions = [eq(campaigns.tenantId, scope.tenant_id)];

  let allowedVerticals = scope.vertical_ids;
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
  if (status) conditions.push(eq(campaigns.status, status));
  if (name) conditions.push(ilike(campaigns.name, `%${name}%`));

  const results = await db.query.campaigns.findMany({
    where: and(...conditions),
    orderBy: [desc(campaigns.createdAt)],
    with: {
      vertical: { columns: { id: true, name: true } },
      pipeline: { columns: { id: true, name: true } },
    },
  });

  return c.json(results);
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
