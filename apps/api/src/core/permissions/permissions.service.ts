import { Injectable } from '@nestjs/common';
import { Ability } from '@casl/ability';
import { buildTenantAbility, buildPlatformAbility } from '@meta-crm/permissions';
import type { TenantAbility, PlatformAbility } from '@meta-crm/permissions';
import type { PlatformRole, TenantRole } from '@meta-crm/types';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { PermissionCacheService } from './permission-cache.service';
import type { RequestScope } from '../tenant/request-scope.interface';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cache: PermissionCacheService,
  ) {}

  async getTenantAbility(scope: RequestScope): Promise<TenantAbility> {
    try {
      const cachedRules = await this.cache.getRules(scope.user_id, scope.tenant_id);
      if (cachedRules) {
        return new Ability(cachedRules as any) as unknown as TenantAbility;
      }
    } catch (err: any) {
      console.warn(`Failed to read from permission cache: ${err?.message || err}. Falling back to database.`);
    }

    const userRoles = await this.db.getClient().userRole.findMany({
      where: { user_id: scope.user_id, tenant_id: scope.tenant_id },
      include: { role: true },
    });

    const roleEntries = userRoles
      .filter((ur) => ur.role.is_system_role)
      .map((ur) => ({ role: ur.role.slug as TenantRole }));

    const ability = buildTenantAbility(roleEntries, scope.assignment_ids);

    if (userRoles.length > 0) {
      try {
        await this.cache.setRules(scope.user_id, scope.tenant_id, ability.rules);
      } catch (err: any) {
        console.warn(`Failed to write to permission cache: ${err?.message || err}`);
      }
    }

    return ability;
  }

  getPlatformAbility(scope: RequestScope): PlatformAbility {
    const platformRole = scope.platform_role!;
    return buildPlatformAbility(platformRole);
  }
}
