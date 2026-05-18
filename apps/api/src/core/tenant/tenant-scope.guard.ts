import { Injectable, CanActivate, ForbiddenException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RequestScope } from './request-scope.interface';
import { PlatformPrismaService } from './platform-prisma.service';

@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(
    private readonly cls: ClsService,
    private readonly platformDb: PlatformPrismaService,
  ) {}

  async canActivate(): Promise<boolean> {
    const scope = this.cls.get<RequestScope>('scope');

    if (!scope?.tenant_id) {
      return true;
    }

    const tenant = await this.platformDb.client.tenant.findUnique({
      where: { id: scope.tenant_id },
      select: { status: true },
    });

    if (!tenant || tenant.status === 'suspended') {
      throw new ForbiddenException('Tenant access denied');
    }

    return true;
  }
}
