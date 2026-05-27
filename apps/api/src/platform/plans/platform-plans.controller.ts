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
  Req,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPlatformPermissions } from '../../core/permissions/permissions.decorator';
import { PlatformPlansService } from './platform-plans.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

class CreatePlanBody {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(1)
  max_branches!: number;

  @IsNumber()
  @Min(1)
  max_users!: number;

  @IsNumber()
  @Min(0)
  max_plugins!: number;

  @IsOptional()
  @IsNumber()
  price_monthly?: number;
}

class UpdatePlanBody {
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_branches?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_users?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_plugins?: number;

  @IsOptional()
  @IsNumber()
  price_monthly?: number;
}

class AssignPlanBody {
  @IsString()
  plan_id!: string;
}

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformPlansController {
  constructor(private readonly service: PlatformPlansService) {}

  @Get('plans')
  @CheckPlatformPermissions('read', 'PlatformPlan')
  async list() {
    const result = await this.service.list();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  @CheckPlatformPermissions('create', 'PlatformPlan')
  async create(
    @Body() body: CreatePlanBody,
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
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Patch('plans/:id')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformPlan')
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePlanBody,
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
      if (result.error.code === 'PLAN_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post('tenants/:id/assign-plan')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('assign', 'PlatformPlan')
  async assignPlan(
    @Param('id') tenantId: string,
    @Body() body: AssignPlanBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.assignPlan(tenantId, body.plan_id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      switch (result.error.code) {
        case 'TENANT_NOT_FOUND':
        case 'PLAN_NOT_FOUND':
          throw new NotFoundException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return { message: 'Plan assigned' };
  }
}
