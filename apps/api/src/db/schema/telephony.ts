import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants, users } from './tenants';
import { parties } from './core';
import { leads } from './leads';

export const callLogs = pgTable(
  'call_logs',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    partyId: text('party_id').references(() => parties.id, { onDelete: 'set null' }),
    leadId: text('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    direction: text('direction').notNull(), // inbound | outbound
    durationSeconds: integer('duration_seconds').default(0).notNull(),
    recordingUrl: text('recording_url'),
    status: text('status').default('completed').notNull(),
    outcome: text('outcome'), // connected | missed | voicemail | busy
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_call_logs_tenant').on(table.tenantId),
    index('idx_call_logs_party').on(table.partyId),
    index('idx_call_logs_lead').on(table.leadId),
  ]
);

export const callLogsRelations = relations(callLogs, ({ one }) => ({
  party: one(parties, { fields: [callLogs.partyId], references: [parties.id] }),
  lead: one(leads, { fields: [callLogs.leadId], references: [leads.id] }),
  user: one(users, { fields: [callLogs.userId], references: [users.id] }),
}));
