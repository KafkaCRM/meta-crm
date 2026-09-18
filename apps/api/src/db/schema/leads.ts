import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, verticals, users } from './tenants';
import { parties } from './core';
import { pipelineDefinitions } from './workflows';
import { leadStatusEnum, partySourceEnum } from './enums';

export const leads = pgTable(
  'leads',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    verticalId: text('vertical_id').references(() => verticals.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone').notNull(),
    source: partySourceEnum('source').default('manual').notNull(),
    status: leadStatusEnum('status').default('new').notNull(),
    stage: text('stage'),
    pipelineDefinitionId: text('pipeline_definition_id').references(() => pipelineDefinitions.id, { onDelete: 'set null' }),
    notes: text('notes'),
    campaignId: text('campaign_id'),
    assignedToId: text('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
    partyId: text('party_id').references(() => parties.id, { onDelete: 'set null' }),
    attributes: jsonb('attributes').default({}).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_leads_tenant_status').on(table.tenantId, table.status),
    index('idx_leads_tenant_vertical').on(table.tenantId, table.verticalId),
    index('idx_leads_tenant_stage').on(table.tenantId, table.stage),
    index('idx_leads_tenant_pipeline').on(table.tenantId, table.pipelineDefinitionId),
    index('idx_leads_tenant_party').on(table.tenantId, table.partyId),
    index('idx_leads_tenant_campaign').on(table.tenantId, table.campaignId),
    index('idx_leads_tenant_assigned').on(table.tenantId, table.assignedToId),
    index('idx_leads_tenant_created').on(table.tenantId, table.createdAt),
  ]
);

export const leadEvents = pgTable(
  'lead_events',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    leadId: text('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    eventType: text('event_type').notNull(), // lead_created, stage_changed, lead_updated, promoted, etc.
    fromStage: text('from_stage'),
    toStage: text('to_stage'),
    metadata: jsonb('metadata').default({}).notNull(),
    actorId: text('actor_id').notNull(),
    occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_lead_events_lead').on(table.leadId, table.occurredAt),
    index('idx_lead_events_tenant').on(table.tenantId, table.occurredAt),
  ]
);

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, { fields: [leads.tenantId], references: [tenants.id] }),
  vertical: one(verticals, { fields: [leads.verticalId], references: [verticals.id] }),
  assignedTo: one(users, { fields: [leads.assignedToId], references: [users.id] }),
  party: one(parties, { fields: [leads.partyId], references: [parties.id] }),
  pipelineDefinition: one(pipelineDefinitions, { fields: [leads.pipelineDefinitionId], references: [pipelineDefinitions.id] }),
  events: many(leadEvents),
}));

export const leadEventsRelations = relations(leadEvents, ({ one }) => ({
  lead: one(leads, { fields: [leadEvents.leadId], references: [leads.id] }),
}));
