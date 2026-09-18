import { pgTable, text, timestamp, jsonb, index, doublePrecision, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, verticals, users } from './tenants';
import { partyTypeEnum, partySourceEnum, partyMergeStatusEnum, interactionChannelEnum, interactionDirectionEnum } from './enums';

export const parties = pgTable(
  'parties',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    verticalId: text('vertical_id').references(() => verticals.id, { onDelete: 'cascade' }).notNull(),
    assignedToId: text('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
    type: partyTypeEnum('type').default('individual').notNull(),
    name: text('name').notNull(),
    email: text('email'),
    phoneRaw: text('phone_raw').notNull(),
    phoneNormalized: text('phone_normalized').notNull(),
    source: partySourceEnum('source').default('manual').notNull(),
    attributes: jsonb('attributes').default({}).notNull(),
    mergeStatus: partyMergeStatusEnum('merge_status').default('canonical').notNull(),
    mergedIntoId: text('merged_into_id'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_parties_tenant_phone').on(table.tenantId, table.phoneNormalized),
    index('idx_parties_tenant_created').on(table.tenantId, table.createdAt),
    index('idx_parties_tenant_vertical').on(table.tenantId, table.verticalId),
    index('idx_parties_tenant_merge').on(table.tenantId, table.mergeStatus),
  ]
);

export const interactions = pgTable(
  'interactions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    partyId: text('party_id').references(() => parties.id, { onDelete: 'cascade' }).notNull(),
    channel: interactionChannelEnum('channel').notNull(),
    direction: interactionDirectionEnum('direction').notNull(),
    content: text('content').notNull(),
    threadId: text('thread_id'),
    isPinned: boolean('is_pinned').default(false).notNull(),
    pinnedBy: text('pinned_by'),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_interactions_tenant_party').on(table.tenantId, table.partyId, table.createdAt),
    index('idx_interactions_thread').on(table.threadId),
  ]
);

export const partyMergeQueues = pgTable(
  'party_merge_queues',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    primaryPartyId: text('primary_party_id').references(() => parties.id, { onDelete: 'cascade' }).notNull(),
    duplicatePartyId: text('duplicate_party_id').references(() => parties.id, { onDelete: 'cascade' }).notNull(),
    confidenceScore: doublePrecision('confidence_score').notNull(),
    source: text('source').notNull(),
    status: text('status').default('pending_review').notNull(),
    reviewedBy: text('reviewed_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_merge_queue_tenant').on(table.tenantId, table.status),
  ]
);

export const partiesRelations = relations(parties, ({ one, many }) => ({
  tenant: one(tenants, { fields: [parties.tenantId], references: [tenants.id] }),
  vertical: one(verticals, { fields: [parties.verticalId], references: [verticals.id] }),
  assignedTo: one(users, { fields: [parties.assignedToId], references: [users.id] }),
  interactions: many(interactions),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  party: one(parties, { fields: [interactions.partyId], references: [parties.id] }),
}));
