import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import type { TenantAction, TenantSubject, PlatformAction, PlatformSubject } from '@meta-crm/permissions';
import { CHECK_PERMISSIONS_KEY, CHECK_PLATFORM_PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionsService } from './permissions.service';
import type { RequestScope } from '../tenant/request-scope.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.get<{ action: TenantAction; resource: TenantSubject } | undefined>(
      CHECK_PERMISSIONS_KEY,
      context.getHandler(),
    );

    if (!requirement) return true;

    const scope = this.cls.get<RequestScope>('scope');
    if (!scope) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: requirement.resource,
        action: requirement.action,
      });
    }

    const ability = await this.permissionsService.getTenantAbility(scope);

    if (!ability.can(requirement.action, requirement.resource)) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: requirement.resource,
        action: requirement.action,
      });
    }

    return true;
  }
}

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.get<{ action: PlatformAction; resource: PlatformSubject } | undefined>(
      CHECK_PLATFORM_PERMISSIONS_KEY,
      context.getHandler(),
    );

    if (!requirement) return true;

    const scope = this.cls.get<RequestScope>('scope');
    if (!scope) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: requirement.resource,
        action: requirement.action,
      });
    }

    const ability = this.permissionsService.getPlatformAbility(scope);

    if (!ability.can(requirement.action, requirement.resource)) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: requirement.resource,
        action: requirement.action,
      });
    }

    return true;
  }
}
