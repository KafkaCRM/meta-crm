import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { SecretsService } from '../../core/secrets/secrets.service';
import { ConnectionService } from '../../core/integration/connection.service';
import { PartyUpsertService } from '../../core/party/party-upsert.service';
import { InteractionService } from '../../core/interaction/interaction.service';
import { HooksService } from '../../core/hooks/hooks.service';
import { RoomManagerService } from '../../core/realtime/room-manager.service';
import type { RequestScope } from '../../core/tenant/request-scope.interface';
import { PartySource } from '@meta-crm/types';

const APP_SECRET_REF = 'secret/platform/whatsapp/app_secret';

export interface WhatsAppIncomingMessage {
  from_phone: string;
  message: string;
  conversation_id: string;
  timestamp: Date;
  metadata: { whatsapp_message_id: string; phone_number_id?: string };
}

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly secrets: SecretsService,
    private readonly connectionService: ConnectionService,
    private readonly partyUpsert: PartyUpsertService,
    private readonly interaction: InteractionService,
    private readonly hooks: HooksService,
    private readonly roomManager: RoomManagerService,
  ) {}

  async verifySignature(rawBody: string, signatureHeader: string | undefined): Promise<boolean> {
    if (!signatureHeader) return false;

    const expected = signatureHeader.replace('sha256=', '');
    const secretResult = await this.secrets.get(APP_SECRET_REF);
    if (secretResult.isErr()) {
      this.logger.warn(`Failed to resolve WhatsApp app secret: ${secretResult.error.code}`);
      return false;
    }

    const computed = createHmac('sha256', secretResult.value)
      .update(rawBody)
      .digest('hex');

    if (expected.length !== computed.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(computed));
  }

  parsePayload(body: Record<string, unknown>): WhatsAppIncomingMessage | null {
    const entry = (body['entry'] as Array<Record<string, unknown>> | undefined)?.[0];
    if (!entry) return null;

    const changes = (entry['changes'] as Array<Record<string, unknown>> | undefined)?.[0];
    if (!changes) return null;

    const value = changes['value'] as Record<string, unknown> | undefined;
    if (!value) return null;

    const metadataField = value['metadata'] as Record<string, unknown> | undefined;
    const phoneNumberId = metadataField?.['phone_number_id'] as string | undefined;

    const messages = value['messages'] as Array<Record<string, unknown>> | undefined;
    if (!messages || messages.length === 0) return null;

    const msg = messages[0]!;
    const from = msg['from'] as string | undefined;
    const textBody = (msg['text'] as Record<string, unknown> | undefined)?.['body'] as string | undefined;
    const whatsappMsgId = msg['id'] as string | undefined;
    const contacts = value['contacts'] as Array<Record<string, unknown>> | undefined;
    const conversation = value['metadata'] as Record<string, unknown> | undefined;
    const conversationId = (conversation?.['conversation_id'] as string) ?? whatsappMsgId ?? '';

    if (!from || !textBody) return null;

    return {
      from_phone: from,
      message: textBody,
      conversation_id: conversationId,
      timestamp: new Date(),
      metadata: { whatsapp_message_id: whatsappMsgId ?? '', phone_number_id: phoneNumberId },
    };
  }

  async resolveTenantFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    return this.connectionService.resolveTenantForProvider('whatsapp', {
      phone_number_id: phoneNumberId,
    });
  }

  async processIncoming(
    parsed: WhatsAppIncomingMessage,
    scope: RequestScope,
  ): Promise<void> {
    const upsertResult = await this.partyUpsert.upsertByPhone(
      parsed.from_phone,
      {
        name: '',
        vertical_id: scope.vertical_ids?.[0] ?? '',
      },
      PartySource.WhatsApp,
      scope,
    );

    if (upsertResult.isErr()) {
      this.logger.error(`Failed to upsert party for WhatsApp message: ${upsertResult.error.code}`);
      return;
    }

    const party = upsertResult.value.party;
    if (!party) return;

    const interactionResult = await this.interaction.create({
      party_id: party.id,
      channel: 'whatsapp',
      direction: 'inbound',
      content: parsed.message,
      thread_id: parsed.conversation_id,
      metadata: parsed.metadata,
    });

    if (interactionResult.isErr()) {
      this.logger.error(`Failed to create interaction for WhatsApp message: ${interactionResult.error.code}`);
      return;
    }

    const interaction = interactionResult.value;

    await this.hooks.emit('integration:whatsapp:message_received', {
      tenant_id: scope.tenant_id,
      interaction_id: interaction.id,
      party_id: party.id,
      party_name: party.name,
      channel: 'whatsapp',
      conversation_id: parsed.conversation_id,
    });

    if (party.assigned_to_id) {
      this.roomManager.broadcastToUser(party.assigned_to_id, 'interaction:received', {
        interaction_id: interaction.id,
        party_id: party.id,
        party_name: party.name,
        channel: 'whatsapp',
      });
    }

    this.logger.log(`Processed WhatsApp message from ${parsed.from_phone} (party: ${party.id})`);
  }
}
