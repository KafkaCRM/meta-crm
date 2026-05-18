import { PlatformRole } from '@meta-crm/types';
import type { PlatformAction, PlatformSubject } from './types';

export interface PlatformPermissionDefinition {
  action: PlatformAction;
  resource: PlatformSubject;
}

export const PLATFORM_ROLE_MAP: Record<PlatformRole, PlatformPermissionDefinition[]> = {
  [PlatformRole.PlatformOwner]: [
    { action: 'manage', resource: 'PlatformTenant' },
    { action: 'manage', resource: 'PlatformPlan' },
    { action: 'manage', resource: 'PlatformPlugin' },
    { action: 'manage', resource: 'PlatformReport' },
    { action: 'manage', resource: 'PlatformUser' },
    { action: 'manage', resource: 'SystemHealth' },
    { action: 'manage', resource: 'Billing' },
  ],

  [PlatformRole.PlatformAdmin]: [
    { action: 'manage', resource: 'PlatformTenant' },
    { action: 'manage', resource: 'PlatformPlan' },
    { action: 'manage', resource: 'PlatformPlugin' },
    { action: 'manage', resource: 'PlatformReport' },
    { action: 'manage', resource: 'PlatformUser' },
    { action: 'manage', resource: 'SystemHealth' },
    { action: 'read', resource: 'Billing' },
    { action: 'update', resource: 'Billing' },
  ],

  [PlatformRole.PlatformSupport]: [
    { action: 'read', resource: 'PlatformTenant' },
    { action: 'read', resource: 'PlatformPlan' },
    { action: 'read', resource: 'PlatformPlugin' },
    { action: 'read', resource: 'PlatformUser' },
    { action: 'read', resource: 'SystemHealth' },
  ],

  [PlatformRole.PlatformSales]: [
    { action: 'create', resource: 'PlatformTenant' },
    { action: 'read', resource: 'PlatformTenant' },
    { action: 'update', resource: 'PlatformTenant' },
    { action: 'read', resource: 'PlatformPlan' },
    { action: 'update', resource: 'PlatformPlan' },
    { action: 'assign', resource: 'PlatformPlan' },
  ],

  [PlatformRole.PlatformBilling]: [
    { action: 'read', resource: 'PlatformTenant' },
    { action: 'create', resource: 'PlatformPlan' },
    { action: 'read', resource: 'PlatformPlan' },
    { action: 'update', resource: 'PlatformPlan' },
    { action: 'read', resource: 'Billing' },
    { action: 'update', resource: 'Billing' },
  ],

  [PlatformRole.PlatformDeveloper]: [
    { action: 'manage', resource: 'PlatformPlugin' },
  ],

  [PlatformRole.PlatformOps]: [
    { action: 'read', resource: 'PlatformReport' },
    { action: 'read', resource: 'SystemHealth' },
  ],
};
