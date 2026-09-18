import { pgTable, text, timestamp, jsonb, integer, doublePrecision, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants } from './tenants';

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    name: text('name').notNull().unique(),
    maxBranches: integer('max_branches').notNull(),
    maxUsers: integer('max_users').notNull(),
    maxPlugins: integer('max_plugins').notNull(),
    priceMonthly: doublePrecision('price_monthly'),
    capabilities: jsonb('capabilities').default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

export const tenantPlans = pgTable(
  'tenant_plans',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull().unique(),
    planId: text('plan_id').references(() => subscriptionPlans.id, { onDelete: 'cascade' }).notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
  }
);

export const capabilityPricing = pgTable(
  'capability_pricing',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    capabilityId: text('capability_id').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    priceMonthly: doublePrecision('price_monthly').default(0).notNull(),
    pricePerUser: doublePrecision('price_per_user').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  }
);

export const platformAuditLogs = pgTable(
  'platform_audit_logs',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    actorId: text('actor_id').notNull(),
    actorEmail: text('actor_email').notNull(),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    targetId: text('target_id'),
    actorIp: text('actor_ip').notNull(),
    userAgent: text('user_agent').notNull(),
    details: jsonb('details').default({}).notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_platform_audit_actor').on(table.actorId),
    index('idx_platform_audit_created').on(table.createdAt),
  ]
);

export const pluginRegistry = pgTable(
  'plugin_registry',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    packageName: text('package_name').notNull().unique(),
    version: text('version').notNull(),
    manifest: jsonb('manifest').notNull(),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  }
);

export const tenantPlugins = pgTable(
  'tenant_plugins',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    pluginRegistryId: text('plugin_registry_id').references(() => pluginRegistry.id, { onDelete: 'cascade' }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    installedAt: timestamp('installed_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_tenant_plugins_unique').on(table.tenantId, table.pluginRegistryId),
  ]
);

export const tenantCapabilities = pgTable(
  'tenant_capabilities',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    capabilityId: text('capability_id').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    enabledAt: timestamp('enabled_at').defaultNow().notNull(),
    enabledBy: text('enabled_by').notNull(),
  },
  (table) => [
    uniqueIndex('idx_tenant_capabilities_unique').on(table.tenantId, table.capabilityId),
  ]
);

export const tenantPlansRelations = relations(tenantPlans, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantPlans.tenantId], references: [tenants.id] }),
  plan: one(subscriptionPlans, { fields: [tenantPlans.planId], references: [subscriptionPlans.id] }),
}));

export const tenantPluginsRelations = relations(tenantPlugins, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantPlugins.tenantId], references: [tenants.id] }),
  pluginRegistry: one(pluginRegistry, { fields: [tenantPlugins.pluginRegistryId], references: [pluginRegistry.id] }),
}));
