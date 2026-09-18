import { pgTable, text, timestamp, jsonb, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, users } from './tenants';

export const roles = pgTable(
  'roles',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    displayName: text('display_name'),
    description: text('description'),
    isSystemRole: boolean('is_system_role').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('idx_roles_tenant_name').on(table.tenantId, table.name),
    uniqueIndex('idx_roles_tenant_slug').on(table.tenantId, table.slug),
  ]
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    roleId: text('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
    resource: text('resource').notNull(), // User, Role, Lead, Party, etc.
    action: text('action').notNull(), // manage, read, create, update, delete
    conditions: jsonb('conditions'),
  },
  (table) => [
    index('idx_role_permissions_role').on(table.roleId),
  ]
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    roleId: text('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    assignmentId: text('assignment_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_user_roles_user').on(table.userId),
    index('idx_user_roles_tenant').on(table.tenantId),
  ]
);

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [roles.tenantId], references: [tenants.id] }),
  permissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  tenant: one(tenants, { fields: [userRoles.tenantId], references: [tenants.id] }),
}));
