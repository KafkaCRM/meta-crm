import { pgTable, text, timestamp, jsonb, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, users, branches } from './tenants';

export const customObjects = pgTable(
  'custom_objects',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    key: text('key').notNull(),                 // e.g. 'hearing', 'solar_quote', 'vehicle'
    label: text('label').notNull(),             // 'Court Hearing'
    pluralLabel: text('plural_label').notNull(), // 'Court Hearings'
    domain: text('domain').default('Custom Domain').notNull(), // Grouping under sidebar e.g. 'Legal Practice'
    description: text('description'),
    icon: text('icon').default('Layers').notNull(),
    primaryField: text('primary_field').default('name').notNull(),
    trackActivities: boolean('track_activities').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('idx_custom_objects_tenant_key').on(table.tenantId, table.key),
  ]
);

export const flexRecords = pgTable(
  'flex_records',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    customObjectId: text('custom_object_id').references(() => customObjects.id, { onDelete: 'cascade' }).notNull(),
    objectKey: text('object_key').notNull(),
    name: text('name').notNull(),
    status: text('status').default('active').notNull(),
    data: jsonb('data').default({}).notNull(),
    assignedToId: text('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
    branchId: text('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_flex_records_tenant_obj').on(table.tenantId, table.objectKey),
    index('idx_flex_records_status').on(table.status),
    index('idx_flex_records_created').on(table.createdAt),
  ]
);

export const fieldDefinitions = pgTable(
  'field_definitions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    entityType: text('entity_type').notNull(), // Lead | Party | Task | or custom object key e.g. hearing
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

export const customObjectsRelations = relations(customObjects, ({ one, many }) => ({
  tenant: one(tenants, { fields: [customObjects.tenantId], references: [tenants.id] }),
  records: many(flexRecords),
}));

export const flexRecordsRelations = relations(flexRecords, ({ one }) => ({
  tenant: one(tenants, { fields: [flexRecords.tenantId], references: [tenants.id] }),
  customObject: one(customObjects, { fields: [flexRecords.customObjectId], references: [customObjects.id] }),
  assignedTo: one(users, { fields: [flexRecords.assignedToId], references: [users.id] }),
  branch: one(branches, { fields: [flexRecords.branchId], references: [branches.id] }),
}));

export const fieldDefinitionsRelations = relations(fieldDefinitions, ({ one }) => ({
  tenant: one(tenants, { fields: [fieldDefinitions.tenantId], references: [tenants.id] }),
}));

export const labelOverridesRelations = relations(labelOverrides, ({ one }) => ({
  tenant: one(tenants, { fields: [labelOverrides.tenantId], references: [tenants.id] }),
}));

export const setupAuditTrailsRelations = relations(setupAuditTrails, ({ one }) => ({
  tenant: one(tenants, { fields: [setupAuditTrails.tenantId], references: [tenants.id] }),
}));
