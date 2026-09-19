import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, inArray, desc, count, or, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
  pipelineDefinitions,
  pipelineStages,
  pipelineTransitions,
  automationWorkflows,
  leads,
  campaigns,
  verticals,
} from '../db/schema';
import { validateJson } from '../middleware/validator';
import { requireAuth } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import type { AppEnv } from '../types/context';

export const workflowsRouter = new Hono<AppEnv>();

workflowsRouter.use('*', requireAuth, requireTenant);

const DEFAULT_STAGES = [
  { name: 'Lead', order: 0, slaHours: 24, terminalOutcome: null },
  { name: 'Contacted', order: 1, slaHours: null, terminalOutcome: null },
  { name: 'Qualified', order: 2, slaHours: null, terminalOutcome: null },
  { name: 'Proposal Sent', order: 3, slaHours: null, terminalOutcome: null },
  { name: 'Closed Won', order: 4, slaHours: null, terminalOutcome: 'won' },
  { name: 'Closed Lost', order: 5, slaHours: null, terminalOutcome: 'lost' },
];

// GET /settings/pipelines - List pipelines with stages
workflowsRouter.get('/', async (c) => {
  const scope = c.get('scope');
  const branchParam = c.req.query('branch_ids') || c.req.query('branch_id');
  const verticalId = c.req.query('vertical_id');
  const verticalIdsParam = c.req.query('vertical_ids');

  const conditions = [eq(pipelineDefinitions.tenantId, scope.tenant_id)];

  if (verticalIdsParam) {
    const ids = verticalIdsParam.split(',').filter(Boolean);
    if (ids.length > 0) {
      conditions.push(inArray(pipelineDefinitions.verticalId, ids));
    } else {
      conditions.push(eq(pipelineDefinitions.id, '__NO_MATCH__'));
    }
  } else if (verticalId) {
    // STRICT: Show ONLY pipelines that are part of this vertical
    conditions.push(eq(pipelineDefinitions.verticalId, verticalId));
  } else if (branchParam) {
    const branchIds = branchParam.split(',').filter(Boolean);
    // STRICT: Show ONLY pipelines belonging to verticals in these branch(es)
    const branchVerticals = await db.query.verticals.findMany({
      where: and(eq(verticals.tenantId, scope.tenant_id), inArray(verticals.branchId, branchIds)),
      columns: { id: true },
    });
    const ids = branchVerticals.map((v) => v.id);
    if (ids.length > 0) {
      conditions.push(inArray(pipelineDefinitions.verticalId, ids));
    } else {
      conditions.push(eq(pipelineDefinitions.id, '__NO_MATCH__'));
    }
  }

  let pipelines = await db.query.pipelineDefinitions.findMany({
    where: and(...conditions),
    with: {
      stages: { orderBy: (stages, { asc }) => [asc(stages.order)] },
      vertical: {
        columns: { id: true, name: true, branchId: true },
        with: { branch: { columns: { name: true } } },
      },
    },
  });

  // If no pipelines exist across tenant, auto-provision default pipeline
  if (pipelines.length === 0 && !verticalId && !branchParam && !verticalIdsParam) {
    const anyExisting = await db.query.pipelineDefinitions.findFirst({
      where: eq(pipelineDefinitions.tenantId, scope.tenant_id),
    });

    if (!anyExisting) {
      const firstVertical = await db.query.verticals.findFirst({
        where: eq(verticals.tenantId, scope.tenant_id),
      });

      const [newDef] = await db
        .insert(pipelineDefinitions)
        .values({
          tenantId: scope.tenant_id,
          name: 'Default Pipeline',
          entityType: 'lead',
          verticalId: firstVertical ? firstVertical.id : null,
        })
        .returning();

      const createdStages = await db
        .insert(pipelineStages)
        .values(
          DEFAULT_STAGES.map((s) => ({
            pipelineDefinitionId: newDef!.id,
            name: s.name,
            order: s.order,
            slaHours: s.slaHours,
            terminalOutcome: s.terminalOutcome,
          }))
        )
        .returning();

      const transitionsToInsert = [];
      for (let i = 0; i < createdStages.length - 2; i++) {
        transitionsToInsert.push({
          pipelineDefinitionId: newDef!.id,
          fromStageId: createdStages[i]!.id,
          toStageId: createdStages[i + 1]!.id,
        });
      }
      const wonStage = createdStages.find((s) => s.terminalOutcome === 'won');
      const lostStage = createdStages.find((s) => s.terminalOutcome === 'lost');
      if (wonStage && lostStage) {
        transitionsToInsert.push(
          { pipelineDefinitionId: newDef!.id, fromStageId: createdStages[2]!.id, toStageId: wonStage.id },
          { pipelineDefinitionId: newDef!.id, fromStageId: createdStages[2]!.id, toStageId: lostStage.id }
        );
      }
      if (transitionsToInsert.length > 0) {
        await db.insert(pipelineTransitions).values(transitionsToInsert);
      }

      const defaultCreated = await db.query.pipelineDefinitions.findFirst({
        where: eq(pipelineDefinitions.id, newDef!.id),
        with: {
          stages: { orderBy: (stages, { asc }) => [asc(stages.order)] },
          vertical: {
            columns: { id: true, name: true, branchId: true },
            with: { branch: { columns: { name: true } } },
          },
        },
      });
      if (defaultCreated) pipelines = [defaultCreated];
    }
  }

  return c.json(pipelines.map(p => ({
    ...p,
    vertical_id: p.verticalId,
    tenant_id: p.tenantId,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  })));
});

// GET /settings/pipelines/default - Get or atomically create default pipeline (Fixes BUG-02 & BUG-09)
workflowsRouter.get('/default', async (c) => {
  const scope = c.get('scope');

  let pipeline = await db.query.pipelineDefinitions.findFirst({
    where: eq(pipelineDefinitions.tenantId, scope.tenant_id),
    with: {
      stages: { orderBy: (stages, { asc }) => [asc(stages.order)] },
      transitions: true,
    },
  });

  if (!pipeline) {
    // Atomically create default pipeline, stages, and transitions
    pipeline = await db.transaction(async (tx) => {
      const [newDef] = await tx
        .insert(pipelineDefinitions)
        .values({
          tenantId: scope.tenant_id,
          name: 'Default Pipeline',
          entityType: 'lead',
        })
        .returning();

      const createdStages = await tx
        .insert(pipelineStages)
        .values(
          DEFAULT_STAGES.map((s) => ({
            pipelineDefinitionId: newDef!.id,
            name: s.name,
            order: s.order,
            slaHours: s.slaHours,
            terminalOutcome: s.terminalOutcome,
          }))
        )
        .returning();

      // Standard linear transitions
      const transitionsToInsert = [];
      for (let i = 0; i < createdStages.length - 2; i++) {
        transitionsToInsert.push({
          pipelineDefinitionId: newDef!.id,
          fromStageId: createdStages[i]!.id,
          toStageId: createdStages[i + 1]!.id,
        });
      }
      // Qualified or Proposal to Won/Lost
      const wonStage = createdStages.find((s) => s.terminalOutcome === 'won');
      const lostStage = createdStages.find((s) => s.terminalOutcome === 'lost');
      if (wonStage && lostStage) {
        transitionsToInsert.push(
          { pipelineDefinitionId: newDef!.id, fromStageId: createdStages[2]!.id, toStageId: wonStage.id },
          { pipelineDefinitionId: newDef!.id, fromStageId: createdStages[2]!.id, toStageId: lostStage.id }
        );
      }

      await tx.insert(pipelineTransitions).values(transitionsToInsert);

      return tx.query.pipelineDefinitions.findFirst({
        where: eq(pipelineDefinitions.id, newDef!.id),
        with: {
          stages: { orderBy: (stages, { asc }) => [asc(stages.order)] },
          transitions: true,
        },
      });
    });
  }

  return c.json(pipeline);
});

// POST /settings/pipelines - Create new pipeline with stages (Atomic transaction)
const createPipelineSchema = z.object({
  name: z.string().min(1, 'Pipeline name is required'),
  entity_type: z.string().default('lead'),
  vertical_id: z.string().min(1, 'Vertical is required for a pipeline'),
});

workflowsRouter.post('/', validateJson(createPipelineSchema), async (c) => {
  const scope = c.get('scope');
  const body = c.get('validatedJson' as any) as z.infer<typeof createPipelineSchema>;

  const vertical = await db.query.verticals.findFirst({
    where: and(
      eq(verticals.id, body.vertical_id),
      eq(verticals.tenantId, scope.tenant_id)
    ),
  });

  if (!vertical) {
    return c.json({ code: 'INVALID_VERTICAL', message: 'Vertical not found or does not belong to tenant' }, 400);
  }

  const existing = await db.query.pipelineDefinitions.findFirst({
    where: and(
      eq(pipelineDefinitions.tenantId, scope.tenant_id),
      eq(pipelineDefinitions.name, body.name.trim())
    ),
  });

  if (existing) {
    return c.json({ code: 'DUPLICATE_NAME', message: `Pipeline "${body.name.trim()}" already exists` }, 400);
  }

  const created = await db.transaction(async (tx) => {
    const [pipeline] = await tx
      .insert(pipelineDefinitions)
      .values({
        tenantId: scope.tenant_id,
        name: body.name.trim(),
        entityType: body.entity_type || 'lead',
        verticalId: body.vertical_id,
      })
      .returning();

    const createdStages = await tx
      .insert(pipelineStages)
      .values(
        DEFAULT_STAGES.map((s) => ({
          pipelineDefinitionId: pipeline!.id,
          name: s.name,
          order: s.order,
          slaHours: s.slaHours,
          terminalOutcome: s.terminalOutcome,
        }))
      )
      .returning();

    return { ...pipeline, stages: createdStages };
  });

  return c.json(created, 201);
});

// PUT /settings/pipelines/:id - Update pipeline configuration
workflowsRouter.put('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const existing = await db.query.pipelineDefinitions.findFirst({
    where: and(eq(pipelineDefinitions.id, id), eq(pipelineDefinitions.tenantId, scope.tenant_id)),
  });

  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Pipeline not found' }, 404);
  }

  const updated = await db.transaction(async (tx) => {
    if (body.name) {
      await tx.update(pipelineDefinitions).set({ name: body.name }).where(eq(pipelineDefinitions.id, id));
    }

    if (Array.isArray(body.stages)) {
      // Upsert stages
      for (const stage of body.stages) {
        if (stage.id && !stage.id.startsWith('stage_')) {
          await tx
            .update(pipelineStages)
            .set({
              name: stage.name,
              order: stage.order,
              slaHours: stage.sla_hours ?? stage.slaHours,
              terminalOutcome: stage.terminal_outcome ?? stage.terminalOutcome,
            })
            .where(eq(pipelineStages.id, stage.id));
        } else {
          await tx.insert(pipelineStages).values({
            pipelineDefinitionId: id,
            name: stage.name,
            order: stage.order,
            slaHours: stage.sla_hours ?? stage.slaHours,
            terminalOutcome: stage.terminal_outcome ?? stage.terminalOutcome,
          });
        }
      }
    }

    return tx.query.pipelineDefinitions.findFirst({
      where: eq(pipelineDefinitions.id, id),
      with: {
        stages: { orderBy: (stages, { asc }) => [asc(stages.order)] },
        transitions: true,
      },
    });
  });

  return c.json(updated);
});

// DELETE /settings/pipelines/:id - Delete pipeline safely
workflowsRouter.delete('/:id', async (c) => {
  const scope = c.get('scope');
  const id = c.req.param('id');

  const existing = await db.query.pipelineDefinitions.findFirst({
    where: and(eq(pipelineDefinitions.id, id), eq(pipelineDefinitions.tenantId, scope.tenant_id)),
  });

  if (!existing) {
    return c.json({ code: 'NOT_FOUND', message: 'Pipeline not found' }, 404);
  }

  // Prevent deleting the only pipeline
  const total = await db.select({ count: count() }).from(pipelineDefinitions).where(eq(pipelineDefinitions.tenantId, scope.tenant_id));
  if ((total[0]?.count || 0) <= 1) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Cannot delete the only pipeline in workspace' }, 400);
  }

  // Check linked leads
  const linkedLeads = await db.select({ count: count() }).from(leads).where(eq(leads.pipelineDefinitionId, id));
  if ((linkedLeads[0]?.count || 0) > 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: `Cannot delete: linked to ${linkedLeads[0]?.count} active lead(s)` }, 400);
  }

  // Check linked campaigns
  const linkedCampaigns = await db.select({ count: count() }).from(campaigns).where(eq(campaigns.pipelineId, id));
  if ((linkedCampaigns[0]?.count || 0) > 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: `Cannot delete: linked to ${linkedCampaigns[0]?.count} active campaign(s)` }, 400);
  }

  await db.delete(pipelineDefinitions).where(eq(pipelineDefinitions.id, id));

  return c.json({ success: true });
});

// Automation workflows
workflowsRouter.get('/automations', async (c) => {
  const scope = c.get('scope');
  const automations = await db.query.automationWorkflows.findMany({
    where: eq(automationWorkflows.tenantId, scope.tenant_id),
    orderBy: [desc(automationWorkflows.createdAt)],
  });
  return c.json(automations);
});

workflowsRouter.post('/automations', async (c) => {
  const scope = c.get('scope');
  const body = await c.req.json();

  const [created] = await db
    .insert(automationWorkflows)
    .values({
      tenantId: scope.tenant_id,
      name: body.name,
      description: body.description,
      triggerEvent: body.trigger_event,
      flowJson: body.flow_json || {},
      isActive: body.is_active ?? true,
    })
    .returning();

  return c.json(created, 201);
});
