import {
  Controller, Post, Get, Param, Body, Headers, Query,
  Logger, HttpCode, HttpStatus,
  NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { ConnectionService } from './connection.service';
import { IntakePipelineService } from './intake-pipeline.service';

@Controller('intake')
export class IntakeController {
  private readonly logger = new Logger(IntakeController.name);

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly intakePipeline: IntakePipelineService,
  ) {}

  @Post(':provider/:token')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Param('provider') provider: string,
    @Param('token') token: string,
    @Body() body: Record<string, unknown>,
  ): Promise<{ success: boolean; lead_id?: string; error?: string }> {
    if (!token) {
      throw new BadRequestException('Missing token');
    }

    const connection = await this.connectionService.findByUrlToken(provider, token);
    if (!connection) {
      throw new NotFoundException('Integration not found or inactive');
    }

    const parsedFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      parsedFields[key] = String(value ?? '');
    }

    const payloadStr = JSON.stringify(body);
    const providerEventId = `${provider}_${Buffer.from(payloadStr).toString('base64').substring(0, 32)}_${Date.now()}`;

    const result = await this.intakePipeline.processInboundEvent({
      connectionId: connection.id,
      providerEventId,
      eventType: `${provider.replace('-', '_')}`,
      rawPayload: body,
      parsedFields,
      tenantId: connection.tenant_id,
    });

    if (result.isErr()) {
      this.logger.error(`${provider} intake failed: ${result.error.message}`);
      return { success: false, error: result.error.message };
    }

    return {
      success: true,
      lead_id: result.value.entity_id ?? undefined,
    };
  }
}
