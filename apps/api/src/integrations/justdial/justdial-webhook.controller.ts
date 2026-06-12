import { Controller, Post, Body, Headers, Logger, HttpCode, HttpStatus, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConnectionService } from '../../core/integration/connection.service';
import { JustDialWebhookService } from './justdial-webhook.service';

@Controller('webhooks/justdial')
export class JustDialWebhookController {
  private readonly logger = new Logger(JustDialWebhookController.name);

  constructor(
    private readonly jdService: JustDialWebhookService,
    private readonly connectionService: ConnectionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-api-key') apiKey: string | undefined,
    @Headers('x-client-id') clientId: string | undefined,
  ): Promise<{ success: boolean; enquiry_id?: string; error?: string }> {
    if (!apiKey || !clientId) {
      throw new ForbiddenException('Missing x-api-key or x-client-id header');
    }

    const tenantId = await this.jdService.resolveTenantFromClientId(clientId);
    if (!tenantId) {
      throw new ForbiddenException('Unknown client_id');
    }

    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'justdial');
    if (credsResult.isErr()) {
      throw new BadRequestException('JustDial not configured');
    }

    const creds = credsResult.value;
    if (!this.jdService.verifyApiKey(apiKey, creds.api_key ?? '')) {
      throw new ForbiddenException('Invalid API key');
    }

    const parsed = this.jdService.parsePayload(body);
    if (!parsed) {
      this.logger.warn('JustDial webhook: unrecognized payload');
      return { success: false, error: 'Unrecognized payload' };
    }

    const enquiryId = parsed['jd.enquiry_id'] ?? `jd_${Date.now()}`;

    const result = await this.jdService.processEnquiry(tenantId, enquiryId, parsed, body);

    return {
      success: result.success,
      ...(result.entity_id ? { enquiry_id: result.entity_id } : {}),
      ...(result.error ? { error: result.error } : {}),
    };
  }
}
