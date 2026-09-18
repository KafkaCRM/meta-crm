import type { TenantRole, PlatformRole } from '@meta-crm/types';

export interface RequestScope {
  user_id: string;
  tenant_id: string;
  email?: string;
  role: TenantRole | PlatformRole | string;
  platform_role?: PlatformRole | string;
  branch_id?: string;
  branch_ids?: string[];
  vertical_ids: string[];
  assignment_ids: string[];
  is_impersonating?: boolean;
  admin_user_id?: string;
}

export type HonoVariables = {
  scope: RequestScope;
};

export type AppEnv = {
  Variables: HonoVariables;
};
