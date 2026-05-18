import { Ability, ForcedSubject } from '@casl/ability';

export type TenantAction = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'assign' | 'export';

export type TenantSubject =
  | 'Party'
  | 'Case'
  | 'Interaction'
  | 'Report'
  | 'Workflow'
  | 'FieldDefinition'
  | 'LabelOverride'
  | 'Integration'
  | 'Webhook'
  | 'User'
  | 'Role'
  | 'Branch'
  | 'Brand'
  | 'Plugin'
  | 'BillingRecord'
  | 'all';

export type TenantAbility = Ability<[TenantAction, TenantSubject | ForcedSubject<TenantSubject>], Record<string, any>>;

export type PlatformAction = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'assign';

export type PlatformSubject =
  | 'PlatformTenant'
  | 'PlatformPlan'
  | 'PlatformPlugin'
  | 'PlatformReport'
  | 'PlatformUser'
  | 'SystemHealth'
  | 'Billing'
  | 'all';

export type PlatformAbility = Ability<[PlatformAction, PlatformSubject | ForcedSubject<PlatformSubject>], Record<string, any>>;
