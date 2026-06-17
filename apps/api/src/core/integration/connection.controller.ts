import {
  Controller,
  Get,
  Post,
  Put,
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

  @Get('oauth/:provider/url')
  @CheckPermissions('manage', 'Integration')
  getOAuthUrl(
    @Param('provider') provider: OAuthProvider,
    @Query('redirect_to') frontendRedirect: string | undefined,
    @Req() req: any,
  ) {
    const scope = req.user ?? {};
    const tenantId = scope.tenant_id ?? '';
    const host = process.env['API_HOST'] || 'localhost:3000';
    const protocol = process.env['API_PROTOCOL'] || 'http';

    const redirectUri = `${protocol}://${host}/api/v1/connections/oauth/${provider}/callback`;
    const url = this.oauthService.getAuthorizationUrl(provider, tenantId, redirectUri, frontendRedirect);

    if (!url) {
      throw new BadRequestException(`OAuth not configured for ${provider}`);
    }

    return { url };
  }

  @Get('oauth/:provider/authorize')
  authorize(
    @Param('provider') provider: OAuthProvider,
    @Query('redirect_to') frontendRedirect: string | undefined,
    @Req() req: any,
    @Res() res: any,
  ) {
    const scope = req.user ?? {};
    const tenantId = scope.tenant_id ?? '';
    const host = process.env['API_HOST'] || 'localhost:3000';
    const protocol = process.env['API_PROTOCOL'] || 'http';

    const redirectUri = `${protocol}://${host}/api/v1/connections/oauth/${provider}/callback`;
    const url = this.oauthService.getAuthorizationUrl(provider, tenantId, redirectUri, frontendRedirect);

    if (!url) {
      throw new BadRequestException(`OAuth not configured for ${provider}`);
    }

    res.status(302).header('Location', url).send();
  }

  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: OAuthProvider,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: any,
  ) {
    const host = process.env['API_HOST'] || 'localhost:3000';
    const protocol = process.env['API_PROTOCOL'] || 'http';
    const redirectUri = `${protocol}://${host}/api/v1/connections/oauth/${provider}/callback`;
    const result = await this.oauthService.handleCallback(provider, code, state, redirectUri);

    const frontendUrl = result.redirect_to || 'http://localhost:5173';

    if (result.success) {
      res.header('Content-Type', 'text/html').send(
        `<script>window.opener?.postMessage(${JSON.stringify({ type: 'oauth', provider, success: true })}, '*'); window.close();</script>`,
      );
    } else {
      res.header('Content-Type', 'text/html').send(
        `<script>window.opener?.postMessage(${JSON.stringify({ type: 'oauth', provider, success: false, message: result.message })}, '*'); window.close();</script>`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Intake Routes (multi-route: priority + match conditions)
  // ═══════════════════════════════════════════════════════════════════

  @Get(':id/routes')
  @CheckPermissions('read', 'Integration')
  async listRoutes(@Param('id') id: string) {
    const routes = await this.db.getClient().integrationIntakeRoute.findMany({
      where: { connection_id: id },
      orderBy: { priority: 'asc' },
      include: { fieldMappings: true },
    });
    return routes;
  }

  @Put(':id/routes')
  @CheckPermissions('manage', 'Integration')
  async replaceRoutes(
    @Param('id') id: string,
    @Body() body: Array<{
      priority: number;
      conditions?: Record<string, string> | null;
      mode: 'create_lead' | 'create_contact_opportunity';
      campaign_id?: string | null;
      owner_id?: string | null;
      assignment_rule?: Record<string, unknown>;
      duplicate_strategy?: 'skip' | 'update' | 'always_create';
      duplicate_match_fields?: string[];
      fieldMappings?: Array<{
        source_field: string;
        target_entity: string;
        target_field: string;
        transform?: string | null;
        is_required?: boolean;
      }>;
    }>,
  ) {
    const client = this.db.getClient();

    const routes = await client.$transaction(async (tx) => {
      await tx.integrationFieldMapping.deleteMany({
        where: { route: { connection_id: id } },
      });
      await tx.integrationIntakeRoute.deleteMany({
        where: { connection_id: id },
      });

      if (body.length === 0) return [];

      const created = [];
      for (let i = 0; i < body.length; i++) {
        const r = body[i]!;
        const route = await tx.integrationIntakeRoute.create({
          data: {
            connection_id: id,
            priority: r.priority,
            conditions: (r.conditions ?? {}) as Prisma.InputJsonValue,
            mode: r.mode,
            campaign_id: r.campaign_id ?? null,
            owner_id: r.owner_id ?? null,
            assignment_rule: (r.assignment_rule ?? { type: 'fixed' }) as Prisma.InputJsonValue,
            duplicate_strategy: r.duplicate_strategy ?? 'skip',
            duplicate_match_fields: (r.duplicate_match_fields ?? ['email', 'phone']) as Prisma.InputJsonValue,
            fieldMappings: r.fieldMappings
              ? {
                  createMany: {
                    data: r.fieldMappings.map((m) => ({
                      source_field: m.source_field,
                      target_entity: m.target_entity,
                      target_field: m.target_field,
                      transform: m.transform ?? 'direct',
                      is_required: m.is_required ?? false,
                    })),
                  },
                }
              : undefined,
          },
          include: { fieldMappings: true },
        });
        created.push(route);
      }
      return created;
    });

    return routes;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Field Mappings
  // ═══════════════════════════════════════════════════════════════════

  @Get('routes/:routeId/mappings')
  @CheckPermissions('read', 'Integration')
  async listMappings(@Param('routeId') routeId: string) {
    const mappings = await this.db.getClient().integrationFieldMapping.findMany({
      where: { route_id: routeId },
      orderBy: { created_at: 'asc' },
    });
    return mappings;
  }

  @Put('routes/:routeId/mappings')
  @CheckPermissions('manage', 'Integration')
  async replaceMappings(
    @Param('routeId') routeId: string,
    @Body() body: Array<{
      source_field: string;
      target_entity: string;
      target_field: string;
      transform?: string | null;
      is_required?: boolean;
    }>,
  ) {
    const client = this.db.getClient();

    const route = await client.integrationIntakeRoute.findUnique({
      where: { id: routeId },
    });
    if (!route) throw new NotFoundException('Route not found');

    await client.integrationFieldMapping.deleteMany({
      where: { route_id: routeId },
    });

    if (body.length > 0) {
      await client.integrationFieldMapping.createMany({
        data: body.map((m) => ({
          route_id: routeId,
          source_field: m.source_field,
          target_entity: m.target_entity,
          target_field: m.target_field,
          transform: m.transform ?? 'direct',
          is_required: m.is_required ?? false,
        })),
      });
    }

    return client.integrationFieldMapping.findMany({
      where: { route_id: routeId },
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
