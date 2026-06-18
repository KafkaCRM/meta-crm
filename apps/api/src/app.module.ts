import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './core/auth/auth.module';
import { TenantModule } from './core/tenant/tenant.module';
import { PartyModule } from './core/party/party.module';
import { HooksModule } from './core/hooks/hooks.module';
import { RealtimeModule } from './core/realtime/realtime.module';
import { InteractionModule } from './core/interaction/interaction.module';
import { MetadataModule } from './core/metadata/metadata.module';
import { ReportModule } from './core/report/report.module';
import { PluginModule } from './core/plugin/plugin.module';
import { PlatformModule } from './platform/platform.module';
import { GenericWebhookModule } from './integrations/generic-webhook/generic-webhook.module';
import { WhatsAppModule } from './integrations/whatsapp/whatsapp.module';
import { FacebookModule } from './integrations/facebook/facebook.module';
import { JustDialModule } from './integrations/justdial/justdial.module';
import { EnrollmentModule } from './capabilities/enrollment/enrollment.module';
import { CapabilityModule } from './core/capability/capability.module';
import { AppointmentModule } from './capabilities/appointment/appointment.module';
import { BillingModule } from './capabilities/billing/billing.module';
import { PropertyModule } from './capabilities/property/property.module';
import { OrderManagementModule } from './capabilities/order-management/order-management.module';
import { CustomerOnboardingModule } from './capabilities/customer-onboarding/customer-onboarding.module';
import { UserModule } from './core/user/user.module';
import { BranchModule } from './core/branch/branch.module';
import { VerticalModule } from './core/vertical/vertical.module';
import { CampaignModule } from './core/campaign/campaign.module';
import { WorkflowModule } from './core/workflow/workflow.module';
import { IntegrationModule } from './core/integration/integration.module';
import { LeadModule } from './core/lead/lead.module';

const CAPABILITY_MODULES = [
  EnrollmentModule,
  AppointmentModule,
  BillingModule,
  PropertyModule,
  OrderManagementModule,
  CustomerOnboardingModule,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    BullModule.forRoot({
      connection: {
        url: process.env['REDIS_URL'] || 'redis://localhost:6379',
        maxRetriesPerRequest: null,
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    TenantModule,
    AuthModule,
    PartyModule,
    HooksModule,
    RealtimeModule,
    InteractionModule,
    MetadataModule,
    ReportModule,
    PluginModule,
    PlatformModule,
    GenericWebhookModule,
    WhatsAppModule,
    FacebookModule,
    JustDialModule,
    CapabilityModule,
    UserModule,
    BranchModule,
    VerticalModule,
    CampaignModule,
    WorkflowModule,
    IntegrationModule,
    LeadModule,
    ...CAPABILITY_MODULES,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}


