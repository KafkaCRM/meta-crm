import { Ability, AbilityBuilder } from '@casl/ability';
import { PlatformRole } from '@meta-crm/types';
import { PLATFORM_ROLE_MAP } from './platform-role-maps';
import type { PlatformAbility } from './types';

export function buildPlatformAbility(platformRole: PlatformRole): PlatformAbility {
  const { can, build } = new AbilityBuilder<PlatformAbility>(Ability);

  const permissions = PLATFORM_ROLE_MAP[platformRole];
  if (permissions) {
    for (const perm of permissions) {
      can(perm.action, perm.resource);
    }
  }

  return build();
}
