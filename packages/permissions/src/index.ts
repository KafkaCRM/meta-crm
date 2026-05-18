export type {
  TenantAction,
  TenantSubject,
  TenantAbility,
  PlatformAction,
  PlatformSubject,
  PlatformAbility,
} from './types';

export type { PermissionDefinition } from './system-role-maps';
export type { PlatformPermissionDefinition } from './platform-role-maps';

export { SYSTEM_ROLE_MAP } from './system-role-maps';
export { PLATFORM_ROLE_MAP } from './platform-role-maps';
export { buildTenantAbility } from './tenant-ability';
export type { TenantRoleEntry } from './tenant-ability';
export { buildPlatformAbility } from './platform-ability';
