import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { IsString, IsEmail } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPlatformPermissions } from '../../core/permissions/permissions.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { PlatformTeamService } from './platform-team.service';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

class InviteBody {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  role!: string;
}

class ChangeRoleBody {
  @IsString()
  role!: string;
}

@Controller('platform/team')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformTeamController {
  constructor(private readonly service: PlatformTeamService) {}

  @Get()
  @CheckPlatformPermissions('read', 'PlatformUser')
  async list() {
    const result = await this.service.list();
    if (result.isErr()) {
      throw new InternalServerErrorException(result.error);
    }
    return result.value;
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @CheckPlatformPermissions('create', 'PlatformUser')
  async invite(
    @Body() body: InviteBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.invite(
      { name: body.name, email: body.email, role: body.role as any },
      scope,
      {
        actor_id: scope.user_id,
        actor_role: scope.platform_role || scope.role,
        actor_ip: req.ip,
        user_agent: (req.headers['user-agent'] as string) || '',
      },
    );
    if (result.isErr()) {
      switch (result.error.code) {
        case 'ROLE_ESCALATION':
          throw new ForbiddenException(result.error);
        case 'EMAIL_TAKEN':
          throw new ConflictException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return result.value;
  }

  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('manage', 'PlatformUser')
  async changeRole(
    @Param('id') id: string,
    @Body() body: ChangeRoleBody,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.changeRole(id, body.role as any, scope, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      switch (result.error.code) {
        case 'USER_NOT_FOUND':
          throw new NotFoundException(result.error);
        case 'ROLE_ESCALATION':
          throw new ForbiddenException(result.error);
        default:
          throw new InternalServerErrorException(result.error);
      }
    }
    return { message: 'Role updated' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('delete', 'PlatformUser')
  async deactivate(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() scope: RequestScope,
  ) {
    const result = await this.service.deactivate(id, {
      actor_id: scope.user_id,
      actor_role: scope.platform_role || scope.role,
      actor_ip: req.ip,
      user_agent: (req.headers['user-agent'] as string) || '',
    });
    if (result.isErr()) {
      if (result.error.code === 'USER_NOT_FOUND') {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }
    return { message: 'User deactivated' };
  }
}
