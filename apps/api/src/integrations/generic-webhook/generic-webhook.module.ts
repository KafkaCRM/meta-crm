import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HooksModule } from '../../core/hooks/hooks.module';
import { SecretsModule } from '../../core/secrets/secrets.module';
import { RealtimeModule } from '../../core/realtime/realtime.module';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';
import { WebhookSubscriptionController } from './webhook-subscription.controller';

@Module({
  imports: [
    HooksModule,
    SecretsModule,
    RealtimeModule,
    BullModule.registerQueue({ name: 'webhook-delivery' }),
  ],
  controllers: [WebhookSubscriptionController],
  providers: [WebhookDispatcherService, WebhookDeliveryProcessor],
})
export class GenericWebhookModule {}
