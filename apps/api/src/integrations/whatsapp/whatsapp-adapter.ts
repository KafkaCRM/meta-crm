import { Injectable, Logger } from '@nestjs/common';
import type { Result } from 'neverthrow';
import { ok, err } from 'neverthrow';
import { ConnectionService } from '../../core/integration/connection.service';
import type { MessagingAdapter, AdapterError } from '../../core/communication/messaging-adapter.interface';

@Injectable()
export class WhatsAppAdapter implements MessagingAdapter {
  private readonly logger = new Logger(WhatsAppAdapter.name);

  constructor(private readonly connectionService: ConnectionService) {}

  async send(params: {
    to: string;
    message: string;
    tenant_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<Result<{ message_id: string }, AdapterError>> {
    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(
      params.tenant_id,
      'whatsapp',
    );

    if (credsResult.isErr()) {
      return err({
        code: 'ADAPTER_CREDENTIALS_MISSING',
        provider: 'whatsapp',
        detail: `Failed to resolve credentials: ${credsResult.error.message}`,
      });
    }

    const creds = credsResult.value;
    const apiKey = creds.api_key;
    const phoneNumberId = creds.phone_number_id;

    if (!apiKey || !phoneNumberId) {
      return err({
        code: 'ADAPTER_CREDENTIALS_MISSING',
        provider: 'whatsapp',
        detail: 'Missing api_key or phone_number_id in stored credentials',
      });
    }

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: params.to,
          type: 'text',
          text: { body: params.message },
        }),
      });
    } catch (fetchError) {
      return err({
        code: 'ADAPTER_SEND_FAILED',
        provider: 'whatsapp',
        detail: `Network error: ${(fetchError as Error).message}`,
      });
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return err({
        code: 'ADAPTER_SEND_FAILED',
        provider: 'whatsapp',
        detail: `HTTP ${response.status}: ${errorBody}`,
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    const messages = data['messages'] as Array<Record<string, unknown>> | undefined;
    const messageId = messages?.[0]?.['id'] as string | undefined;

    if (!messageId) {
      return err({
        code: 'ADAPTER_SEND_FAILED',
        provider: 'whatsapp',
        detail: 'No message_id in WhatsApp API response',
      });
    }

    this.logger.log(`WhatsApp message sent to ${params.to} (id: ${messageId})`);
    return ok({ message_id: messageId });
  }
}
