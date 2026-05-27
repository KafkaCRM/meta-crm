import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { CheckPermissions } from '../permissions/permissions.decorator';
import { CapabilityService } from './capability.service';

class ToggleCapabilityBody {
  @IsBoolean()
  enabled!: boolean;
}

@Controller('capabilities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CapabilityController {
  constructor(private readonly capabilityService: CapabilityService) {}

  @Get()
  @CheckPermissions('read', 'Plugin')
  async listCapabilities() {
    const result = await this.capabilityService.listCapabilities();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch(':type/:name')
  @CheckPermissions('manage', 'Plugin')
  @HttpCode(HttpStatus.OK)
  async toggleCapabilityMultipart(
    @Param('type') type: string,
    @Param('name') name: string,
    @Body() body: ToggleCapabilityBody,
  ) {
    const id = `${type}/${name}`;
    const result = await this.capabilityService.toggleCapability(id, body.enabled);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Patch(':id')
  @CheckPermissions('manage', 'Plugin')
  @HttpCode(HttpStatus.OK)
  async toggleCapabilitySimple(
    @Param('id') id: string,
    @Body() body: ToggleCapabilityBody,
  ) {
    const result = await this.capabilityService.toggleCapability(id, body.enabled);
    if (result.isErr()) {
      if (result.error.code === 'NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return result.value;
  }
}
