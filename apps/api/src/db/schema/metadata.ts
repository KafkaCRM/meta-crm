import { pgTable, text, timestamp, jsonb, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants } from './tenants';

export const fieldDefinitions = pgTable(
  'field_definitions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    entityType: text('entity_type').notNull(), // Lead | Party | Task | etc.
    name: text('name').notNull(),
    label: text('label').notNull(),
    fieldType: text('field_type').notNull(), // text, number, select, date, boolean, lookup
    options: jsonb('options'),
    required: boolean('required').default(false).notNull(),
    order: integer('order').default(0).notNull(),
    visibilityRules: jsonb('visibility_rules').default([]).notNull(),
    relatedTo: text('related_to'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_field_definitions_tenant_entity').on(table.tenantId, table.entityType),
  ]
);

export const labelOverrides = pgTable(
  'label_overrides',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    labelKey: text('label_key').notNull(),
    overrideValue: text('override_value').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('idx_label_overrides_unique').on(table.tenantId, table.labelKey),
  ]
);

export const industryTemplates = pgTable(
  'industry_templates',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    industry: text('industry').notNull(),
    template: jsonb('template').notNull(),
    version: text('version').default('1.0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

export const setupAuditTrails = pgTable(
  'setup_audit_trails',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    userEmail: text('user_email').notNull(),
    action: text('action').notNull(),
    section: text('section').notNull(),
    details: jsonb('details').default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_setup_audit_trails_tenant').on(table.tenantId),
  ]
);

export const fieldDefinitionsRelations = relations(fieldDefinitions, ({ one }) => ({
  tenant: one(tenants, { fields: [fieldDefinitions.tenantId], references: [tenants.id] }),
}));

export const labelOverridesRelations = relations(labelOverrides, ({ one }) => ({
  tenant: one(tenants, { fields: [labelOverrides.tenantId], references: [tenants.id] }),
}));

export const setupAuditTrailsRelations = relations(setupAuditTrails, ({ one }) => ({
  tenant: one(tenants, { fields: [setupAuditTrails.tenantId], references: [tenants.id] }),
}));
