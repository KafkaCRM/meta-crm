import { pgTable, text, timestamp, jsonb, index, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, branches, verticals } from './tenants';
import { pipelineDefinitions } from './workflows';

export const campaigns = pgTable(
  'campaigns',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    branchId: text('branch_id').references(() => branches.id, { onDelete: 'cascade' }).notNull(),
    verticalId: text('vertical_id').references(() => verticals.id, { onDelete: 'cascade' }).notNull(),
    pipelineId: text('pipeline_id').references(() => pipelineDefinitions.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    status: text('status').default('draft').notNull(),
    channel: text('channel').notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date'),
    targetLeads: integer('target_leads'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    attributes: jsonb('attributes').default({}).notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_campaigns_tenant_status').on(table.tenantId, table.status),
    index('idx_campaigns_tenant_vertical').on(table.tenantId, table.verticalId),
    index('idx_campaigns_tenant_pipeline').on(table.tenantId, table.pipelineId),
    index('idx_campaigns_tenant_utm').on(table.tenantId, table.utmCampaign),
  ]
);

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  tenant: one(tenants, { fields: [campaigns.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [campaigns.branchId], references: [branches.id] }),
  vertical: one(verticals, { fields: [campaigns.verticalId], references: [verticals.id] }),
  pipeline: one(pipelineDefinitions, { fields: [campaigns.pipelineId], references: [pipelineDefinitions.id] }),
}));
