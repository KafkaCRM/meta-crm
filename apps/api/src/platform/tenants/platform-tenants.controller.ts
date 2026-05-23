import {
  Controller,
  Get,
  Post,
  Patch,
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
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min, Max, IsEmail, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPlatformPermissions } from '../../core/permissions/permissions.decorator';
import { PlatformTenantsService } from './platform-tenants.service';

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
  constructor(private readonly service: PlatformTenantsService) {}

  @Get()
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async list(@Query() query: TenantListQuery) {
    const result = await this.service.list(query);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
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
  async create(@Body() body: CreateTenantBody) {
    const result = await this.service.create(body);
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
  async suspend(@Param('id') id: string) {
    const result = await this.service.suspend(id);
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
  async reactivate(@Param('id') id: string) {
    const result = await this.service.reactivate(id);
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
  ) {
    const result = await this.service.updateEntitlements(id, body.plugin_ids);
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
  ) {
    const result = await this.service.updateCapabilities(id, body.capabilities);
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
  async resetOwnerPassword(@Param('id') id: string) {
    const result = await this.service.resetOwnerPassword(id);
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id/overrides')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async updateOverrides(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    const result = await this.service.updateOverrides(id, body);
    if (result.isErr()) {
      if (result.error.code === 'TENANT_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
