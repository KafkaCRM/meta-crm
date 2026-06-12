import { Controller, Post, Body, Param, Headers, Logger, HttpCode, HttpStatus, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConnectionService } from './connection.service';
import { IntakePipelineService } from './intake-pipeline.service';

@Controller('web-to-lead')
export class WebToLeadController {
  private readonly logger = new Logger(WebToLeadController.name);

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly intakePipeline: IntakePipelineService,
  ) {}

  @Post(':tenantSlug')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Param('tenantSlug') tenantSlug: string,
    @Headers('x-source-key') sourceKey: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<{ success: boolean; lead_id?: string; error?: string }> {
    if (!sourceKey) {
      throw new ForbiddenException('Missing X-Source-Key header');
    }

    // Resolve tenant from slug
    let tenantId: string;
    try {
      const result = await this.connectionService.resolveTenantFromSlug(tenantSlug);
      if (!result) {
        throw new NotFoundException(`Tenant not found: ${tenantSlug}`);
      }
      tenantId = result;
    } catch {
      throw new NotFoundException(`Tenant not found: ${tenantSlug}`);
    }

    // Look up the web-to-lead connection for this tenant
    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(
      tenantId,
      'web-to-lead',
    );

    if (credsResult.isErr()) {
      throw new BadRequestException('Web-to-Lead is not configured for this workspace');
    }

    const creds = credsResult.value;
    const storedKey = creds.source_key;

    if (!storedKey || storedKey !== sourceKey) {
      this.logger.warn(`Web-to-Lead: invalid source key for tenant ${tenantSlug}`);
      throw new ForbiddenException('Invalid source key');
    }

    // Find the connection ID
    const connectionId = await this.connectionService.findConnectionId(tenantId, 'web-to-lead');
    if (!connectionId) {
      throw new NotFoundException('Web-to-Lead connection not found for this workspace');
    }

    // Parse form fields into flat key-value pairs
    const parsedFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      parsedFields[key] = String(value ?? '');
    }

    // Generate a unique provider event ID from a hash of the payload
    const payloadStr = JSON.stringify(body);
    const providerEventId = `w2l_${Buffer.from(payloadStr).toString('base64').substring(0, 32)}_${Date.now()}`;

    const result = await this.intakePipeline.processInboundEvent({
      connectionId,
      providerEventId,
      eventType: 'web_to_lead',
      rawPayload: body,
      parsedFields,
      tenantId,
    });

    if (result.isErr()) {
      this.logger.error(`Web-to-Lead intake failed for tenant ${tenantSlug}: ${result.error.message}`);
      return { success: false, error: result.error.message };
    }

    return {
      success: true,
      lead_id: result.value.entity_id ?? undefined,
    };
  }
}
