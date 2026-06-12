import { Module } from '@nestjs/common';
import { IntegrationModule } from '../../core/integration/integration.module';
import { FacebookWebhookService } from './facebook-webhook.service';
import { FacebookWebhookController } from './facebook-webhook.controller';
import { FacebookAdapter } from './facebook-adapter';

@Module({
  imports: [IntegrationModule],
  controllers: [FacebookWebhookController],
  providers: [FacebookWebhookService, FacebookAdapter],
  exports: [FacebookAdapter],
})
export class FacebookModule {}
