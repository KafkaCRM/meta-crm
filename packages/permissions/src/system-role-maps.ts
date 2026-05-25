import { TenantRole } from '@meta-crm/types';
import type { TenantAction, TenantSubject } from './types';

export interface PermissionDefinition {
  action: TenantAction;
  resource: TenantSubject;
  conditions?: Record<string, unknown>;
}

export const SYSTEM_ROLE_MAP: Record<TenantRole, PermissionDefinition[]> = {
  [TenantRole.BranchUser]: [
    { action: 'create', resource: 'Party' },
    { action: 'read', resource: 'Party' },
    { action: 'update', resource: 'Party' },
    { action: 'create', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'read', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'update', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'create', resource: 'Interaction' },
    { action: 'read', resource: 'Interaction' },
    { action: 'read', resource: 'Vertical' },
    { action: 'read', resource: 'Campaign' },
  ],

  [TenantRole.BranchSupervisor]: [
    { action: 'create', resource: 'Party' },
    { action: 'read', resource: 'Party' },
    { action: 'update', resource: 'Party' },
    { action: 'create', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'read', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'update', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'create', resource: 'Interaction' },
    { action: 'read', resource: 'Interaction' },
    { action: 'read', resource: 'User' },
    { action: 'read', resource: 'Vertical' },
    { action: 'read', resource: 'Campaign' },
  ],

  [TenantRole.BranchManager]: [
    { action: 'create', resource: 'Party' },
    { action: 'read', resource: 'Party' },
    { action: 'update', resource: 'Party' },
    { action: 'create', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'read', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'update', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'assign', resource: 'Case' },
    { action: 'create', resource: 'Interaction' },
    { action: 'read', resource: 'Interaction' },
    { action: 'read', resource: 'User' },
    { action: 'read', resource: 'Report' },
    { action: 'read', resource: 'Vertical' },
    { action: 'read', resource: 'Campaign' },
  ],

  [TenantRole.BrandManager]: [
    { action: 'create', resource: 'Party' },
    { action: 'read', resource: 'Party' },
    { action: 'update', resource: 'Party' },
    { action: 'create', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'read', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'update', resource: 'Case', conditions: { own_assignment_only: true } },
    { action: 'assign', resource: 'Case' },
    { action: 'create', resource: 'Interaction' },
    { action: 'read', resource: 'Interaction' },
    { action: 'read', resource: 'User' },
    { action: 'read', resource: 'Report' },
    { action: 'export', resource: 'Report' },
    { action: 'read', resource: 'Workflow' },
    { action: 'read', resource: 'Vertical' },
    { action: 'read', resource: 'Campaign' },
  ],

  [TenantRole.TenantAdmin]: [
    { action: 'manage', resource: 'Party' },
    { action: 'manage', resource: 'Case' },
    { action: 'manage', resource: 'Interaction' },
    { action: 'manage', resource: 'Report' },
    { action: 'manage', resource: 'Workflow' },
    { action: 'manage', resource: 'FieldDefinition' },
    { action: 'manage', resource: 'LabelOverride' },
    { action: 'manage', resource: 'Integration' },
    { action: 'manage', resource: 'Webhook' },
    { action: 'manage', resource: 'User' },
    { action: 'manage', resource: 'Role' },
    { action: 'manage', resource: 'Branch' },
    { action: 'manage', resource: 'Brand' },
    { action: 'manage', resource: 'Vertical' },
    { action: 'manage', resource: 'Campaign' },
    { action: 'manage', resource: 'Plugin' },
  ],

  [TenantRole.TenantOwner]: [
    { action: 'manage', resource: 'Party' },
    { action: 'manage', resource: 'Case' },
    { action: 'manage', resource: 'Interaction' },
    { action: 'manage', resource: 'Report' },
    { action: 'manage', resource: 'Workflow' },
    { action: 'manage', resource: 'FieldDefinition' },
    { action: 'manage', resource: 'LabelOverride' },
    { action: 'manage', resource: 'Integration' },
    { action: 'manage', resource: 'Webhook' },
    { action: 'manage', resource: 'User' },
    { action: 'manage', resource: 'Role' },
    { action: 'manage', resource: 'Branch' },
    { action: 'manage', resource: 'Brand' },
    { action: 'manage', resource: 'Vertical' },
    { action: 'manage', resource: 'Campaign' },
    { action: 'manage', resource: 'Plugin' },
    { action: 'manage', resource: 'BillingRecord' },
  ],
};
