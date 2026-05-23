import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './core/auth/auth.module';
import { TenantModule } from './core/tenant/tenant.module';
import { PartyModule } from './core/party/party.module';
import { HooksModule } from './core/hooks/hooks.module';
import { RealtimeModule } from './core/realtime/realtime.module';
import { CaseModule } from './core/case/case.module';
import { InteractionModule } from './core/interaction/interaction.module';
import { MetadataModule } from './core/metadata/metadata.module';
import { ReportModule } from './core/report/report.module';
import { PluginModule } from './core/plugin/plugin.module';
import { PlatformModule } from './platform/platform.module';
import { GenericWebhookModule } from './integrations/generic-webhook/generic-webhook.module';
import { WhatsAppModule } from './integrations/whatsapp/whatsapp.module';
import { EnrollmentModule } from './capabilities/enrollment/enrollment.module';
import { CapabilityModule } from './core/capability/capability.module';
import { AppointmentModule } from './capabilities/appointment/appointment.module';
import { BillingModule } from './capabilities/billing/billing.module';
import { PropertyModule } from './capabilities/property/property.module';
import { OrderManagementModule } from './capabilities/order-management/order-management.module';
import { CustomerOnboardingModule } from './capabilities/customer-onboarding/customer-onboarding.module';
import { UserModule } from './core/user/user.module';
import { BranchModule } from './core/branch/branch.module';

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
      },
    }),
    TenantModule,
    AuthModule,
    PartyModule,
    HooksModule,
    RealtimeModule,
    CaseModule,
    InteractionModule,
    MetadataModule,
    ReportModule,
    PluginModule,
    PlatformModule,
    GenericWebhookModule,
    WhatsAppModule,
    CapabilityModule,
    UserModule,
    BranchModule,
    ...CAPABILITY_MODULES,
  ],
})
export class AppModule {}
