import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { buildPlatformAbility, buildTenantAbility } from '@meta-crm/permissions';
import { PlatformRole, TenantRole } from '@meta-crm/types';
import { PlatformPermissionsGuard } from '../core/permissions/permissions.guard';
import { PermissionsService } from '../core/permissions/permissions.service';
import { PlatformPluginsService } from './plugins/platform-plugins.service';
import { PlatformTeamService } from './team/platform-team.service';
import { PlatformTenantsService } from './tenants/platform-tenants.service';
import type { RequestScope } from '../core/tenant/request-scope.interface';
import type { PlatformPrismaService } from '../core/tenant/platform-prisma.service';

const mockAudit = {
  writeLog: vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false }),
  list: vi.fn(),
} as any;

const mockStream = {
  emit: vi.fn(),
  error: vi.fn(),
  complete: vi.fn(),
} as any;


/* ------------------------------------------------------------------ */
/*  PlatformPermissionsGuard — tenant JWT rejection                     */
/* ------------------------------------------------------------------ */
describe('PlatformPermissionsGuard — tenant JWT rejection', () => {
  let guard: PlatformPermissionsGuard;
  let cls: ClsService;
  let reflector: any;
  let permissionsService: PermissionsService;

  const tenantScope: RequestScope = {
    user_id: 'tenant-user',
    tenant_id: 'tenant-a',
    assignment_ids: ['assign-1'],
    role: TenantRole.Admin as any,
  };

  const supportScope: RequestScope = {
    user_id: 'support-user',
    tenant_id: '',
    assignment_ids: [],
    role: PlatformRole.PlatformSupport as unknown as any,
    platform_role: PlatformRole.PlatformSupport,
  };

  const salesScope: RequestScope = {
    user_id: 'sales-user',
    tenant_id: '',
    assignment_ids: [],
    role: PlatformRole.PlatformSales as unknown as any,
    platform_role: PlatformRole.PlatformSales,
  };

  beforeEach(() => {
    cls = { get: vi.fn() } as unknown as ClsService;
    reflector = { get: vi.fn() };
  });

  it('rejects tenant JWT (no platform_role) when checking create PlatformTenant', async () => {
    (cls.get as any).mockReturnValue(tenantScope);
    reflector.get.mockReturnValue({ action: 'create', resource: 'PlatformTenant' });

    const emptyAbility = buildPlatformAbility(undefined as any);
    permissionsService = {
      getPlatformAbility: vi.fn().mockReturnValue(emptyAbility),
    } as unknown as PermissionsService;

    guard = new PlatformPermissionsGuard(reflector, permissionsService, cls);
    await expect(guard.canActivate(mockContext())).rejects.toThrow(ForbiddenException);
  });

  it('rejects platform_support from creating PlatformTenant', async () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformSupport);
    (cls.get as any).mockReturnValue(supportScope);
    reflector.get.mockReturnValue({ action: 'create', resource: 'PlatformTenant' });

    permissionsService = {
      getPlatformAbility: vi.fn().mockReturnValue(ability),
    } as unknown as PermissionsService;

    guard = new PlatformPermissionsGuard(reflector, permissionsService, cls);
    await expect(guard.canActivate(mockContext())).rejects.toThrow(ForbiddenException);
  });

  it('allows platform_sales to create PlatformTenant', async () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformSales);
    (cls.get as any).mockReturnValue(salesScope);
    reflector.get.mockReturnValue({ action: 'create', resource: 'PlatformTenant' });

    permissionsService = {
      getPlatformAbility: vi.fn().mockReturnValue(ability),
    } as unknown as PermissionsService;

    guard = new PlatformPermissionsGuard(reflector, permissionsService, cls);
    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  PlatformPluginsService — manifest validation                        */
/* ------------------------------------------------------------------ */
describe('PlatformPluginsService', () => {
  let svc: PlatformPluginsService;

  beforeEach(() => {
    const mockClient = {} as any;
    const db = { client: mockClient } as unknown as PlatformPrismaService;
    svc = new PlatformPluginsService(db, mockAudit);
  });

  describe('validateManifest', () => {
    it('passes for valid manifest', () => {
      const result = svc.validateManifest({
        id: 'plugin-healthcare',
        name: 'Healthcare Plugin',
        description: 'Healthcare-specific features',
        compatible_industries: ['healthcare'],
        hooks: ['case:stage_changed'],
        extends: ['Case'],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe('plugin-healthcare');
      }
    });

    it('returns field-level errors for invalid manifest', () => {
      const result = svc.validateManifest({
        id: '',
        name: '',
        description: '',
        compatible_industries: [],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_MANIFEST');
        expect(result.error.details).toBeDefined();
        expect(result.error.details!['id']).toBeDefined();
        expect(result.error.details!['name']).toBeDefined();
        expect(result.error.details!['compatible_industries']).toBeDefined();
      }
    });

    it('applies defaults for optional fields', () => {
      const result = svc.validateManifest({
        id: 'plugin-test',
        name: 'Test',
        description: 'Test plugin',
        compatible_industries: ['*'],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.hooks).toEqual([]);
        expect(result.value.extends).toEqual([]);
      }
    });
  });

  describe('deprecate permission', () => {
    it('platform_support cannot deprecate plugin (no manage PlatformPlugin permission)', () => {
      const ability = buildPlatformAbility(PlatformRole.PlatformSupport);
      const canDeprecate = ability.can('update', 'PlatformPlugin');
      expect(canDeprecate).toBe(false);
    });

    it('platform_developer can deprecate plugin', () => {
      const ability = buildPlatformAbility(PlatformRole.PlatformDeveloper);
      const canDeprecate = ability.can('manage', 'PlatformPlugin');
      expect(canDeprecate).toBe(true);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  PlatformTeamService — role escalation prevention                    */
/* ------------------------------------------------------------------ */
describe('PlatformTeamService — role escalation prevention', () => {
  let svc: PlatformTeamService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      client: {
        platformUser: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
        platformUserRole: { updateMany: vi.fn(), create: vi.fn() },
      },
    };
    svc = new PlatformTeamService(mockDb as unknown as PlatformPrismaService, mockAudit);
  });

  it('platform_sales inviting platform_admin returns ROLE_ESCALATION', async () => {
    const inviter: RequestScope = {
      user_id: 'sales-user',
      tenant_id: '',
      assignment_ids: [],
      role: PlatformRole.PlatformSales as any,
      platform_role: PlatformRole.PlatformSales,
    };

    const result = await svc.invite(
      { name: 'Admin User', email: 'admin@test.com', role: PlatformRole.PlatformAdmin },
      inviter,
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('ROLE_ESCALATION');
    }
  });

  it('platform_admin inviting platform_owner returns ROLE_ESCALATION', async () => {
    const inviter: RequestScope = {
      user_id: 'admin-user',
      tenant_id: '',
      assignment_ids: [],
      role: PlatformRole.PlatformAdmin as any,
      platform_role: PlatformRole.PlatformAdmin,
    };

    const result = await svc.invite(
      { name: 'Owner', email: 'owner@test.com', role: PlatformRole.PlatformOwner },
      inviter,
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('ROLE_ESCALATION');
    }
  });

  it('platform_owner inviting platform_admin succeeds', async () => {
    (mockDb.client.platformUser.findUnique as any).mockResolvedValue(null);
    (mockDb.client.platformUser.create as any).mockResolvedValue({
      id: 'new-user',
      name: 'Admin User',
      email: 'admin@test.com',
    });

    const inviter: RequestScope = {
      user_id: 'owner-user',
      tenant_id: '',
      assignment_ids: [],
      role: PlatformRole.PlatformOwner as any,
      platform_role: PlatformRole.PlatformOwner,
    };

    const result = await svc.invite(
      { name: 'Admin User', email: 'admin@test.com', role: PlatformRole.PlatformAdmin },
      inviter,
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.email).toBe('admin@test.com');
      expect(result.value.temporary_password).toBeDefined();
    }
  });

  it('changeRole returns ROLE_ESCALATION when non-owner tries', async () => {
    const actor: RequestScope = {
      user_id: 'admin-user',
      tenant_id: '',
      assignment_ids: [],
      role: PlatformRole.PlatformAdmin as any,
      platform_role: PlatformRole.PlatformAdmin,
    };

    const result = await svc.changeRole('some-user-id', PlatformRole.PlatformOwner, actor);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('ROLE_ESCALATION');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  PlatformTenantsService — getHierarchy                             */
/* ------------------------------------------------------------------ */
describe('PlatformTenantsService — getHierarchy', () => {
  let svc: PlatformTenantsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      client: {
        tenant: { findUnique: vi.fn() },
        branch: { findMany: vi.fn() },
        branchBrandAssignment: { findMany: vi.fn() },
        vertical: { findMany: vi.fn() },
        case: { count: vi.fn() },
        pipelineDefinition: { findMany: vi.fn() },
        pipelineStage: { groupBy: vi.fn(), findMany: vi.fn() },
      },
    };
    svc = new PlatformTenantsService(mockDb as unknown as PlatformPrismaService, mockAudit, mockStream);
  });

  it('returns TENANT_NOT_FOUND when tenant does not exist', async () => {
    (mockDb.client.tenant.findUnique as any).mockResolvedValue(null);

    const result = await svc.getHierarchy('invalid-id');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('TENANT_NOT_FOUND');
    }
  });

  it('returns hierarchy with branches, brands, and verticals with stats', async () => {
    (mockDb.client.tenant.findUnique as any).mockResolvedValue({ id: 'tenant-1', name: 'Apex' });
    (mockDb.client.branch.findMany as any).mockResolvedValue([
      { id: 'branch-1', name: 'Kothrud', city: 'Pune' },
    ]);
    (mockDb.client.branchBrandAssignment.findMany as any).mockResolvedValue([
      { id: 'assignment-1', is_primary: true, brand: { id: 'brand-1', name: 'Apex Institute' } },
    ]);
    (mockDb.client.vertical.findMany as any).mockResolvedValue([
      { id: 'vertical-1', name: 'NEET', status: 'active' },
    ]);
    (mockDb.client.case.count as any).mockResolvedValue(10);
    (mockDb.client.pipelineDefinition.findMany as any).mockResolvedValue([
      { id: 'wf-1' },
    ]);
    (mockDb.client.pipelineStage.groupBy as any).mockResolvedValue([
      { pipeline_definition_id: 'wf-1', _max: { order: 3 } },
    ]);
    (mockDb.client.pipelineStage.findMany as any).mockResolvedValue([
      { id: 'stage-final' },
    ]);

    const result = await svc.getHierarchy('tenant-1');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.branches).toHaveLength(1);
      const b = result.value.branches[0];
      expect(b.name).toBe('Kothrud');
      expect(b.brands).toHaveLength(1);
      expect(b.brands[0].name).toBe('Apex Institute');
      expect(b.verticals).toHaveLength(1);
      expect(b.verticals[0].name).toBe('NEET');
      expect(b.verticals[0].stats.total_leads).toBe(10);
      expect(b.verticals[0].stats.conversion_rate).toBe(100);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  PlatformTenantsService — create capabilities                       */
/* ------------------------------------------------------------------ */
describe('PlatformTenantsService — create', () => {
  let svc: PlatformTenantsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      client: {
        tenant: { findUnique: vi.fn() },
        subscriptionPlan: { findUnique: vi.fn() },
        $transaction: vi.fn(),
        pluginRegistry: { findFirst: vi.fn(), create: vi.fn() },
        tenantPlugin: { create: vi.fn() },
      },
    };
    svc = new PlatformTenantsService(mockDb as unknown as PlatformPrismaService, mockAudit, mockStream);
    // Mock applyTemplate to return ok
    vi.spyOn(svc, 'applyTemplate').mockResolvedValue({ isErr: () => false, isOk: () => true } as any);
  });

  it('creates tenant and enables core and requested capabilities', async () => {
    (mockDb.client.tenant.findUnique as any).mockResolvedValue(null);
    (mockDb.client.subscriptionPlan.findUnique as any).mockResolvedValue({ id: 'plan-1' });
    (mockDb.client.pluginRegistry.findFirst as any).mockResolvedValue({ id: 'plugin-reg-1' });
    (mockDb.client.pluginRegistry.create as any).mockResolvedValue({ id: 'plugin-reg-1' });
    
    let createdConfig: any = null;
    (mockDb.client.$transaction as any).mockImplementation(async (cb: any) => {
      const tx = {
        tenant: {
          create: vi.fn().mockImplementation(({ data }: any) => {
            createdConfig = data.config_json;
            return {
              id: 'tenant-1',
              name: data.name,
              slug: data.slug,
              industry: data.industry,
            };
          }),
        },
        user: { create: vi.fn() },
        tenantPlan: { create: vi.fn() },
      };
      return cb(tx);
    });

    const result = await svc.create({
      name: 'Test Tenant',
      slug: 'test-tenant',
      industry: 'healthcare',
      plan_id: 'plan-1',
      owner: { name: 'Owner', email: 'owner@test.com' },
      capabilities: ['capability/billing'],
    });

    expect(result.isOk()).toBe(true);
    // Healthcare default capability is 'capability/appointment'
    // Requested capability is 'capability/billing'
    expect(createdConfig).toBeDefined();
    expect(createdConfig.enabled_capabilities).toContain('capability/appointment');
    expect(createdConfig.enabled_capabilities).toContain('capability/billing');
  });
});

/* ------------------------------------------------------------------ */
/*  Helper                                                              */
/* ------------------------------------------------------------------ */
function mockContext(): any {
  return { getHandler: () => ((): void => undefined) };
}
