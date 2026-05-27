import { Ability, AbilityBuilder } from '@casl/ability';
import { TenantRole } from '@meta-crm/types';
import { SYSTEM_ROLE_MAP } from './system-role-maps';
import type { TenantAction, TenantSubject } from './types';

export interface TenantRoleEntry {
  role: TenantRole | string;
}

type TenantAbility = Ability<[TenantAction, TenantSubject], Record<string, any>>;

const DEFAULT_PERMISSIONS = [
  { action: 'create' as TenantAction, resource: 'Party' as TenantSubject },
  { action: 'read' as TenantAction, resource: 'Party' as TenantSubject },
  { action: 'update' as TenantAction, resource: 'Party' as TenantSubject },
  { action: 'create' as TenantAction, resource: 'Case' as TenantSubject },
  { action: 'read' as TenantAction, resource: 'Case' as TenantSubject },
  { action: 'update' as TenantAction, resource: 'Case' as TenantSubject },
  { action: 'create' as TenantAction, resource: 'Interaction' as TenantSubject },
  { action: 'read' as TenantAction, resource: 'Interaction' as TenantSubject },
  { action: 'read' as TenantAction, resource: 'Plugin' as TenantSubject },
];

export function buildTenantAbility(
  roles: TenantRoleEntry[],
  assignments: string[],
): TenantAbility {
  const { can, build } = new AbilityBuilder<TenantAbility>(Ability);

  if (roles.length === 0) {
    for (const perm of DEFAULT_PERMISSIONS) {
      can(perm.action, perm.resource);
    }
    return build();
  }

  let matchedAny = false;

  for (const entry of roles) {
    let roleKey = entry.role;
    if (roleKey === 'admin' || roleKey === 'tenant_admin') {
      roleKey = TenantRole.Admin;
    } else if (roleKey === 'owner' || roleKey === 'tenant_owner') {
      roleKey = TenantRole.Owner;
    } else if (roleKey === 'member' || roleKey === 'branch_user') {
      roleKey = TenantRole.Member;
    } else if (roleKey === 'manager' || roleKey === 'branch_manager' || roleKey === 'brand_manager') {
      roleKey = TenantRole.Manager;
    } else if (roleKey === 'viewer') {
      roleKey = TenantRole.Viewer;
    }

    const permissions = SYSTEM_ROLE_MAP[roleKey as TenantRole];
    if (!permissions) continue;

    matchedAny = true;

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

  if (!matchedAny) {
    for (const perm of DEFAULT_PERMISSIONS) {
      can(perm.action, perm.resource);
    }
  }

  return build();
}
