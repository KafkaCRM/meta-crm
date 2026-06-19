import { Module } from '@nestjs/common';
import { CallLogsController } from './call-logs.controller';
import { CallLogsService } from './call-logs.service';
import { TwilioService } from './twilio.service';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { TenantModule } from '../../core/tenant/tenant.module';
import { CapabilityModule } from '../../core/capability/capability.module';
import { IntegrationModule } from '../../core/integration/integration.module';

@Module({
  imports: [TenantModule, CapabilityModule, IntegrationModule],
  controllers: [CallLogsController, TwilioWebhookController],
  providers: [CallLogsService, TwilioService],
  exports: [CallLogsService, TwilioService],
})
export class TelephonyModule {}
