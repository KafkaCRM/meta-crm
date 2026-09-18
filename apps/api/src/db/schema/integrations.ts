import { pgTable, text, timestamp, jsonb, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { tenants } from './tenants';
import { campaigns } from './campaigns';
import { connectionStatusEnum, inboundEventStatusEnum } from './enums';

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    provider: text('provider').notNull(), // whatsapp | facebook | justdial | webhook | zapier
    name: text('name').notNull(),
    status: connectionStatusEnum('status').default('disconnected').notNull(),
    configJson: jsonb('config_json').default({}).notNull(),
    credentialsCipherText: text('credentials_cipher_text'),
    credentialsIv: text('credentials_iv'),
    credentialsTag: text('credentials_tag'),
    lastTestedAt: timestamp('last_tested_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_connections_tenant_provider').on(table.tenantId, table.provider),
    index('idx_connections_tenant_status').on(table.tenantId, table.status),
  ]
);

export const integrationIntakeRoutes = pgTable(
  'integration_intake_routes',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    connectionId: text('connection_id').references(() => integrationConnections.id, { onDelete: 'cascade' }).notNull(),
    priority: integer('priority').default(0).notNull(),
    mode: text('mode').default('create_lead').notNull(), // create_lead | create_contact
    campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    conditions: jsonb('conditions').default({}).notNull(),
    ownerId: text('owner_id'),
    assignmentRule: jsonb('assignment_rule').default({ type: 'fixed' }).notNull(),
    duplicateStrategy: text('duplicate_strategy').default('skip').notNull(), // skip | update | always_create
    duplicateMatchFields: jsonb('duplicate_match_fields').default(['email', 'phone']).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_intake_routes_conn').on(table.connectionId),
    index('idx_intake_routes_campaign').on(table.campaignId),
  ]
);

export const integrationFieldMappings = pgTable(
  'integration_field_mappings',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    routeId: text('route_id').references(() => integrationIntakeRoutes.id, { onDelete: 'cascade' }).notNull(),
    sourceField: text('source_field').notNull(),
    targetEntity: text('target_entity').notNull(), // lead | party
    targetField: text('target_field').notNull(),
    transform: text('transform'),
    isRequired: boolean('is_required').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_field_mappings_route').on(table.routeId),
  ]
);

export const inboundEvents = pgTable(
  'inbound_events',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    connectionId: text('connection_id').references(() => integrationConnections.id, { onDelete: 'cascade' }).notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    rawPayload: jsonb('raw_payload').notNull(),
    status: inboundEventStatusEnum('status').default('received').notNull(),
    resultEntityType: text('result_entity_type'),
    resultEntityId: text('result_entity_id'),
    errorMessage: text('error_message'),
    receivedAt: timestamp('received_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (table) => [
    uniqueIndex('idx_inbound_events_conn_provider').on(table.connectionId, table.providerEventId),
    index('idx_inbound_events_conn_status').on(table.connectionId, table.status),
    index('idx_inbound_events_received').on(table.receivedAt),
  ]
);

export const integrationDeliveryAttempts = pgTable(
  'integration_delivery_attempts',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    inboundEventId: text('inbound_event_id').references(() => inboundEvents.id, { onDelete: 'cascade' }).notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    action: text('action').notNull(),
    status: text('status').notNull(), // success | failure | retry
    errorDetail: jsonb('error_detail'),
    durationMs: integer('duration_ms'),
    attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_delivery_attempts_event').on(table.inboundEventId),
  ]
);

export const integrationSyncCursors = pgTable(
  'integration_sync_cursors',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    connectionId: text('connection_id').references(() => integrationConnections.id, { onDelete: 'cascade' }).notNull(),
    cursorValue: text('cursor_value').notNull(),
    lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_sync_cursors_conn').on(table.connectionId),
  ]
);

export const webhookSubscriptions = pgTable(
  'webhook_subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    url: text('url').notNull(),
    event: text('event').notNull(),
    secretRef: text('secret_ref').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('idx_webhook_subs_tenant').on(table.tenantId),
  ]
);

export const integrationConnectionsRelations = relations(integrationConnections, ({ one, many }) => ({
  tenant: one(tenants, { fields: [integrationConnections.tenantId], references: [tenants.id] }),
  intakeRoutes: many(integrationIntakeRoutes),
  inboundEvents: many(inboundEvents),
}));

export const integrationIntakeRoutesRelations = relations(integrationIntakeRoutes, ({ one, many }) => ({
  connection: one(integrationConnections, { fields: [integrationIntakeRoutes.connectionId], references: [integrationConnections.id] }),
  campaign: one(campaigns, { fields: [integrationIntakeRoutes.campaignId], references: [campaigns.id] }),
  fieldMappings: many(integrationFieldMappings),
}));
