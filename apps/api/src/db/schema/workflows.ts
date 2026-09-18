import { pgTable, text, timestamp, jsonb, index, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, verticals } from './tenants';

export const pipelineDefinitions = pgTable(
  'pipeline_definitions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    verticalId: text('vertical_id').references(() => verticals.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    entityType: text('entity_type').default('lead').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_pipelines_tenant_id').on(table.tenantId),
    index('idx_pipelines_vertical_id').on(table.verticalId),
  ]
);

export const pipelineStages = pgTable(
  'pipeline_stages',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    pipelineDefinitionId: text('pipeline_definition_id')
      .references(() => pipelineDefinitions.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    order: integer('order').notNull(),
    entryCriteria: jsonb('entry_criteria').default([]).notNull(),
    slaHours: integer('sla_hours'),
    terminalOutcome: text('terminal_outcome'), // won | lost | null
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_pipeline_stages_pipeline').on(table.pipelineDefinitionId),
  ]
);

export const pipelineTransitions = pgTable(
  'pipeline_transitions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    pipelineDefinitionId: text('pipeline_definition_id')
      .references(() => pipelineDefinitions.id, { onDelete: 'cascade' })
      .notNull(),
    fromStageId: text('from_stage_id')
      .references(() => pipelineStages.id, { onDelete: 'cascade' })
      .notNull(),
    toStageId: text('to_stage_id')
      .references(() => pipelineStages.id, { onDelete: 'cascade' })
      .notNull(),
    triggers: jsonb('triggers').default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_transitions_pipeline').on(table.pipelineDefinitionId),
  ]
);

export const automationWorkflows = pgTable(
  'automation_workflows',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    triggerEvent: text('trigger_event').notNull(), // Party:create, Lead:create, etc.
    flowJson: jsonb('flow_json').default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_automations_tenant_trigger').on(table.tenantId, table.triggerEvent),
  ]
);

export const pipelineDefinitionsRelations = relations(pipelineDefinitions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [pipelineDefinitions.tenantId], references: [tenants.id] }),
  vertical: one(verticals, { fields: [pipelineDefinitions.verticalId], references: [verticals.id] }),
  stages: many(pipelineStages),
  transitions: many(pipelineTransitions),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ one }) => ({
  pipelineDefinition: one(pipelineDefinitions, {
    fields: [pipelineStages.pipelineDefinitionId],
    references: [pipelineDefinitions.id],
  }),
}));

export const pipelineTransitionsRelations = relations(pipelineTransitions, ({ one }) => ({
  pipelineDefinition: one(pipelineDefinitions, {
    fields: [pipelineTransitions.pipelineDefinitionId],
    references: [pipelineDefinitions.id],
  }),
  fromStage: one(pipelineStages, { fields: [pipelineTransitions.fromStageId], references: [pipelineStages.id] }),
  toStage: one(pipelineStages, { fields: [pipelineTransitions.toStageId], references: [pipelineStages.id] }),
}));
