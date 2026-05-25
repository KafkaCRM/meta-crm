import type { TenantRole, PlatformRole } from '@meta-crm/types';

export interface RequestScope {
  user_id: string;
  tenant_id: string;
  assignment_ids: string[];
  role: TenantRole;
  platform_role?: PlatformRole | undefined;
  vertical_ids?: string[];
}
