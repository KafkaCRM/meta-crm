import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, or, inArray, desc, lt, isNull, ilike, sql, count, gte, lte, asc } from 'drizzle-orm';
import { db } from '../db';
import { leads, leadEvents, parties, pipelineDefinitions, pipelineStages, users, tenants, branches, verticals, campaigns } from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const leadsRouter = new Hono<AppEnv>();

// Public lead submission webhook (e.g. website forms, landing pages)
const publicLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(1, 'Phone is required'),
  source: z.string().default('website_webhook'),
  tenant_slug: z.string().min(1, 'Workspace slug is required'),
  vertical_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attributes: z.record(z.string(), z.any()).optional().default({}),
});

leadsRouter.post('/public', validateJson(publicLeadSchema), async (c) => {
  const data = c.get('validatedJson' as any) as z.infer<typeof publicLeadSchema>;

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, data.tenant_slug),
  });

  if (!tenant || tenant.status !== 'active') {
    return c.json({ code: 'TENANT_NOT_FOUND', message: 'Target workspace not found or inactive' }, 404);
  }

  let targetTenantId = tenant.id;
  let routedFranchisee = null;

  // Automated Franchise Lead Routing if current tenant is a Franchisor
  if (tenant.tenantType === 'franchisor') {
    const childFranchisees = await db.query.tenants.findMany({
      where: and(eq(tenants.parentTenantId, tenant.id), eq(tenants.status, 'active')),
    });

    if (childFranchisees.length > 0) {
      const attrs = (data.attributes as Record<string, any>) || {};
      const postal = String(attrs['postal_code'] || attrs['zip'] || attrs['zip_code'] || '').trim().toLowerCase();
      const city = String(attrs['city'] || '').trim().toLowerCase();

      const matched = childFranchisees.find((f) => {
        const codes = (f.territoryCodes as string[]) || [];
        return codes.some((code) => {
          const cLower = String(code).trim().toLowerCase();
          return (postal && cLower === postal) || (city && cLower === city);
        });
      });

      if (matched) {
        targetTenantId = matched.id;
        routedFranchisee = matched;
      }
    }
  }

  const [created] = await db
    .insert(leads)
    .values({
      tenantId: targetTenantId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: data.source as any,
      status: 'new',
      verticalId: data.vertical_id || null,
      notes: data.notes,
      attributes: data.attributes || {},
    })
    .returning();

  if (created) {
    await db.insert(leadEvents).values({
      leadId: created.id,
      tenantId: targetTenantId,
      eventType: 'lead_created',
      actorId: 'public_api',
      metadata: {
        source: data.source,
        ...(routedFranchisee
          ? {
              routed_from_franchisor: tenant.name,
              routed_from_franchisor_id: tenant.id,
              franchisee_name: routedFranchisee.name,
            }
          : {}),
      },
    });
  }

  return c.json({
    success: true,
    lead_id: created?.id,
    routed_to_franchise: routedFranchisee ? routedFranchisee.name : null,
  }, 201);
});

// All routes below require tenant authentication
leadsRouter.use('*', requireAuth, requireTenant);

// GET /leads - List leads with cursor pagination and vertical filtering
leadsRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const query = c.req.query();

  const limit = Math.min(Number(query['limit']) || 50, 100);
  const offset = Number(query['offset']) || 0;
  const cursor = query['cursor'];
  const status = query['status'];
  const source = query['source'];
  const name = query['name'];
  const assignedToId = query['assigned_to_id'];
  const pipelineDefId = query['pipeline_id'] || query['pipeline_definition_id'];
  const stage = query['stage'];
  const verticalIdsParam = query['vertical_ids'];
  const branchParam = query['branch_ids'] || query['branch_id'];
  const verticalId = query['vertical_id'];
  const campaignId = query['campaign_id'];
  const course = query['course'];
  const disposition = query['last_call_disposition'];
  const segment = query['segment'];
  const slaBreached = query['sla_breached'];
  const isDuplicate = query['is_duplicate'] || query['duplicates'];
  const redFlagged = query['red_flagged'];
  const dateFrom = query['date_from'];
  const dateTo = query['date_to'];
  const followUp = query['follow_up'];
  const search = query['search'] || query['q'];
  const sort = query['sort'] || 'newest';

  const conditions = [
    eq(leads.tenantId, scope.tenant_id),
    isNull(leads.deletedAt),
  ];

  // Vertical scoping: combine token vertical scope with query parameter filter
  const isAdmin = ['admin', 'tenant_admin', 'super_admin', 'platform_admin', 'owner'].includes(scope.role);
  let allowedVerticals = isAdmin ? [] : scope.vertical_ids;
  if (verticalIdsParam) {
    const requested = verticalIdsParam.split(',').filter(Boolean);
    allowedVerticals = allowedVerticals.length
      ? requested.filter((id) => allowedVerticals.includes(id))
      : requested;
  }
  if (allowedVerticals.length > 0) {
    conditions.push(inArray(leads.verticalId, allowedVerticals));
  }

  // Branch filter (via verticals belonging to the branch(es))
  if (branchParam) {
    const branchIds = branchParam.split(',').filter(Boolean);
    if (branchIds.length > 0) {
      const branchVerticals = await db.query.verticals.findMany({
        where: and(eq(verticals.tenantId, scope.tenant_id), inArray(verticals.branchId, branchIds)),
        columns: { id: true },
      });
      const ids = branchVerticals.map((v) => v.id);
      if (ids.length > 0) {
        conditions.push(inArray(leads.verticalId, ids));
      } else {
        conditions.push(eq(leads.id, '__NO_MATCH__'));
      }
    }
  }

  // Vertical filter
  if (verticalId) {
    conditions.push(eq(leads.verticalId, verticalId));
  }

  // Pipeline filter
  if (pipelineDefId) {
    conditions.push(eq(leads.pipelineDefinitionId, pipelineDefId));
  }

  // Campaign filter
  if (campaignId) {
    if (campaignId === 'none' || campaignId === 'unassigned') {
      conditions.push(isNull(leads.campaignId));
    } else {
      conditions.push(eq(leads.campaignId, campaignId));
    }
  }

  if (status) conditions.push(eq(leads.status, status as any));
  if (source) conditions.push(eq(leads.source, source as any));
  if (stage) conditions.push(eq(leads.stage, stage));

  if (assignedToId) {
    if (assignedToId === 'unassigned' || assignedToId === 'null') {
      conditions.push(isNull(leads.assignedToId));
    } else {
      conditions.push(eq(leads.assignedToId, assignedToId));
    }
  }

  // Search by name, phone, email, course
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(leads.name, term),
        ilike(leads.phone, term),
        ilike(leads.email, term),
        sql`(${leads.attributes}->>'course') ILIKE ${term}`
      )!
    );
  } else if (name) {
    conditions.push(ilike(leads.name, `%${name}%`));
  }

  const phone = query['phone'];
  if (phone) conditions.push(ilike(leads.phone, `%${phone}%`));
  const email = query['email'];
  if (email) conditions.push(ilike(leads.email, `%${email}%`));

  // Course filter
  if (course) {
    conditions.push(sql`(${leads.attributes}->>'course') = ${course}`);
  }

  // Last Call Disposition
  if (disposition) {
    conditions.push(sql`(${leads.attributes}->>'last_call_disposition') = ${disposition}`);
  }

  // Segment: All, Hot, Warm, Cold
  if (segment && segment !== 'all') {
    if (segment === 'hot') {
      conditions.push(or(
        eq(leads.status, 'hot' as any),
        sql`(${leads.attributes}->>'priority') = 'hot'`,
        sql`(${leads.attributes}->>'score_label') ILIKE 'hot%'`
      )!);
    } else if (segment === 'warm') {
      conditions.push(or(
        eq(leads.status, 'warm' as any),
        sql`(${leads.attributes}->>'priority') = 'warm'`,
        sql`(${leads.attributes}->>'score_label') ILIKE 'warm%'`
      )!);
    } else if (segment === 'cold') {
      conditions.push(or(
        eq(leads.status, 'cold' as any),
        sql`(${leads.attributes}->>'priority') = 'cold'`,
        sql`(${leads.attributes}->>'score_label') ILIKE 'cold%'`
      )!);
    }
  }

  // Quick toggles: SLA breached, Duplicates, Red flagged
  if (slaBreached === 'true') {
    conditions.push(sql`(${leads.attributes}->>'sla_breached') = 'true'`);
  }
  if (isDuplicate === 'true') {
    conditions.push(sql`(${leads.attributes}->>'is_duplicate') = 'true'`);
  }
  if (redFlagged === 'true') {
    conditions.push(sql`(${leads.attributes}->>'red_flagged') = 'true'`);
  }

  // Date range
  if (dateFrom) {
    conditions.push(gte(leads.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(leads.createdAt, toDate));
  }

  // Follow-up filter
  if (followUp && followUp !== 'all') {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (followUp === 'today') {
      conditions.push(and(
        gte(sql`(${leads.attributes}->>'next_follow_up_date')::timestamp`, startOfToday),
        lte(sql`(${leads.attributes}->>'next_follow_up_date')::timestamp`, endOfToday)
      )!);
    } else if (followUp === 'overdue') {
      conditions.push(lt(sql`(${leads.attributes}->>'next_follow_up_date')::timestamp`, now));
    }
  }

  if (cursor) {
    const cursorLead = await db.query.leads.findFirst({
      where: eq(leads.id, cursor),
      columns: { createdAt: true },
    });
    if (cursorLead) {
      conditions.push(lt(leads.createdAt, cursorLead.createdAt));
    }
  }

  // Sorting
  let orderByClause = [desc(leads.createdAt)];
  if (sort === 'oldest') {
    orderByClause = [asc(leads.createdAt)];
  } else if (sort === 'name_asc') {
    orderByClause = [asc(leads.name)];
  } else if (sort === 'name_desc') {
    orderByClause = [desc(leads.name)];
  }

  const [totalCountResult, rawResults] = await Promise.all([
    db.select({ count: count() }).from(leads).where(and(...conditions)),
    db.query.leads.findMany({
      where: and(...conditions),
      limit: limit + 1,
      offset: offset > 0 ? offset : undefined,
      orderBy: orderByClause,
      with: {
        assignedTo: {
          columns: { id: true, name: true, email: true },
        },
        party: {
          columns: { id: true, name: true, email: true, phoneRaw: true, source: true },
        },
        vertical: {
          columns: { id: true, name: true, branchId: true },
          with: {
            branch: { columns: { id: true, name: true } },
          },
        },
        pipelineDefinition: {
          columns: { id: true, name: true },
          with: {
            stages: {
              columns: { id: true, name: true, order: true },
              orderBy: (stages, { asc }) => [asc(stages.order)],
            },
          },
        },
        campaign: {
          columns: { id: true, name: true, channel: true, status: true, branchId: true },
          with: {
            branch: { columns: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const hasMore = rawResults.length > limit;
  const data = hasMore ? rawResults.slice(0, limit) : rawResults;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
  const totalCount = Number(totalCountResult[0]?.count) || data.length;

  return c.json({
    data,
    next_cursor: nextCursor,
    total_count: totalCount,
  });
});

// GET /leads/by-stage - Group leads by stage for Kanban pipeline board
leadsRouter.get('/by-stage', async (c) => {
  const scope = c.get('scope');
  const pipelineDefId = c.req.query('pipeline_definition_id');

  if (!pipelineDefId) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'pipeline_definition_id query param is required' }, 400);
  }

  const pipeline = await db.query.pipelineDefinitions.findFirst({
    where: and(
      eq(pipelineDefinitions.id, pipelineDefId),
      eq(pipelineDefinitions.tenantId, scope.tenant_id)
    ),
    with: {
      stages: {
        orderBy: (stages, { asc }) => [asc(stages.order)],
      },
    },
  });

  if (!pipeline) {
    return c.json({ code: 'NOT_FOUND', message: 'Pipeline not found' }, 404);
  }

  const stageIds = pipeline.stages.map((s) => s.id);

  const stageLeads = stageIds.length > 0
    ? await db.query.leads.findMany({
        where: and(
          eq(leads.tenantId, scope.tenant_id),
          eq(leads.pipelineDefinitionId, pipelineDefId),
          inArray(leads.stage, stageIds),
          isNull(leads.deletedAt)
        ),
        orderBy: [desc(leads.createdAt)],
        with: {
          assignedTo: { columns: { id: true, name: true, email: true } },
          party: { columns: { id: true, name: true, email: true } },
          campaign: { columns: { id: true, name: true, channel: true, status: true } },
        },
      })
    : [];

  const grouped: Record<string, any[]> = {};
  for (const s of pipeline.stages) {
    grouped[s.id] = [];
  }
  for (const lead of stageLeads) {
    if (lead.stage && grouped[lead.stage]) {
      grouped[lead.stage]!.push(lead);
    }
  }

  return c.json({
    stages: pipeline.stages,
    leads: grouped,
  });
});

// GET /leads/check-duplicate - Fast live duplicate lookup for phone & email
leadsRouter.get('/check-duplicate', async (c) => {
  const scope = c.get('scope');
  const phone = c.req.query('phone');
  const email = c.req.query('email');

  if (!phone && !email) {
    return c.json({ is_duplicate: false, existing_lead: null });
  }

  const conditions = [
    eq(leads.tenantId, scope.tenant_id),
    isNull(leads.deletedAt),
  ];

  const orConditions = [];
  if (phone && phone.trim().length >= 7) {
    const cleanPhone = phone.replace(/\D/g, '');
    orConditions.push(ilike(leads.phone, `%${cleanPhone.slice(-10)}%`));
  }
  if (email && email.trim().length > 3) {
    orConditions.push(eq(leads.email, email.trim().toLowerCase()));
  }

  if (orConditions.length === 0) {
    return c.json({ is_duplicate: false, existing_lead: null });
  }

  conditions.push(or(...orConditions)!);

  const existing = await db.query.leads.findFirst({
    where: and(...conditions),
    with: {
      assignedTo: { columns: { id: true, name: true, email: true } },
      campaign: { columns: { id: true, name: true } },
    },
  });

  if (existing) {
    return c.json({
      is_duplicate: true,
      existing_lead: {
        id: existing.id,
        name: existing.name,
        phone: existing.phone,
        email: existing.email,
        status: existing.status,
        created_at: existing.createdAt,
        assigned_to: existing.assignedTo,
        campaign: existing.campaign,
      },
    });
  }

  return c.json({ is_duplicate: false, existing_lead: null });
});

// GET /leads/:id - Get single lead
leadsRouter.get('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const lead = await db.query.leads.findFirst({
    where: and(
      eq(leads.id, id),
      eq(leads.tenantId, scope.tenant_id),
      isNull(leads.deletedAt)
    ),
    with: {
      assignedTo: { columns: { id: true, name: true, email: true } },
      party: { columns: { id: true, name: true, email: true, phoneRaw: true, source: true } },
      campaign: { with: { branch: true } },
      vertical: { with: { branch: true } },
      pipelineDefinition: {
        with: {
          stages: { orderBy: (stages, { asc }) => [asc(stages.order)] },
        },
      },
      events: {
        orderBy: [desc(leadEvents.occurredAt)],
        limit: 50,
      },
    },
  });

  if (!lead) {
    return c.json({ code: 'NOT_FOUND', message: 'Lead not found' }, 404);
  }

  return c.json(lead);
});

// POST /leads - Create new lead
const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required'),
  alternate_phone: z.string().optional().nullable(),
  whatsapp_number: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  branch_id: z.string().optional().nullable(),
  vertical_id: z.string().optional().nullable(),
  pipeline_definition_id: z.string().optional().nullable(),
  campaign_id: z.string().optional().nullable(),
  source: z.string().default('manual'),
  course: z.string().optional().nullable(),
  training_mode: z.string().optional().nullable(),
  course_fee: z.union([z.string(), z.number()]).optional().nullable(),
  city: z.string().optional().nullable(),
  assigned_to_id: z.string().optional().nullable(),
  assign_round_robin: z.boolean().optional().default(false),
  status: z.string().default('new'),
  stage: z.string().optional().nullable(),
  next_follow_up_date: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  parents_number: z.string().optional().nullable(),
  last_call_disposition: z.string().optional().nullable(),
  score: z.union([z.string(), z.number()]).optional().nullable(),
  attributes: z.record(z.string(), z.any()).optional().default({}),
});

leadsRouter.post('/', validateJson(createLeadSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof createLeadSchema>;

  let branchId = body.branch_id || null;
  let verticalId = body.vertical_id?.trim() || null;
  let pipelineDefinitionId = body.pipeline_definition_id?.trim() || null;
  let campaignId = body.campaign_id?.trim() || null;

  // If campaign_id provided, cascade branch, vertical, pipeline if not explicitly set
  if (campaignId) {
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, scope.tenant_id)),
    });
    if (campaign) {
      if (!branchId) branchId = campaign.branchId;
      if (!verticalId) verticalId = campaign.verticalId;
      if (!pipelineDefinitionId) pipelineDefinitionId = campaign.pipelineId;
    }
  }

  // If vertical not set, but branch is set, pick first vertical in this branch
  if (!verticalId && branchId) {
    const branchVert = await db.query.verticals.findFirst({
      where: and(eq(verticals.tenantId, scope.tenant_id), eq(verticals.branchId, branchId)),
    });
    if (branchVert) {
      verticalId = branchVert.id;
    }
  }

  // Fallback vertical to admin's vertical if available
  if (!verticalId && scope.vertical_ids && scope.vertical_ids.length > 0) {
    verticalId = scope.vertical_ids[0] || null;
  }

  // If pipeline not set, but vertical is known, look up first pipeline for that vertical
  if (!pipelineDefinitionId && verticalId) {
    const vertPipeline = await db.query.pipelineDefinitions.findFirst({
      where: and(eq(pipelineDefinitions.tenantId, scope.tenant_id), eq(pipelineDefinitions.verticalId, verticalId)),
    });
    if (vertPipeline) {
      pipelineDefinitionId = vertPipeline.id;
    }
  }

  // Resolve initial stage if pipeline is set and stage not specified
  let stage = body.stage || null;
  if (pipelineDefinitionId && !stage) {
    const firstStage = await db.query.pipelineStages.findFirst({
      where: eq(pipelineStages.pipelineDefinitionId, pipelineDefinitionId),
      orderBy: [asc(pipelineStages.order)],
    });
    if (firstStage) {
      stage = firstStage.id;
    }
  }

  // Resolve assigned user (explicit vs round-robin)
  let assignedToId = body.assigned_to_id || null;
  if (body.assign_round_robin || !assignedToId) {
    if (body.assign_round_robin) {
      const activeUsers = await db.query.users.findMany({
        where: and(eq(users.tenantId, scope.tenant_id), eq(users.status, 'active')),
        columns: { id: true },
      });
      if (activeUsers.length > 0 && activeUsers[0]) {
        const counts = await db
          .select({ uid: leads.assignedToId, cnt: count() })
          .from(leads)
          .where(and(eq(leads.tenantId, scope.tenant_id), inArray(leads.assignedToId, activeUsers.map((u) => u.id))))
          .groupBy(leads.assignedToId);
        const countMap = new Map(counts.map((c) => [c.uid, Number(c.cnt)]));
        activeUsers.sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0));
        assignedToId = activeUsers[0].id;
      }
    }
  }

  // Fast duplicate check
  const cleanPhone = body.phone.replace(/\D/g, '');
  let isDuplicate = false;
  let dupLeadId: string | null = null;
  if (cleanPhone.length >= 7) {
    const existingLead = await db.query.leads.findFirst({
      where: and(
        eq(leads.tenantId, scope.tenant_id),
        isNull(leads.deletedAt),
        ilike(leads.phone, `%${cleanPhone.slice(-10)}%`)
      ),
      columns: { id: true },
    });
    if (existingLead) {
      isDuplicate = true;
      dupLeadId = existingLead.id;
    }
  }

  // Prepare custom attributes
  const scoreNum = body.score !== undefined && body.score !== null ? Number(body.score) : (body.status === 'hot' ? 85 : body.status === 'warm' ? 60 : 38);
  const scoreLabel = scoreNum >= 75 ? `Hot ${scoreNum}` : scoreNum >= 50 ? `Warm ${scoreNum}` : `Cold ${scoreNum}`;

  const attributes: Record<string, any> = {
    ...(body.attributes || {}),
    branch_id: branchId,
    alternate_phone: body.alternate_phone || null,
    whatsapp_number: body.whatsapp_number || body.phone,
    dob: body.dob || null,
    course: body.course || null,
    training_mode: body.training_mode || null,
    course_fee: body.course_fee || null,
    city: body.city || null,
    parents_number: body.parents_number || null,
    next_follow_up_date: body.next_follow_up_date || null,
    last_call_disposition: body.last_call_disposition || 'New Lead',
    score: scoreNum,
    score_label: scoreLabel,
    sla_breached: false,
    is_duplicate: isDuplicate,
    duplicate_lead_id: dupLeadId,
  };

  // Safe enum mappings
  const validStatuses = ['new', 'contacted', 'qualified', 'proposal_sent', 'hot', 'junk', 'active', 'converted', 'lost'];
  const rawStatus = (body.status || 'new').toLowerCase();
  const status = validStatuses.includes(rawStatus) ? (rawStatus as any) : 'new';
  if (status !== rawStatus) {
    attributes.raw_status = body.status;
  }

  const validSources = ['manual', 'csv_import', 'meta_ad', 'google_ad', 'website_webhook', 'justdial', 'whatsapp', 'referral', 'api'];
  const rawSource = (body.source || 'manual').toLowerCase();
  const source = validSources.includes(rawSource) ? (rawSource as any) : 'manual';
  if (source !== rawSource) {
    attributes.raw_source = body.source;
  }

  const createdAtDate = body.created_at ? new Date(body.created_at) : new Date();

  const [created] = await db
    .insert(leads)
    .values({
      tenantId: scope.tenant_id,
      name: body.name,
      email: body.email || null,
      phone: body.phone,
      source,
      status,
      notes: body.notes || null,
      campaignId,
      assignedToId,
      verticalId,
      pipelineDefinitionId,
      stage,
      attributes,
      createdAt: isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate,
    })
    .returning();

  if (!created) {
    return c.json({ code: 'CREATION_FAILED', message: 'Failed to create lead' }, 500);
  }

  await db.insert(leadEvents).values({
    leadId: created.id,
    tenantId: scope.tenant_id,
    eventType: 'lead_created',
    actorId: scope.user_id,
    metadata: { source: body.source, campaign_id: campaignId, assigned_to_id: assignedToId },
  });

  // Return populated lead
  const fullLead = await db.query.leads.findFirst({
    where: eq(leads.id, created.id),
    with: {
      assignedTo: { columns: { id: true, name: true, email: true } },
      party: { columns: { id: true, name: true, email: true, phoneRaw: true, source: true } },
      vertical: {
        columns: { id: true, name: true, branchId: true },
        with: { branch: { columns: { id: true, name: true } } },
      },
      pipelineDefinition: { columns: { id: true, name: true } },
      campaign: {
        columns: { id: true, name: true, channel: true, status: true, branchId: true },
        with: { branch: { columns: { id: true, name: true } } },
      },
    },
  });

  return c.json(fullLead || created, 201);
});

// POST /leads/bulk-action - Batch operations (Campaign enrollment, Rep assignment, Status, Delete)
const bulkActionSchema = z.object({
  action: z.enum(['enroll_campaign', 'assign_rep', 'update_status', 'delete']),
  lead_ids: z.array(z.string()).min(1, 'At least one lead ID is required'),
  campaign_id: z.string().optional().nullable(),
  assigned_to_id: z.string().optional().nullable(),
  status: z.string().optional(),
});

leadsRouter.post('/bulk-action', validateJson(bulkActionSchema), async (c) => {
  const scope = c.get('scope');
  const b = c.get('validatedJson' as any) as z.infer<typeof bulkActionSchema>;

  const targetLeads = await db.query.leads.findMany({
    where: and(
      eq(leads.tenantId, scope.tenant_id),
      inArray(leads.id, b.lead_ids),
      isNull(leads.deletedAt)
    ),
    columns: { id: true },
  });

  const validIds = targetLeads.map((l) => l.id);
  if (validIds.length === 0) {
    return c.json({ success: true, count: 0 });
  }

  await db.transaction(async (tx) => {
    if (b.action === 'enroll_campaign') {
      await tx
        .update(leads)
        .set({ campaignId: b.campaign_id || null })
        .where(inArray(leads.id, validIds));

      for (const id of validIds) {
        await tx.insert(leadEvents).values({
          leadId: id,
          tenantId: scope.tenant_id,
          eventType: 'campaign_opted_in',
          actorId: scope.user_id,
          metadata: { campaign_id: b.campaign_id },
        });
      }
    } else if (b.action === 'assign_rep') {
      await tx
        .update(leads)
        .set({ assignedToId: b.assigned_to_id || null })
        .where(inArray(leads.id, validIds));

      for (const id of validIds) {
        await tx.insert(leadEvents).values({
          leadId: id,
          tenantId: scope.tenant_id,
          eventType: 'rep_assigned',
          actorId: scope.user_id,
          metadata: { assigned_to_id: b.assigned_to_id },
        });
      }
    } else if (b.action === 'update_status') {
      await tx
        .update(leads)
        .set({ status: (b.status as any) || 'new' })
        .where(inArray(leads.id, validIds));

      for (const id of validIds) {
        await tx.insert(leadEvents).values({
          leadId: id,
          tenantId: scope.tenant_id,
          eventType: 'status_updated',
          actorId: scope.user_id,
          metadata: { status: b.status },
        });
      }
    } else if (b.action === 'delete') {
      await tx
        .update(leads)
        .set({ deletedAt: new Date() })
        .where(inArray(leads.id, validIds));
    }
  });

  return c.json({ success: true, count: validIds.length });
});

// PATCH /leads/:id - Update lead with event tracking (Fixes BUG-07!)
leadsRouter.patch('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const existing = await db.query.leads.findFirst({
    where: and(eq(leads.id, id), eq(leads.tenantId, scope.tenant_id)),
  });

  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Lead not found' }, 404);
  }

  const updateData: Record<string, any> = {};
  const changedFields: Record<string, any> = {};

  const allowedFields = [
    'name',
    'email',
    'phone',
    'source',
    'status',
    'stage',
    'notes',
    'campaign_id',
    'assigned_to_id',
    'vertical_id',
    'pipeline_definition_id',
    'attributes',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined && field !== 'attributes') {
      const dbField =
        field === 'campaign_id'
          ? 'campaignId'
          : field === 'assigned_to_id'
          ? 'assignedToId'
          : field === 'vertical_id'
          ? 'verticalId'
          : field === 'pipeline_definition_id'
          ? 'pipelineDefinitionId'
          : field;
      updateData[dbField] = field === 'vertical_id' ? (body[field] || null) : body[field];
      changedFields[field] = body[field];
    }
  }

  const attrFields = [
    'alternate_phone',
    'whatsapp_number',
    'dob',
    'branch_id',
    'course',
    'training_mode',
    'course_fee',
    'city',
    'parents_number',
    'last_call_disposition',
    'score',
    'next_follow_up_date',
    'sla_breached',
    'is_duplicate',
    'red_flagged',
  ];

  let mergedAttrs = { ...((existing.attributes as any) || {}), ...(body.attributes || {}) };
  let attrsModified = body.attributes !== undefined;

  for (const attr of attrFields) {
    if (body[attr] !== undefined) {
      mergedAttrs[attr] = body[attr];
      attrsModified = true;
      changedFields[attr] = body[attr];
    }
  }

  if (attrsModified) {
    updateData.attributes = mergedAttrs;
  }

  const [updated] = await db
    .update(leads)
    .set(updateData)
    .where(eq(leads.id, id))
    .returning();

  // Log update audit event
  if (Object.keys(changedFields).length > 0) {
    await db.insert(leadEvents).values({
      leadId: id,
      tenantId: scope.tenant_id,
      eventType: 'lead_updated',
      actorId: scope.user_id,
      metadata: changedFields,
    });
  }

  const fullUpdated = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    with: {
      assignedTo: { columns: { id: true, name: true, email: true } },
      party: { columns: { id: true, name: true, email: true, phoneRaw: true, source: true } },
      vertical: {
        columns: { id: true, name: true, branchId: true },
        with: { branch: { columns: { id: true, name: true } } },
      },
      pipelineDefinition: { columns: { id: true, name: true } },
      campaign: {
        columns: { id: true, name: true, channel: true, status: true, branchId: true },
        with: { branch: { columns: { id: true, name: true } } },
      },
    },
  });

  return c.json(fullUpdated || updated);
});

// DELETE /leads/:id - Soft-delete lead
leadsRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const [deleted] = await db
    .update(leads)
    .set({ deletedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.tenantId, scope.tenant_id)))
    .returning();

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Lead not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /leads/:id/pipeline - Add lead to pipeline
leadsRouter.post('/:id/pipeline', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const { pipeline_definition_id } = await c.req.json().catch(() => ({}));

  if (!pipeline_definition_id) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'pipeline_definition_id is required' }, 400);
  }

  const pipeline = await db.query.pipelineDefinitions.findFirst({
    where: and(eq(pipelineDefinitions.id, pipeline_definition_id), eq(pipelineDefinitions.tenantId, scope.tenant_id)),
    with: {
      stages: { orderBy: (stages, { asc }) => [asc(stages.order)], limit: 1 },
    },
  });

  if (!pipeline || !pipeline.stages[0]) {
    return c.json({ code: 'NO_PIPELINE', message: 'Pipeline definition has no stages' }, 400);
  }

  const firstStage = pipeline.stages[0].id;

  const [updated] = await db
    .update(leads)
    .set({
      pipelineDefinitionId: pipeline_definition_id,
      stage: firstStage,
      status: 'active',
    })
    .where(and(eq(leads.id, id), eq(leads.tenantId, scope.tenant_id)))
    .returning();

  if (!updated) {
    return c.json({ code: 'NOT_FOUND', message: 'Lead not found' }, 404);
  }

  await db.insert(leadEvents).values({
    leadId: id,
    tenantId: scope.tenant_id,
    eventType: 'stage_changed',
    fromStage: null,
    toStage: firstStage,
    actorId: scope.user_id,
    metadata: { pipeline_name: pipeline.name },
  });

  return c.json(updated);
});

// POST /leads/:id/transition - Move lead to another stage
leadsRouter.post('/:id/transition', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const { to_stage_id } = await c.req.json().catch(() => ({}));

  if (!to_stage_id) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'to_stage_id is required' }, 400);
  }

  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, id), eq(leads.tenantId, scope.tenant_id)),
  });

  if (!lead) {
    return c.json({ code: 'NOT_FOUND', message: 'Lead not found' }, 404);
  }

  if (!lead.pipelineDefinitionId) {
    return c.json({ code: 'NO_PIPELINE', message: 'Lead is not assigned to a pipeline' }, 400);
  }

  const stage = await db.query.pipelineStages.findFirst({
    where: and(
      eq(pipelineStages.id, to_stage_id),
      eq(pipelineStages.pipelineDefinitionId, lead.pipelineDefinitionId)
    ),
  });

  if (!stage) {
    return c.json({ code: 'INVALID_TRANSITION', message: 'Target stage does not belong to this pipeline' }, 400);
  }

  const [updated] = await db
    .update(leads)
    .set({ stage: to_stage_id })
    .where(eq(leads.id, id))
    .returning();

  await db.insert(leadEvents).values({
    leadId: id,
    tenantId: scope.tenant_id,
    eventType: 'stage_changed',
    fromStage: lead.stage,
    toStage: to_stage_id,
    actorId: scope.user_id,
    metadata: { stage_name: stage.name },
  });

  return c.json(updated);
});

// GET /leads/:id/events - Timeline history
leadsRouter.get('/:id/events', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

  const events = await db.query.leadEvents.findMany({
    where: and(eq(leadEvents.leadId, id), eq(leadEvents.tenantId, scope.tenant_id)),
    limit,
    orderBy: [desc(leadEvents.occurredAt)],
  });

  return c.json({ data: events });
});

// POST /leads/:id/log-interaction - Log call, WhatsApp, or note with follow-up
const logInteractionSchema = z.object({
  type: z.enum(['call', 'whatsapp', 'email', 'note']),
  outcome: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  next_follow_up: z.string().optional(),
});

leadsRouter.post('/:id/log-interaction', validateJson(logInteractionSchema), async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = c.get('validatedJson' as any) as z.infer<typeof logInteractionSchema>;

  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, id), eq(leads.tenantId, scope.tenant_id)),
  });

  if (!lead) {
    return c.json({ code: 'NOT_FOUND', message: 'Lead not found' }, 404);
  }

  const updateData: Record<string, any> = {};
  if (body.status) updateData['status'] = body.status;
  if (body.notes) {
    const existing = lead.notes ? `${lead.notes}\n---\n` : '';
    const prefix = `[${body.type.toUpperCase()}${body.outcome ? ` - ${body.outcome}` : ''}]`;
    updateData['notes'] = `${existing}${prefix}: ${body.notes}`;
  }
  if (body.next_follow_up) {
    const existingAttrs = (lead.attributes as Record<string, any>) || {};
    updateData['attributes'] = { ...existingAttrs, follow_up_date: body.next_follow_up };
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(leads).set(updateData).where(eq(leads.id, id));
  }

  const [event] = await db
    .insert(leadEvents)
    .values({
      leadId: id,
      tenantId: scope.tenant_id,
      eventType:
        body.type === 'call'
          ? 'call_logged'
          : body.type === 'whatsapp'
            ? 'whatsapp_sent'
            : 'interaction_logged',
      actorId: scope.user_id,
      metadata: {
        interaction_type: body.type,
        outcome: body.outcome,
        notes: body.notes,
        next_follow_up: body.next_follow_up,
      },
    })
    .returning();

  return c.json({ success: true, event });
});

// POST /leads/:id/convert - Convert lead to customer party (atomic transaction)
leadsRouter.post('/:id/convert', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const { vertical_id } = await c.req.json().catch(() => ({}));

  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, id), eq(leads.tenantId, scope.tenant_id)),
  });

  if (!lead) {
    return c.json({ code: 'NOT_FOUND', message: 'Lead not found' }, 404);
  }

  if (lead.status === 'converted') {
    return c.json({ code: 'ALREADY_CONVERTED', message: 'This lead has already been converted' }, 400);
  }

  let targetVerticalId = vertical_id || lead.verticalId || scope.vertical_ids[0];
  if (!targetVerticalId) {
    const defaultVert = await db.query.verticals.findFirst({
      where: eq(verticals.tenantId, scope.tenant_id),
    });
    if (defaultVert) {
      targetVerticalId = defaultVert.id;
    } else {
      let defaultBranch = await db.query.branches.findFirst({
        where: eq(branches.tenantId, scope.tenant_id),
      });
      if (!defaultBranch) {
        const [nb] = await db.insert(branches).values({
          tenantId: scope.tenant_id,
          name: 'Main Location',
        }).returning();
        defaultBranch = nb;
      }
      const [nv] = await db.insert(verticals).values({
        tenantId: scope.tenant_id,
        branchId: defaultBranch!.id,
        name: 'General Services',
      }).returning();
      targetVerticalId = nv!.id;
    }
  }

  // Atomic conversion transaction
  const result = await db.transaction(async (tx) => {
    const [party] = await tx
      .insert(parties)
      .values({
        tenantId: scope.tenant_id,
        verticalId: targetVerticalId,
        type: 'individual',
        name: lead.name,
        email: lead.email,
        phoneRaw: lead.phone,
        phoneNormalized: lead.phone.replace(/[^\d+]/g, ''),
        source: (lead.source as any) || 'manual',
        attributes: lead.attributes || {},
        mergeStatus: 'canonical',
      })
      .returning();

    await tx
      .update(leads)
      .set({
        status: 'converted',
        partyId: party!.id,
      })
      .where(eq(leads.id, id));

    await tx.insert(leadEvents).values({
      leadId: id,
      tenantId: scope.tenant_id,
      eventType: 'promoted',
      toStage: lead.stage,
      actorId: scope.user_id,
      metadata: { party_id: party!.id },
    });

    return party!;
  });

  return c.json({ party_id: result.id });
});

// POST /leads/:id/route-to-franchise - Manual routing from Franchisor to Franchisee
leadsRouter.post('/:id/route-to-franchise', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const { franchisee_tenant_id } = await c.req.json().catch(() => ({}));

  if (!franchisee_tenant_id) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'franchisee_tenant_id is required' }, 400);
  }

  // Ensure target franchisee belongs to this franchisor
  const franchisee = await db.query.tenants.findFirst({
    where: and(eq(tenants.id, franchisee_tenant_id), eq(tenants.parentTenantId, scope.tenant_id)),
  });

  if (!franchisee) {
    return c.json({ code: 'FORBIDDEN', message: 'Target workspace is not a child franchisee of your organization' }, 403);
  }

  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, id), eq(leads.tenantId, scope.tenant_id)),
  });

  if (!lead) {
    return c.json({ code: 'NOT_FOUND', message: 'Lead not found' }, 404);
  }

  const [updated] = await db
    .update(leads)
    .set({
      tenantId: franchisee.id,
      assignedToId: null,
      verticalId: null,
    })
    .where(eq(leads.id, id))
    .returning();

  await db.insert(leadEvents).values({
    leadId: id,
    tenantId: franchisee.id,
    eventType: 'franchise_routed',
    actorId: scope.user_id,
    metadata: {
      from_franchisor_id: scope.tenant_id,
      to_franchisee_id: franchisee.id,
      to_franchisee_name: franchisee.name,
    },
  });

  return c.json({
    success: true,
    message: `Lead successfully transferred to franchise store: ${franchisee.name}`,
    lead: updated,
  });
});
