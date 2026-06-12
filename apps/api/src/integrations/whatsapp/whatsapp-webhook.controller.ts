import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import type { RequestScope } from '../../core/tenant/request-scope.interface';
import { TenantRole } from '@meta-crm/types';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly whatsappService: WhatsAppWebhookService,
    private readonly cls: ClsService,
  ) {}

  @Post()
  async handleWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ): Promise<{ success: boolean }> {
    const rawBody = JSON.stringify(body);
    const isValid = await this.whatsappService.verifySignature(rawBody, signature);

    if (!isValid) {
      this.logger.warn('Invalid WhatsApp webhook signature — rejecting but returning 200');
      return { success: false };
    }

    const parsed = this.whatsappService.parsePayload(body);
    if (!parsed) {
      this.logger.warn('Invalid WhatsApp webhook payload — returning 200');
      return { success: false };
    }

    const scope = this.cls.get<RequestScope>('scope');

    if (scope?.tenant_id) {
      await this.whatsappService.processIncoming(parsed, scope);
    } else {
      // Bug fix: resolve tenant from phone_number_id in IntegrationConnection config_json
      const phoneNumberId = parsed.metadata.phone_number_id;
      const resolvedTenantId = phoneNumberId
        ? await this.whatsappService.resolveTenantFromPhoneNumberId(phoneNumberId)
        : null;

      if (!resolvedTenantId) {
        this.logger.error('WhatsApp webhook received but tenant could not be resolved — rejecting');
        return { success: false };
      }

      await this.cls.run(async () => {
        const resolvedScope = {
          tenant_id: resolvedTenantId,
          user_id: '',
          assignment_ids: [],
          role: TenantRole.Member,
          vertical_ids: [],
        } as RequestScope;
        this.cls.set('scope', resolvedScope);
        await this.whatsappService.processIncoming(parsed, resolvedScope);
      });
    }

    return { success: true };
  }
}
