import { Module } from '@nestjs/common';
import { AuthModule } from './core/auth/auth.module';
import { TenantModule } from './core/tenant/tenant.module';
import { PartyModule } from './core/party/party.module';
import { HooksModule } from './core/hooks/hooks.module';
import { RealtimeModule } from './core/realtime/realtime.module';
import { CaseModule } from './core/case/case.module';
import { InteractionModule } from './core/interaction/interaction.module';
import { MetadataModule } from './core/metadata/metadata.module';
import { ReportModule } from './core/report/report.module';
import { PlatformModule } from './platform/platform.module';
import { GenericWebhookModule } from './integrations/generic-webhook/generic-webhook.module';
import { WhatsAppModule } from './integrations/whatsapp/whatsapp.module';

@Module({
  imports: [
    TenantModule,
    AuthModule,
    PartyModule,
    HooksModule,
    RealtimeModule,
    CaseModule,
    InteractionModule,
    MetadataModule,
    ReportModule,
    PlatformModule,
    GenericWebhookModule,
    WhatsAppModule,
    // Core modules added in TASK-006 through TASK-014
    // Capability modules added in TASK-030+
    // Integration modules added in TASK-016, TASK-017+
    // Platform modules added in TASK-015
  ],
})
export class AppModule {}
