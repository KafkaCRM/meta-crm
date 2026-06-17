import { Module } from '@nestjs/common';
import { HooksModule } from '../../core/hooks/hooks.module';
import { IntegrationModule } from '../../core/integration/integration.module';
import { RealtimeModule } from '../../core/realtime/realtime.module';
import { PartyModule } from '../../core/party/party.module';
import { InteractionModule } from '../../core/interaction/interaction.module';
import { SecretsModule } from '../../core/secrets/secrets.module';
import { WhatsAppAdapter } from './whatsapp-adapter';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

@Module({
  imports: [
    HooksModule,
    IntegrationModule,
    RealtimeModule,
    PartyModule,
    InteractionModule,
    SecretsModule,
  ],
  controllers: [WhatsAppWebhookController],
  providers: [
    WhatsAppAdapter,
    WhatsAppWebhookService,
    {
      provide: 'MESSAGING_ADAPTER',
      useExisting: WhatsAppAdapter,
    },
  ],
  exports: [WhatsAppAdapter, 'MESSAGING_ADAPTER'],
})
export class WhatsAppModule {}
