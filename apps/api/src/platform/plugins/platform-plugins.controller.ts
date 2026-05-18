import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsObject } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPlatformPermissions } from '../../core/permissions/permissions.decorator';
import { PlatformPluginsService } from './platform-plugins.service';

class CreatePluginBody {
  @IsString()
  package_name!: string;

  @IsString()
  version!: string;

  @IsObject()
  manifest!: Record<string, unknown>;
}

@Controller('platform/plugins')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformPluginsController {
  constructor(private readonly service: PlatformPluginsService) {}

  @Get()
  @CheckPlatformPermissions('read', 'PlatformPlugin')
  async list() {
    const result = await this.service.list();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPlatformPermissions('manage', 'PlatformPlugin')
  async create(@Body() body: CreatePluginBody) {
    const result = await this.service.create(body);
    if (result.isErr()) {
      if (result.error.code === 'INVALID_MANIFEST') {
        throw new BadRequestException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':id/deprecate')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformPlugin')
  async deprecate(@Param('id') id: string) {
    const result = await this.service.deprecate(id);
    if (result.isErr()) {
      if (result.error.code === 'PLUGIN_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Plugin deprecated' };
  }

  @Patch(':id/disable')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformPlugin')
  async disable(@Param('id') id: string) {
    const result = await this.service.disable(id);
    if (result.isErr()) {
      if (result.error.code === 'PLUGIN_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'Plugin disabled' };
  }
}
