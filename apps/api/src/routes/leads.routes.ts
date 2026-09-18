import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, or, inArray, desc, lt, isNull, ilike } from 'drizzle-orm';
import { db } from '../db';
import { leads, leadEvents, parties, pipelineDefinitions, pipelineStages, users, tenants } from '../db/schema';
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

  const [created] = await db
    .insert(leads)
    .values({
      tenantId: tenant.id,
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
      tenantId: tenant.id,
      eventType: 'lead_created',
      actorId: 'public_api',
      metadata: { source: data.source },
    });
  }

  return c.json({ success: true, lead_id: created?.id }, 201);
});

// All routes below require tenant authentication
leadsRouter.use('*', requireAuth, requireTenant);

// GET /leads - List leads with cursor pagination and vertical filtering
leadsRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const query = c.req.query();

  const limit = Math.min(Number(query['limit']) || 50, 100);
  const cursor = query['cursor'];
  const status = query['status'];
  const source = query['source'];
  const name = query['name'];
  const assignedToId = query['assigned_to_id'];
  const pipelineDefId = query['pipeline_definition_id'];
  const stage = query['stage'];
  const verticalIdsParam = query['vertical_ids'];

  const conditions = [
    eq(leads.tenantId, scope.tenant_id),
    isNull(leads.deletedAt),
  ];

  // Vertical scoping: combine token vertical scope with query parameter filter
  let allowedVerticals = scope.vertical_ids;
  if (verticalIdsParam) {
    const requested = verticalIdsParam.split(',').filter(Boolean);
    allowedVerticals = allowedVerticals.length
      ? requested.filter((id) => allowedVerticals.includes(id))
      : requested;
  }
  if (allowedVerticals.length > 0) {
    conditions.push(inArray(leads.verticalId, allowedVerticals));
  }

  if (status) conditions.push(eq(leads.status, status as any));
  if (source) conditions.push(eq(leads.source, source as any));
  if (name) conditions.push(ilike(leads.name, `%${name}%`));
  if (pipelineDefId) conditions.push(eq(leads.pipelineDefinitionId, pipelineDefId));
  if (stage) conditions.push(eq(leads.stage, stage));

  if (assignedToId) {
    if (assignedToId === 'unassigned' || assignedToId === 'null') {
      conditions.push(isNull(leads.assignedToId));
    } else {
      conditions.push(eq(leads.assignedToId, assignedToId));
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

  const results = await db.query.leads.findMany({
    where: and(...conditions),
    limit: limit + 1,
    orderBy: [desc(leads.createdAt)],
    with: {
      assignedTo: {
        columns: { id: true, name: true, email: true },
      },
      party: {
        columns: { id: true, name: true, email: true, phoneRaw: true, source: true },
      },
      pipelineDefinition: {
        columns: { id: true, name: true },
      },
    },
  });

  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  return c.json({
    data,
    next_cursor: nextCursor,
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
  email: z.string().email().optional().nullable(),
  phone: z.string().min(1, 'Phone is required'),
  source: z.string().default('manual'),
  status: z.string().default('new'),
  notes: z.string().optional().nullable(),
  campaign_id: z.string().optional().nullable(),
  assigned_to_id: z.string().optional().nullable(),
  vertical_id: z.string().optional().nullable(),
  pipeline_definition_id: z.string().optional().nullable(),
  stage: z.string().optional().nullable(),
  attributes: z.record(z.string(), z.any()).optional().default({}),
});

leadsRouter.post('/', validateJson(createLeadSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof createLeadSchema>;

  // Fix BUG-03: default vertical_id to null, never empty string!
  const verticalId = body.vertical_id?.trim() || scope.vertical_ids[0] || null;

  const [created] = await db
    .insert(leads)
    .values({
      tenantId: scope.tenant_id,
      name: body.name,
      email: body.email,
      phone: body.phone,
      source: body.source as any,
      status: (body.status || 'new') as any,
      notes: body.notes,
      campaignId: body.campaign_id,
      assignedToId: body.assigned_to_id,
      verticalId,
      pipelineDefinitionId: body.pipeline_definition_id,
      stage: body.stage,
      attributes: body.attributes || {},
    })
    .returning();

  if (created) {
    await db.insert(leadEvents).values({
      leadId: created.id,
      tenantId: scope.tenant_id,
      eventType: 'lead_created',
      actorId: scope.user_id,
      metadata: { source: body.source, campaign_id: body.campaign_id },
    });
  }

  return c.json(created, 201);
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

  const allowedFields = ['name', 'email', 'phone', 'source', 'status', 'notes', 'campaign_id', 'assigned_to_id', 'vertical_id', 'attributes'];
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      const dbField = field === 'campaign_id' ? 'campaignId' : field === 'assigned_to_id' ? 'assignedToId' : field === 'vertical_id' ? 'verticalId' : field;
      updateData[dbField] = field === 'vertical_id' ? (body[field] || null) : body[field];
      changedFields[field] = body[field];
    }
  }

  const [updated] = await db
    .update(leads)
    .set(updateData)
    .where(eq(leads.id, id))
    .returning();

  // Log update audit event (Fixes BUG-07)
  if (Object.keys(changedFields).length > 0) {
    await db.insert(leadEvents).values({
      leadId: id,
      tenantId: scope.tenant_id,
      eventType: 'lead_updated',
      actorId: scope.user_id,
      metadata: changedFields,
    });
  }

  return c.json(updated);
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

// POST /leads/:id/convert - Convert lead to customer party (atomic transaction)
leadsRouter.post('/:id/convert', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const { vertical_id } = await c.req.json().catch(() => ({}));

  if (!vertical_id) {
    return c.json({ code: 'VALIDATION_FAILED', message: 'vertical_id is required' }, 400);
  }

  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, id), eq(leads.tenantId, scope.tenant_id)),
  });

  if (!lead) {
    return c.json({ code: 'NOT_FOUND', message: 'Lead not found' }, 404);
  }

  if (lead.status === 'converted') {
    return c.json({ code: 'ALREADY_CONVERTED', message: 'This lead has already been converted' }, 400);
  }

  // Atomic conversion transaction
  const result = await db.transaction(async (tx) => {
    const [party] = await tx
      .insert(parties)
      .values({
        tenantId: scope.tenant_id,
        verticalId: vertical_id,
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
