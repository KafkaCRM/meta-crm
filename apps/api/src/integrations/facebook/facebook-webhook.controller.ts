import { Controller, Post, Get, Body, Headers, Query, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ConnectionService } from '../../core/integration/connection.service';
import { FacebookWebhookService } from './facebook-webhook.service';

@Controller('webhooks/facebook')
export class FacebookWebhookController {
  private readonly logger = new Logger(FacebookWebhookController.name);

  constructor(
    private readonly fbService: FacebookWebhookService,
    private readonly connectionService: ConnectionService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
  ): string | { error: string } {
    const expectedToken = process.env['FACEBOOK_WEBHOOK_VERIFY_TOKEN'] ?? 'meta_crm_verify';

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Facebook webhook verification succeeded');
      return challenge;
    }

    this.logger.warn(`Facebook webhook verification failed: mode=${mode}, token=${verifyToken}`);
    return { error: 'Verification failed' };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ): Promise<{ success: boolean; processed: number; errors: string[] }> {
    const rawBody = JSON.stringify(body);

    const parsed = this.fbService.parseWebhookPayload(body);
    if (!parsed) {
      this.logger.warn('Facebook webhook: unrecognized payload structure');
      return { success: true, processed: 0, errors: [] };
    }

    const tenantId = await this.fbService.resolveTenantFromPageId(parsed.pageId);
    if (!tenantId) {
      this.logger.warn(`Facebook webhook: no tenant found for page ${parsed.pageId}`);
      return { success: true, processed: 0, errors: ['No tenant configured for this page'] };
    }

    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'facebook');
    const appSecret = credsResult.isOk() ? credsResult.value.app_secret : undefined;

    if (appSecret) {
      const isValid = this.fbService.verifySignature(rawBody, signature, appSecret);
      if (!isValid) {
        this.logger.warn(`Facebook webhook: invalid signature for tenant ${tenantId}`);
        return { success: false, processed: 0, errors: ['Invalid signature'] };
      }
    } else {
      this.logger.warn(`Facebook webhook: no app_secret configured for tenant ${tenantId}, skipping signature verification`);
    }

    const accessToken = credsResult.isOk() ? credsResult.value.access_token : undefined;
    if (!accessToken) {
      return { success: false, processed: 0, errors: ['No access token configured'] };
    }

    const errors: string[] = [];
    let processed = 0;

    for (const leadgenId of parsed.leadgenIds) {
      const result = await this.fbService.processLead(tenantId, parsed.pageId, leadgenId, accessToken);
      if (result.success) {
        processed++;
      } else {
        errors.push(`leadgen ${leadgenId}: ${result.error}`);
      }
    }

    return { success: true, processed, errors };
  }
}
