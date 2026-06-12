-- CreateTable: IntegrationConnection
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "credentials_cipher_text" TEXT,
    "credentials_iv" TEXT,
    "credentials_tag" TEXT,
    "last_tested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IntegrationConnection
CREATE INDEX "IntegrationConnection_tenant_id_status_idx" ON "IntegrationConnection"("tenant_id", "status");
CREATE UNIQUE INDEX "IntegrationConnection_tenant_id_provider_key" ON "IntegrationConnection"("tenant_id", "provider");

-- CreateTable: IntegrationIntakeRoute
CREATE TABLE "IntegrationIntakeRoute" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'create_lead',
    "campaign_id" TEXT,
    "branch_brand_assignment_id" TEXT,
    "vertical_id" TEXT,
    "pipeline_id" TEXT,
    "entry_stage_id" TEXT,
    "owner_id" TEXT,
    "assignment_rule" JSONB NOT NULL DEFAULT '{"type":"fixed"}',
    "duplicate_strategy" TEXT NOT NULL DEFAULT 'skip',
    "duplicate_match_fields" JSONB NOT NULL DEFAULT '["email","phone"]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationIntakeRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IntegrationIntakeRoute
CREATE INDEX "IntegrationIntakeRoute_campaign_id_idx" ON "IntegrationIntakeRoute"("campaign_id");
CREATE UNIQUE INDEX "IntegrationIntakeRoute_connection_id_key" ON "IntegrationIntakeRoute"("connection_id");

-- CreateTable: IntegrationFieldMapping
CREATE TABLE "IntegrationFieldMapping" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "source_field" TEXT NOT NULL,
    "target_entity" TEXT NOT NULL,
    "target_field" TEXT NOT NULL,
    "transform" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IntegrationFieldMapping
CREATE INDEX "IntegrationFieldMapping_route_id_idx" ON "IntegrationFieldMapping"("route_id");

-- CreateTable: InboundEvent
CREATE TABLE "InboundEvent" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "result_entity_type" TEXT,
    "result_entity_id" TEXT,
    "error_message" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: InboundEvent
CREATE INDEX "InboundEvent_connection_id_status_idx" ON "InboundEvent"("connection_id", "status");
CREATE INDEX "InboundEvent_received_at_idx" ON "InboundEvent"("received_at");
CREATE UNIQUE INDEX "InboundEvent_connection_id_provider_event_id_key" ON "InboundEvent"("connection_id", "provider_event_id");

-- CreateTable: IntegrationDeliveryAttempt
CREATE TABLE "IntegrationDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "inbound_event_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_detail" JSONB,
    "duration_ms" INTEGER,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IntegrationDeliveryAttempt
CREATE INDEX "IntegrationDeliveryAttempt_inbound_event_id_idx" ON "IntegrationDeliveryAttempt"("inbound_event_id");
CREATE INDEX "IntegrationDeliveryAttempt_status_idx" ON "IntegrationDeliveryAttempt"("status");

-- CreateTable: IntegrationSyncCursor
CREATE TABLE "IntegrationSyncCursor" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "cursor_value" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationSyncCursor_pkey" PRIMARY KEY ("id");

-- CreateIndex: IntegrationSyncCursor
CREATE UNIQUE INDEX "IntegrationSyncCursor_connection_id_key" ON "IntegrationSyncCursor"("connection_id");

-- AddForeignKey: IntegrationConnection
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: IntegrationIntakeRoute
ALTER TABLE "IntegrationIntakeRoute" ADD CONSTRAINT "IntegrationIntakeRoute_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntegrationIntakeRoute" ADD CONSTRAINT "IntegrationIntakeRoute_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationIntakeRoute" ADD CONSTRAINT "IntegrationIntakeRoute_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "PipelineDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationIntakeRoute" ADD CONSTRAINT "IntegrationIntakeRoute_entry_stage_id_fkey" FOREIGN KEY ("entry_stage_id") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationIntakeRoute" ADD CONSTRAINT "IntegrationIntakeRoute_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: IntegrationFieldMapping
ALTER TABLE "IntegrationFieldMapping" ADD CONSTRAINT "IntegrationFieldMapping_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "IntegrationIntakeRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: InboundEvent
ALTER TABLE "InboundEvent" ADD CONSTRAINT "InboundEvent_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: IntegrationDeliveryAttempt
ALTER TABLE "IntegrationDeliveryAttempt" ADD CONSTRAINT "IntegrationDeliveryAttempt_inbound_event_id_fkey" FOREIGN KEY ("inbound_event_id") REFERENCES "InboundEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: IntegrationSyncCursor
ALTER TABLE "IntegrationSyncCursor" ADD CONSTRAINT "IntegrationSyncCursor_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
