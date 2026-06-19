import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPlatformPermissions } from '../../core/permissions/permissions.decorator';
import { PricingService } from './pricing.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

class UpsertPricingBody {
  @IsNumber()
  @Min(0)
  price_monthly!: number;

  @IsNumber()
  @Min(0)
  price_per_user!: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@Controller('platform/capabilities/pricing')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Get()
  @CheckPlatformPermissions('read', 'Billing')
  async list() {
    return this.service.list();
  }

  @Put(':capabilityId')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'Billing')
  async upsert(
    @Param('capabilityId') capabilityId: string,
    @Body() body: UpsertPricingBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.upsert(capabilityId, body, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error) {
        throw new BadRequestException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Delete(':capabilityId')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('manage', 'Billing')
  async remove(
    @Param('capabilityId') capabilityId: string,
  ) {
    const result = await this.service.delete(capabilityId);
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }
}
