import { pgTable, text, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenantStatusEnum, userStatusEnum } from './enums';

export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    industry: text('industry').notNull(),
    configJson: jsonb('config_json').default({}).notNull(),
    schemaName: text('schema_name'),
    status: tenantStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  }
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

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  branches: many(branches),
  verticals: many(verticals),
  users: many(users),
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
