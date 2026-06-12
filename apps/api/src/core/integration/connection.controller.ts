import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpStatus,
  UseGuards,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpCode,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { ConnectionService, INTEGRATION_MANIFESTS } from './connection.service';
import { OAuthService, OAuthProvider } from './oauth.service';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';

@Controller('connections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConnectionController {
  constructor(
    private readonly connectionService: ConnectionService,
    private readonly oauthService: OAuthService,
    private readonly db: TenantScopedPrismaService,
  ) {}

  @Get()
  @CheckPermissions('read', 'Integration')
  async list() {
    const result = await this.connectionService.listConnections();
    if (result.isErr()) throw new InternalServerErrorException(result.error);
    return { data: result.value, manifests: INTEGRATION_MANIFESTS };
  }

  @Get(':id')
  @CheckPermissions('read', 'Integration')
  async get(@Param('id') id: string) {
    const result = await this.connectionService.getConnection(id);
    if (result.isErr()) {
      if (result.error.code === 'CONNECTION_NOT_FOUND') throw new NotFoundException(result.error);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':provider/connect')
  @CheckPermissions('manage', 'Integration')
  @HttpCode(HttpStatus.OK)
  async connect(
    @Param('provider') provider: string,
    @Body() body: { credentials?: Record<string, string>; config_json?: Record<string, unknown> },
  ) {
    const result = await this.connectionService.connect(
      provider,
      body.credentials ?? {},
      body.config_json ?? {},
    );
    if (result.isErr()) {
      if (result.error.code === 'PROVIDER_NOT_FOUND') throw new NotFoundException(result.error);
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Delete(':id')
  @CheckPermissions('manage', 'Integration')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Param('id') id: string) {
    const result = await this.connectionService.disconnect(id);
    if (result.isErr()) {
      if (result.error.code === 'CONNECTION_NOT_FOUND') throw new NotFoundException(result.error);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':id/test')
  @CheckPermissions('manage', 'Integration')
  @HttpCode(HttpStatus.OK)
  async test(@Param('id') id: string) {
    const result = await this.connectionService.testConnection(id);
    if (result.isErr()) {
      if (result.error.code === 'CONNECTION_NOT_FOUND') throw new NotFoundException(result.error);
      if (result.error.code === 'NOT_CONNECTED') throw new BadRequestException(result.error);
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  // ═══════════════════════════════════════════════════════════════════
  // OAuth
  // ═══════════════════════════════════════════════════════════════════

  @Get('oauth/:provider/authorize')
  @CheckPermissions('manage', 'Integration')
  authorize(
    @Param('provider') provider: OAuthProvider,
    @Req() req: any,
    @Res() res: any,
  ) {
    const scope = req.user ?? {};
    const tenantId = scope.tenant_id ?? '';
    const host = req.hostname || req.headers?.host || 'localhost:3000';
    const protocol = (req.protocol || 'http') as string;

    const redirectUri = `${protocol}://${host}/api/v1/connections/oauth/${provider}/callback`;
    const url = this.oauthService.getAuthorizationUrl(provider, tenantId, redirectUri);

    if (!url) {
      throw new BadRequestException(`OAuth not configured for ${provider}`);
    }

    res.status(302).header('Location', url).send();
  }

  @Get('oauth/:provider/callback')
  @CheckPermissions('manage', 'Integration')
  async oauthCallback(
    @Param('provider') provider: OAuthProvider,
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: any,
  ) {
    const host = req.hostname || req.headers?.host || 'localhost:3000';
    const protocol = (req.protocol || 'http') as string;
    const redirectUri = `${protocol}://${host}/api/v1/connections/oauth/${provider}/callback`;
    const result = await this.oauthService.handleCallback(provider, code, state, redirectUri);

    if (result.success) {
      return { success: true, message: result.message };
    }
    throw new BadRequestException(result.message);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Intake Routes
  // ═══════════════════════════════════════════════════════════════════

  @Get(':id/route')
  @CheckPermissions('read', 'Integration')
  async getRoute(@Param('id') id: string) {
    const route = await this.db.getClient().integrationIntakeRoute.findUnique({
      where: { connection_id: id },
      include: { fieldMappings: true },
    });
    if (!route) throw new NotFoundException('No intake route configured for this connection');
    return route;
  }

  @Post(':id/route')
  @CheckPermissions('manage', 'Integration')
  async upsertRoute(
    @Param('id') id: string,
    @Body() body: {
      mode?: 'create_lead' | 'create_contact_opportunity';
      campaign_id?: string | null;
      branch_brand_assignment_id?: string | null;
      vertical_id?: string | null;
      pipeline_id?: string | null;
      entry_stage_id?: string | null;
      owner_id?: string | null;
      assignment_rule?: Record<string, unknown>;
      duplicate_strategy?: 'skip' | 'update' | 'always_create';
      duplicate_match_fields?: string[];
      is_default?: boolean;
    },
  ) {
    const route = await this.db.getClient().integrationIntakeRoute.upsert({
      where: { connection_id: id },
      create: {
        connection_id: id,
        mode: body.mode ?? 'create_lead',
        campaign_id: body.campaign_id ?? null,
        branch_brand_assignment_id: body.branch_brand_assignment_id ?? null,
        vertical_id: body.vertical_id ?? null,
        pipeline_id: body.pipeline_id ?? null,
        entry_stage_id: body.entry_stage_id ?? null,
        owner_id: body.owner_id ?? null,
        assignment_rule: (body.assignment_rule ?? { type: 'fixed' }) as Prisma.InputJsonValue,
        duplicate_strategy: body.duplicate_strategy ?? 'skip',
        duplicate_match_fields: (body.duplicate_match_fields ?? ['email', 'phone']) as Prisma.InputJsonValue,
        is_default: body.is_default ?? false,
      },
      update: {
        mode: body.mode ?? undefined,
        campaign_id: body.campaign_id,
        branch_brand_assignment_id: body.branch_brand_assignment_id,
        vertical_id: body.vertical_id,
        pipeline_id: body.pipeline_id,
        entry_stage_id: body.entry_stage_id,
        owner_id: body.owner_id,
        assignment_rule: (body.assignment_rule ?? undefined) as Prisma.InputJsonValue | undefined,
        duplicate_strategy: body.duplicate_strategy,
        duplicate_match_fields: body.duplicate_match_fields as Prisma.InputJsonValue | undefined,
        is_default: body.is_default,
      },
    });

    return route;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Field Mappings
  // ═══════════════════════════════════════════════════════════════════

  @Get(':id/mappings')
  @CheckPermissions('read', 'Integration')
  async listMappings(@Param('id') id: string) {
    const route = await this.db.getClient().integrationIntakeRoute.findUnique({
      where: { connection_id: id },
    });
    if (!route) throw new NotFoundException('No intake route configured');

    return this.db.getClient().integrationFieldMapping.findMany({
      where: { route_id: route.id },
      orderBy: { created_at: 'asc' },
    });
  }

  @Post(':id/mappings')
  @CheckPermissions('manage', 'Integration')
  async upsertMappings(
    @Param('id') id: string,
    @Body() body: Array<{
      source_field: string;
      target_entity: string;
      target_field: string;
      transform?: string | null;
      is_required?: boolean;
    }>,
  ) {
    const route = await this.db.getClient().integrationIntakeRoute.findUnique({
      where: { connection_id: id },
    });
    if (!route) throw new NotFoundException('No intake route configured');

    // Delete existing mappings and replace with new set
    await this.db.getClient().integrationFieldMapping.deleteMany({
      where: { route_id: route.id },
    });

    if (body.length > 0) {
      await this.db.getClient().integrationFieldMapping.createMany({
        data: body.map((m) => ({
          route_id: route.id,
          source_field: m.source_field,
          target_entity: m.target_entity,
          target_field: m.target_field,
          transform: m.transform ?? 'direct',
          is_required: m.is_required ?? false,
        })),
      });
    }

    return this.db.getClient().integrationFieldMapping.findMany({
      where: { route_id: route.id },
      orderBy: { created_at: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Inbound Events
  // ═══════════════════════════════════════════════════════════════════

  @Get(':id/events')
  @CheckPermissions('read', 'Integration')
  async listEvents(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '50', 10), 100);

    const events = await this.db.getClient().inboundEvent.findMany({
      where: { connection_id: id },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { received_at: 'desc' },
      include: {
        deliveryAttempts: {
          orderBy: { attempted_at: 'asc' },
        },
      },
    });

    const hasMore = events.length > take;
    const data = hasMore ? events.slice(0, take) : events;

    return {
      data,
      ...(hasMore ? { next_cursor: data[data.length - 1]?.id } : {}),
    };
  }

  @Post(':id/events/:eventId/retry')
  @CheckPermissions('manage', 'Integration')
  async retryEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
  ) {
    const event = await this.db.getClient().inboundEvent.findFirst({
      where: { id: eventId, connection_id: id },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'failed') throw new BadRequestException('Only failed events can be retried');

    // Reset status and re-process would require re-triggering the webhook
    // For now, this marks the event for manual review
    await this.db.getClient().inboundEvent.update({
      where: { id: eventId },
      data: { status: 'received', error_message: null },
    });

    return { success: true, message: 'Event queued for reprocessing' };
  }
}
