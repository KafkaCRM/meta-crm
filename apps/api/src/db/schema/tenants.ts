import { pgTable, text, timestamp, jsonb, uniqueIndex, index, doublePrecision, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenantStatusEnum, tenantTypeEnum, userStatusEnum } from './enums';

export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    industry: text('industry').notNull(),
    tenantType: tenantTypeEnum('tenant_type').default('independent').notNull(),
    parentTenantId: text('parent_tenant_id').references((): AnyPgColumn => tenants.id, { onDelete: 'set null' }),
    royaltyPercentage: doublePrecision('royalty_percentage').default(0).notNull(),
    territoryCodes: jsonb('territory_codes').default([]).notNull(),
    configJson: jsonb('config_json').default({}).notNull(),
    schemaName: text('schema_name'),
    status: tenantStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_tenants_parent_id').on(table.parentTenantId),
    index('idx_tenants_type').on(table.tenantType),
  ]
);

export const branches = pgTable(
  'branches',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    address: text('address'),
    city: text('city'),
    managerId: text('manager_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_branches_tenant_id').on(table.tenantId),
  ]
);

export const verticals = pgTable(
  'verticals',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    branchId: text('branch_id').references(() => branches.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('idx_verticals_branch_name').on(table.branchId, table.name),
    index('idx_verticals_tenant_id').on(table.tenantId),
  ]
);

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    branchId: text('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email'),
    phoneNumber: text('phone_number'),
    passwordHash: text('password_hash').notNull(),
    status: userStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_email_tenant').on(table.email, table.tenantId),
    uniqueIndex('idx_users_phone_tenant').on(table.phoneNumber, table.tenantId),
    index('idx_users_tenant_id').on(table.tenantId),
  ]
);

export const userBranches = pgTable(
  'user_branches',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    branchId: text('branch_id').references(() => branches.id, { onDelete: 'cascade' }).notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_user_branches_unique').on(table.userId, table.branchId),
    index('idx_user_branches_tenant').on(table.tenantId),
  ]
);

export const userVerticals = pgTable(
  'user_verticals',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    verticalId: text('vertical_id').references(() => verticals.id, { onDelete: 'cascade' }).notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_user_verticals_unique').on(table.userId, table.verticalId),
    index('idx_user_verticals_tenant').on(table.tenantId),
  ]
);

export const platformUsers = pgTable(
  'platform_users',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    status: userStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  }
);

export const platformUserRoles = pgTable(
  'platform_user_roles',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    platformUserId: text('platform_user_id').references(() => platformUsers.id, { onDelete: 'cascade' }).notNull(),
    role: text('role').notNull(), // platform_owner | platform_admin | support
  },
  (table) => [
    uniqueIndex('idx_platform_user_role').on(table.platformUserId, table.role),
  ]
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    userId: text('user_id').notNull(),
    userType: text('user_type').notNull(), // tenant | platform
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_refresh_tokens_hash').on(table.tokenHash),
    index('idx_refresh_tokens_user').on(table.userId),
  ]
);

export const franchiseRoyaltyStatements = pgTable(
  'franchise_royalty_statements',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    franchisorTenantId: text('franchisor_tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    franchiseeTenantId: text('franchisee_tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    grossSales: doublePrecision('gross_sales').notNull(),
    royaltyRate: doublePrecision('royalty_rate').notNull(),
    royaltyAmount: doublePrecision('royalty_amount').notNull(),
    status: text('status').default('pending').notNull(), // pending | invoiced | paid
    generatedAt: timestamp('generated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_royalty_franchisor').on(table.franchisorTenantId),
    index('idx_royalty_franchisee').on(table.franchiseeTenantId),
  ]
);

// Relations
export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  parent: one(tenants, {
    fields: [tenants.parentTenantId],
    references: [tenants.id],
    relationName: 'franchise_hierarchy',
  }),
  franchisees: many(tenants, {
    relationName: 'franchise_hierarchy',
  }),
  branches: many(branches),
  verticals: many(verticals),
  users: many(users),
  royaltyStatementsAsFranchisor: many(franchiseRoyaltyStatements, {
    relationName: 'franchisor_statements',
  }),
  royaltyStatementsAsFranchisee: many(franchiseRoyaltyStatements, {
    relationName: 'franchisee_statements',
  }),
}));

export const franchiseRoyaltyStatementsRelations = relations(franchiseRoyaltyStatements, ({ one }) => ({
  franchisor: one(tenants, {
    fields: [franchiseRoyaltyStatements.franchisorTenantId],
    references: [tenants.id],
    relationName: 'franchisor_statements',
  }),
  franchisee: one(tenants, {
    fields: [franchiseRoyaltyStatements.franchiseeTenantId],
    references: [tenants.id],
    relationName: 'franchisee_statements',
  }),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  tenant: one(tenants, { fields: [branches.tenantId], references: [tenants.id] }),
  verticals: many(verticals),
  users: many(users),
}));

export const verticalsRelations = relations(verticals, ({ one }) => ({
  tenant: one(tenants, { fields: [verticals.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [verticals.branchId], references: [branches.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [users.branchId], references: [branches.id] }),
  userBranches: many(userBranches),
  userVerticals: many(userVerticals),
}));
