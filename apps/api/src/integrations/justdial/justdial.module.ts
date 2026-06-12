import { Module } from '@nestjs/common';
import { IntegrationModule } from '../../core/integration/integration.module';
import { JustDialWebhookService } from './justdial-webhook.service';
import { JustDialWebhookController } from './justdial-webhook.controller';
import { JustDialAdapter } from './justdial-adapter';

@Module({
  imports: [IntegrationModule],
  controllers: [JustDialWebhookController],
  providers: [JustDialWebhookService, JustDialAdapter],
  exports: [JustDialAdapter],
})
export class JustDialModule {}
