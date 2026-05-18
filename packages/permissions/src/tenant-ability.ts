import { Ability, AbilityBuilder } from '@casl/ability';
import { TenantRole } from '@meta-crm/types';
import { SYSTEM_ROLE_MAP } from './system-role-maps';
import type { TenantAction, TenantSubject } from './types';

export interface TenantRoleEntry {
  role: TenantRole;
}

type TenantAbility = Ability<[TenantAction, TenantSubject], Record<string, any>>;

export function buildTenantAbility(
  roles: TenantRoleEntry[],
  assignments: string[],
): TenantAbility {
  const { can, build } = new AbilityBuilder<TenantAbility>(Ability);

  for (const entry of roles) {
    const permissions = SYSTEM_ROLE_MAP[entry.role];
    if (!permissions) continue;

    for (const perm of permissions) {
      if (perm.conditions?.own_assignment_only) {
        can(perm.action, perm.resource, {
          branch_brand_assignment_id: { $in: assignments },
        });
      } else {
        can(perm.action, perm.resource);
      }
    }
  }

  return build();
}
