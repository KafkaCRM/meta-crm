import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
  Req,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min, Max, IsEmail, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPlatformPermissions } from '../../core/permissions/permissions.decorator';
import { PlatformTenantsService } from './platform-tenants.service';
import { ProvisioningStreamService, ProvisioningEvent } from './provisioning-stream.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import type { RequestScope } from '../../core/tenant/request-scope.interface';
import { AuthService } from '../../core/auth/auth.service';
import { AVAILABLE_CAPABILITIES } from '../../core/capability/capability.service';

class DangerousActionBody {
  @IsOptional()
  @IsString()
  reason?: string;
}

class OwnerDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;
}

class CreateTenantBody {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsString()
  industry!: string;

  @IsString()
  plan_id!: string;

  @ValidateNested()
  @Type(() => OwnerDto)
  owner!: OwnerDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsString()
  session_id?: string;
}

class TenantListQuery {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

class UpdateTenantBody {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  industry?: string;
}

class ApplyTemplateBody {
  @IsString()
  industry!: string;
}

class UpdateEntitlementsBody {
  @IsArray()
  @IsString({ each: true })
  plugin_ids!: string[];
}

class UpdateCapabilitiesBody {
  @IsArray()
  @IsString({ each: true })
  capabilities!: string[];
}

@Controller('platform/tenants')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformTenantsController {
  constructor(
    private readonly service: PlatformTenantsService,
    private readonly authService: AuthService,
    private readonly streamService: ProvisioningStreamService,
  ) {}

  @Sse('provision-stream')
  @CheckPlatformPermissions('create', 'PlatformTenant')
  stream(@Query('session') session: string): Observable<MessageEvent> {
    if (!session) {
      throw new BadRequestException('Session parameter is required');
    }
    return this.streamService.getOrCreateStream(session).pipe(
      map((event: ProvisioningEvent) => ({ data: event } as MessageEvent))
    );
  }

  @Get()
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async list(@Query() query: TenantListQuery) {
    const result = await this.service.list(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get('capabilities')
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async listAvailableCapabilities() {
    return AVAILABLE_CAPABILITIES;
  }

  @Get(':id')
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findOne(id);
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPlatformPermissions('create', 'PlatformTenant')
  async create(
    @Body() body: CreateTenantBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.create(body, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      switch (result.error.code) {
        case 'SLUG_TAKEN':
          throw new ConflictException(result.error);
        case 'PLAN_NOT_FOUND':
          throw new NotFoundException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return result.value;
  }

  @Patch(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async suspend(
    @Param('id') id: string,
    @Body() body: DangerousActionBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.suspend(id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
      reason: body.reason,
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Tenant suspended' };
  }

  @Patch(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async reactivate(
    @Param('id') id: string,
    @Body() body: DangerousActionBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.reactivate(id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
      reason: body.reason,
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Tenant reactivated' };
  }

  @Post(':id/apply-template')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async applyTemplate(@Param('id') id: string, @Body() body: ApplyTemplateBody) {
    const result = await this.service.applyTemplate(id, body.industry);
    if (result.isErr()) {
      switch (result.error.code) {
        case 'TENANT_NOT_FOUND':
          throw new NotFoundException(result.error);
        case 'INDUSTRY_NOT_FOUND':
          throw new BadRequestException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return { message: 'Template applied' };
  }

  @Patch(':id/entitlements')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'Billing')
  async updateEntitlements(
    @Param('id') id: string,
    @Body() body: UpdateEntitlementsBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.updateEntitlements(id, body.plugin_ids, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id/capabilities')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async updateCapabilities(
    @Param('id') id: string,
    @Body() body: UpdateCapabilitiesBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.updateCapabilities(id, body.capabilities, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id/reset-owner-password')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async resetOwnerPassword(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.resetOwnerPassword(id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id/pause')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async pause(
    @Param('id') id: string,
    @Body() body: DangerousActionBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.pause(id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
      reason: body.reason,
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Tenant paused' };
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async cancel(
    @Param('id') id: string,
    @Body() body: DangerousActionBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.cancel(id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
      reason: body.reason,
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Tenant cancelled' };
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('manage', 'PlatformTenant')
  async deactivate(
    @Param('id') id: string,
    @Body() body: DangerousActionBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.deactivate(id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
      reason: body.reason,
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Tenant deactivated' };
  }

  @Patch(':id/overrides')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async updateOverrides(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.updateOverrides(id, body, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id/capabilities')
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async getCapabilities(@Param('id') id: string) {
    const result = await this.service.getCapabilities(id);
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':id/capabilities/:capabilityId/enable')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async enableCapabilitySimple(
    @Param('id') id: string,
    @Param('capabilityId') capabilityId: string,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.enableCapability(id, capabilityId, scope.user_id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Post(':id/capabilities/:type/:name/enable')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async enableCapabilityMultipart(
    @Param('id') id: string,
    @Param('type') type: string,
    @Param('name') name: string,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const capabilityId = `${type}/${name}`;
    const result = await this.service.enableCapability(id, capabilityId, scope.user_id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Post(':id/capabilities/:capabilityId/disable')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('manage', 'PlatformTenant')
  async disableCapabilitySimple(
    @Param('id') id: string,
    @Param('capabilityId') capabilityId: string,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.disableCapability(id, capabilityId, scope.user_id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Post(':id/capabilities/:type/:name/disable')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('manage', 'PlatformTenant')
  async disableCapabilityMultipart(
    @Param('id') id: string,
    @Param('type') type: string,
    @Param('name') name: string,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const capabilityId = `${type}/${name}`;
    const result = await this.service.disableCapability(id, capabilityId, scope.user_id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateTenantBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.update(id, body, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      switch (result.error.code) {
        case 'TENANT_NOT_FOUND':
          throw new NotFoundException(result.error);
        case 'SLUG_TAKEN':
          throw new ConflictException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return result.value;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('manage', 'PlatformTenant')
  async remove(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.delete(id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id/plugins')
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async getPlugins(@Param('id') id: string) {
    const result = await this.service.getPlugins(id);
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':id/plugins/:pluginId/install')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async installPlugin(
    @Param('id') id: string,
    @Param('pluginId') pluginId: string,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.installPlugin(id, pluginId, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      if (result.error.code === 'PLAN_LIMIT_EXCEEDED') {
        throw new BadRequestException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':id/plugins/:pluginId/uninstall')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('manage', 'PlatformTenant')
  async uninstallPlugin(
    @Param('id') id: string,
    @Param('pluginId') pluginId: string,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.uninstallPlugin(id, pluginId, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Get(':id/hierarchy')
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async getHierarchy(@Param('id') id: string) {
    const result = await this.service.getHierarchy(id);
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':id/impersonate')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async impersonate(
    @Param('id') id: string,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.authService.impersonateTenant(id, scope.user_id);
    if (result.isErr()) {
      switch (result.error.code) {
        case 'TENANT_NOT_FOUND':
          throw new NotFoundException(result.error);
        case 'ACCOUNT_SUSPENDED':
          throw new BadRequestException(result.error);
        case 'USER_NOT_IN_TENANT':
          throw new NotFoundException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return result.value;
  }
}
