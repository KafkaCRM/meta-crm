import {
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { PluginService } from './plugin.service';

@Controller('plugins')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PluginController {
  constructor(private readonly pluginService: PluginService) {}

  @Get()
  @CheckPermissions('read', 'Plugin')
  async listPlugins() {
    const result = await this.pluginService.listPlugins();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post(':id/install')
  @CheckPermissions('manage', 'Plugin')
  @HttpCode(HttpStatus.OK)
  async installPlugin(@Param('id') id: string) {
    const result = await this.pluginService.installPlugin(id);
    if (result.isErr()) {
      const error = result.error;
      switch (error.code) {
        case 'NOT_FOUND':
          throw new NotFoundException(error);
        case 'TENANT_NOT_FOUND':
        case 'ALREADY_INSTALLED':
        case 'PLAN_LOCKED':
        case 'LIMIT_EXCEEDED':
          throw new BadRequestException(error);
        default:
          throw new InternalServerErrorException(error);
      }
    }
    return result.value;
  }

  @Post(':id/uninstall')
  @CheckPermissions('manage', 'Plugin')
  @HttpCode(HttpStatus.OK)
  async uninstallPlugin(@Param('id') id: string) {
    const result = await this.pluginService.uninstallPlugin(id);
    if (result.isErr()) {
      const error = result.error;
      switch (error.code) {
        case 'NOT_FOUND':
          throw new NotFoundException(error);
        case 'TENANT_NOT_FOUND':
          throw new BadRequestException(error);
        default:
          throw new InternalServerErrorException(error);
      }
    }
    return result.value;
  }
}
