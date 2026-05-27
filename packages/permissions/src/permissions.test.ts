import { describe, it, expect } from 'vitest';
import { subject as caslSubject } from '@casl/ability';
import { TenantRole, PlatformRole } from '@meta-crm/types';
import { buildTenantAbility } from './tenant-ability';
import { buildPlatformAbility } from './platform-ability';

function sub<T extends string>(type: T, data: Record<string, any>) {
  return caslSubject(type, data) as any;
}

describe('buildTenantAbility', () => {
  const USER_ASSIGNMENTS = ['assignment-1'];
  const MANAGER_ASSIGNMENTS = ['assignment-1', 'assignment-2'];
  const OTHER_ASSIGNMENT = 'assignment-99';

  describe('Member', () => {
    const ability = buildTenantAbility(
      [{ role: TenantRole.Member }],
      USER_ASSIGNMENTS,
    );

    it('can create Party', () => {
      expect(ability.can('create', 'Party')).toBe(true);
    });

    it('can read Party', () => {
      expect(ability.can('read', 'Party')).toBe(true);
    });

    it('can update Party', () => {
      expect(ability.can('update', 'Party')).toBe(true);
    });

    it('cannot delete Party', () => {
      expect(ability.can('delete', 'Party')).toBe(false);
    });

    it('can read own Case (matching assignment)', () => {
      expect(
        ability.can('read', sub('Case', { branch_brand_assignment_id: 'assignment-1' })),
      ).toBe(true);
    });

    it('cannot read other Case (non-matching assignment)', () => {
      expect(
        ability.can('read', sub('Case', { branch_brand_assignment_id: OTHER_ASSIGNMENT })),
      ).toBe(false);
    });

    it('can create Interaction', () => {
      expect(ability.can('create', 'Interaction')).toBe(true);
    });

    it('can read Interaction', () => {
      expect(ability.can('read', 'Interaction')).toBe(true);
    });

    it('cannot assign Case', () => {
      expect(ability.can('assign', 'Case')).toBe(false);
    });

    it('cannot read Report', () => {
      expect(ability.can('read', 'Report')).toBe(false);
    });
  });

  describe('Viewer', () => {
    const ability = buildTenantAbility(
      [{ role: TenantRole.Viewer }],
      USER_ASSIGNMENTS,
    );

    it('can read Party', () => {
      expect(ability.can('read', 'Party')).toBe(true);
    });

    it('cannot create Party', () => {
      expect(ability.can('create', 'Party')).toBe(false);
    });

    it('can read Case', () => {
      expect(ability.can('read', 'Case')).toBe(true);
    });

    it('cannot create Case', () => {
      expect(ability.can('create', 'Case')).toBe(false);
    });

    it('can read Interaction', () => {
      expect(ability.can('read', 'Interaction')).toBe(true);
    });

    it('cannot create Interaction', () => {
      expect(ability.can('create', 'Interaction')).toBe(false);
    });

    it('cannot assign Case', () => {
      expect(ability.can('assign', 'Case')).toBe(false);
    });

    it('cannot manage Role', () => {
      expect(ability.can('manage', 'Role')).toBe(false);
    });
  });

  describe('Manager', () => {
    const ability = buildTenantAbility(
      [{ role: TenantRole.Manager }],
      MANAGER_ASSIGNMENTS,
    );

    it('can assign Case', () => {
      expect(ability.can('assign', 'Case')).toBe(true);
    });

    it('can read Report', () => {
      expect(ability.can('read', 'Report')).toBe(true);
    });

    it('can read own Case', () => {
      expect(
        ability.can('read', sub('Case', { branch_brand_assignment_id: 'assignment-1' })),
      ).toBe(true);
    });

    it('cannot delete Report', () => {
      expect(ability.can('delete', 'Report')).toBe(false);
    });

    it('cannot manage Role', () => {
      expect(ability.can('manage', 'Role')).toBe(false);
    });

    it('cannot manage Integration', () => {
      expect(ability.can('manage', 'Integration')).toBe(false);
    });
  });

  describe('Admin', () => {
    const ability = buildTenantAbility(
      [{ role: TenantRole.Admin }],
      [],
    );

    it('can manage Role', () => {
      expect(ability.can('manage', 'Role')).toBe(true);
    });

    it('can manage Integration', () => {
      expect(ability.can('manage', 'Integration')).toBe(true);
    });

    it('can manage Party', () => {
      expect(ability.can('manage', 'Party')).toBe(true);
    });

    it('cannot manage BillingRecord', () => {
      expect(ability.can('manage', 'BillingRecord')).toBe(false);
    });

    it('can manage Plugin', () => {
      expect(ability.can('manage', 'Plugin')).toBe(true);
    });
  });

  describe('Owner', () => {
    const ability = buildTenantAbility(
      [{ role: TenantRole.Owner }],
      [],
    );

    it('can manage BillingRecord', () => {
      expect(ability.can('manage', 'BillingRecord')).toBe(true);
    });

    it('can manage Plugin', () => {
      expect(ability.can('manage', 'Plugin')).toBe(true);
    });

    it('can manage Integration', () => {
      expect(ability.can('manage', 'Integration')).toBe(true);
    });

    it('can manage Role', () => {
      expect(ability.can('manage', 'Role')).toBe(true);
    });
  });

  describe('multiple roles combined', () => {
    it('merges permissions from multiple roles', () => {
      const ability = buildTenantAbility(
        [
          { role: TenantRole.Manager },
          { role: TenantRole.Owner },
        ],
        MANAGER_ASSIGNMENTS,
      );
      expect(ability.can('manage', 'BillingRecord')).toBe(true);
      expect(ability.can('assign', 'Case')).toBe(true);
    });
  });

  describe('role normalization', () => {
    it('normalizes admin role to tenant_admin / admin', () => {
      const ability1 = buildTenantAbility([{ role: 'admin' }], []);
      expect(ability1.can('manage', 'Role')).toBe(true);
      expect(ability1.can('manage', 'BillingRecord')).toBe(false);

      const ability2 = buildTenantAbility([{ role: 'tenant_admin' }], []);
      expect(ability2.can('manage', 'Role')).toBe(true);
      expect(ability2.can('manage', 'BillingRecord')).toBe(false);
    });

    it('normalizes owner role to tenant_owner / owner', () => {
      const ability1 = buildTenantAbility([{ role: 'owner' }], []);
      expect(ability1.can('manage', 'BillingRecord')).toBe(true);

      const ability2 = buildTenantAbility([{ role: 'tenant_owner' }], []);
      expect(ability2.can('manage', 'BillingRecord')).toBe(true);
    });

    it('normalizes manager roles to manager', () => {
      const ability1 = buildTenantAbility([{ role: 'branch_manager' }], MANAGER_ASSIGNMENTS);
      expect(ability1.can('assign', 'Case')).toBe(true);

      const ability2 = buildTenantAbility([{ role: 'brand_manager' }], MANAGER_ASSIGNMENTS);
      expect(ability2.can('assign', 'Case')).toBe(true);

      const ability3 = buildTenantAbility([{ role: 'manager' }], MANAGER_ASSIGNMENTS);
      expect(ability3.can('assign', 'Case')).toBe(true);
    });
  });
});


describe('buildPlatformAbility', () => {
  describe('PlatformOwner', () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformOwner);

    it('can manage PlatformUser', () => {
      expect(ability.can('manage', 'PlatformUser')).toBe(true);
    });

    it('can manage Billing', () => {
      expect(ability.can('manage', 'Billing')).toBe(true);
    });

    it('can manage PlatformTenant', () => {
      expect(ability.can('manage', 'PlatformTenant')).toBe(true);
    });

    it('can manage SystemHealth', () => {
      expect(ability.can('manage', 'SystemHealth')).toBe(true);
    });
  });

  describe('PlatformAdmin', () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformAdmin);

    it('can manage PlatformTenant', () => {
      expect(ability.can('manage', 'PlatformTenant')).toBe(true);
    });

    it('can read Billing', () => {
      expect(ability.can('read', 'Billing')).toBe(true);
    });

    it('cannot assign Billing (action unavailable)', () => {
      const canAssignBilling = 'can' in ability
        ? (ability as any).can('assign', 'Billing')
        : false;
      expect(canAssignBilling).toBe(false);
    });

    it('can read SystemHealth', () => {
      expect(ability.can('read', 'SystemHealth')).toBe(true);
    });
  });

  describe('PlatformSupport', () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformSupport);

    it('can read PlatformTenant', () => {
      expect(ability.can('read', 'PlatformTenant')).toBe(true);
    });

    it('cannot update PlatformTenant', () => {
      expect(ability.can('update', 'PlatformTenant')).toBe(false);
    });

    it('cannot create PlatformTenant', () => {
      expect(ability.can('create', 'PlatformTenant')).toBe(false);
    });

    it('cannot delete PlatformTenant', () => {
      expect(ability.can('delete', 'PlatformTenant')).toBe(false);
    });

    it('cannot manage PlatformPlugin', () => {
      expect(ability.can('manage', 'PlatformPlugin')).toBe(false);
    });
  });

  describe('PlatformSales', () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformSales);

    it('can create PlatformTenant', () => {
      expect(ability.can('create', 'PlatformTenant')).toBe(true);
    });

    it('can read PlatformPlan', () => {
      expect(ability.can('read', 'PlatformPlan')).toBe(true);
    });

    it('cannot read SystemHealth', () => {
      expect(ability.can('read', 'SystemHealth')).toBe(false);
    });

    it('cannot read Billing', () => {
      expect(ability.can('read', 'Billing')).toBe(false);
    });
  });

  describe('PlatformBilling', () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformBilling);

    it('can create PlatformPlan', () => {
      expect(ability.can('create', 'PlatformPlan')).toBe(true);
    });

    it('can read Billing', () => {
      expect(ability.can('read', 'Billing')).toBe(true);
    });

    it('cannot manage PlatformUser', () => {
      expect(ability.can('manage', 'PlatformUser')).toBe(false);
    });
  });

  describe('PlatformDeveloper', () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformDeveloper);

    it('can manage PlatformPlugin', () => {
      expect(ability.can('manage', 'PlatformPlugin')).toBe(true);
    });

    it('cannot read PlatformUser', () => {
      expect(ability.can('read', 'PlatformUser')).toBe(false);
    });

    it('cannot manage PlatformTenant', () => {
      expect(ability.can('manage', 'PlatformTenant')).toBe(false);
    });
  });

  describe('PlatformOps', () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformOps);

    it('can read SystemHealth', () => {
      expect(ability.can('read', 'SystemHealth')).toBe(true);
    });

    it('can read PlatformReport', () => {
      expect(ability.can('read', 'PlatformReport')).toBe(true);
    });

    it('cannot update PlatformTenant', () => {
      expect(ability.can('update', 'PlatformTenant')).toBe(false);
    });
  });
});
