import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { buildPlatformAbility } from '@meta-crm/permissions';
import { PlatformRole } from '@meta-crm/types';
import { PlatformPrismaService } from '../../tenant/platform-prisma.service';
import { PlatformReportService } from './platform-report.service';
import { PlatformPermissionsGuard } from '../../permissions/permissions.guard';
import { PermissionsService } from '../../permissions/permissions.service';
import { CHECK_PLATFORM_PERMISSIONS_KEY } from '../../permissions/permissions.decorator';
import type { RequestScope } from '../../tenant/request-scope.interface';

/* ------------------------------------------------------------------ */
/*  PlatformReportService                                               */
/* ------------------------------------------------------------------ */
function buildDbMocks() {
  const client = {
    tenant: { count: vi.fn(), groupBy: vi.fn() },
    user: { groupBy: vi.fn() },
    pluginRegistry: { findMany: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  };
  const db = { client } as unknown as PlatformPrismaService;
  return { client, db };
}

describe('PlatformReportService', () => {
  let svc: PlatformReportService;
  let client: ReturnType<typeof buildDbMocks>['client'];

  beforeEach(() => {
    vi.restoreAllMocks();
    const mocks = buildDbMocks();
    client = mocks.client;
    svc = new PlatformReportService(mocks.db);
  });

  /* ------------------------------------------------------------------ */
  /*  tenantCount                                                         */
  /* ------------------------------------------------------------------ */
  describe('tenantCount', () => {
    it('returns total and by_industry breakdown', async () => {
      (client.tenant.count as any).mockResolvedValue(5);
      (client.tenant.groupBy as any).mockResolvedValue([
        { industry: 'education', _count: { id: 3 } },
        { industry: 'healthcare', _count: { id: 2 } },
      ]);

      const result = await svc.tenantCount();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.total).toBe(5);
        expect(result.value.by_industry).toHaveLength(2);
        expect(result.value.by_industry[0]).toEqual({ industry: 'education', count: 3 });
      }
    });

    it('contains NO PII fields', async () => {
      (client.tenant.count as any).mockResolvedValue(1);
      (client.tenant.groupBy as any).mockResolvedValue([{ industry: 'education', _count: { id: 1 } }]);

      const result = await svc.tenantCount();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = JSON.stringify(result.value);
        expect(json).not.toContain('email');
        expect(json).not.toContain('name');
        expect(json).not.toContain('phone');
        expect(json).not.toContain('password');
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  mau                                                                 */
  /* ------------------------------------------------------------------ */
  describe('mau', () => {
    it('returns active users grouped by tenant_id', async () => {
      (client.user.groupBy as any).mockResolvedValue([
        { tenant_id: 't-1', _count: { id: 10 } },
        { tenant_id: 't-2', _count: { id: 5 } },
      ]);

      const result = await svc.mau({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.monthly_active).toHaveLength(2);
        expect(result.value.monthly_active[0]).toEqual({ tenant_id: 't-1', active_users: 10 });
      }
    });

    it('contains NO PII fields', async () => {
      (client.user.groupBy as any).mockResolvedValue([{ tenant_id: 't-1', _count: { id: 3 } }]);

      const result = await svc.mau({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = JSON.stringify(result.value);
        expect(json).not.toContain('email');
        expect(json).not.toContain('name');
        expect(json).not.toContain('phone');
        expect(json).not.toContain('password');
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  casesPerDay                                                         */
  /* ------------------------------------------------------------------ */
  describe('casesPerDay', () => {
    it('returns daily case counts', async () => {
      (client.$queryRawUnsafe as any).mockResolvedValue([
        { date: '2025-01-01', count: 5 },
        { date: '2025-01-02', count: 3 },
      ]);

      const result = await svc.casesPerDay({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.daily).toHaveLength(2);
        expect(result.value.daily[0]).toEqual({ date: '2025-01-01', count: 5 });
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  pluginUsage                                                         */
  /* ------------------------------------------------------------------ */
  describe('pluginUsage', () => {
    it('returns plugin install counts', async () => {
      (client.pluginRegistry.findMany as any).mockResolvedValue([
        { package_name: '@meta-crm/plugin-healthcare', _count: { tenantPlugins: 3 } },
        { package_name: '@meta-crm/plugin-analytics', _count: { tenantPlugins: 1 } },
      ]);

      const result = await svc.pluginUsage();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.plugins).toHaveLength(2);
        expect(result.value.plugins[0]).toEqual({
          plugin_package: '@meta-crm/plugin-healthcare',
          tenant_count: 3,
        });
      }
    });
  });
});

/* ------------------------------------------------------------------ */
/*  PlatformPermissionsGuard — Tier 2 isolation                          */
/* ------------------------------------------------------------------ */
describe('PlatformPermissionsGuard — Tier 2 isolation', () => {
  let guard: PlatformPermissionsGuard;
  let cls: ClsService;
  let reflector: any;

  const tenantScope: RequestScope = {
    user_id: 'tenant-user',
    tenant_id: 'tenant-a',
    assignment_ids: ['assign-1'],
    role: 'tenant_admin' as any,
  };

  const platformOpsScope: RequestScope = {
    user_id: 'ops-user',
    tenant_id: '',
    assignment_ids: [],
    role: PlatformRole.PlatformOps as unknown as any,
    platform_role: PlatformRole.PlatformOps,
  };

  beforeEach(() => {
    cls = { get: vi.fn() } as unknown as ClsService;
    reflector = { get: vi.fn() };
  });

  it('allows platform_ops to read PlatformReport', async () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformOps);
    (cls.get as any).mockReturnValue(platformOpsScope);
    reflector.get.mockReturnValue({ action: 'read', resource: 'PlatformReport' });

    const permissionsService = {
      getPlatformAbility: vi.fn().mockReturnValue(ability),
    } as unknown as PermissionsService;

    guard = new PlatformPermissionsGuard(reflector, permissionsService, cls);
    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });

  it('rejects tenant JWT (no platform_role) with 403', async () => {
    (cls.get as any).mockReturnValue(tenantScope);
    reflector.get.mockReturnValue({ action: 'read', resource: 'PlatformReport' });

    // A tenant JWT has no platform_role → buildPlatformAbility(undefined) yields an empty ability
    const emptyAbility = buildPlatformAbility(undefined as any);
    const permissionsService = {
      getPlatformAbility: vi.fn().mockReturnValue(emptyAbility),
    } as unknown as PermissionsService;

    guard = new PlatformPermissionsGuard(reflector, permissionsService, cls);

    try {
      await guard.canActivate(mockContext());
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect(e.response).toEqual({
        code: 'PERMISSION_DENIED',
        resource: 'PlatformReport',
        action: 'read',
      });
    }
  });

  it('rejects platform_support from reading PlatformReport', async () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformSupport);
    (cls.get as any).mockReturnValue({
      ...platformOpsScope,
      role: PlatformRole.PlatformSupport as unknown as any,
      platform_role: PlatformRole.PlatformSupport,
    });
    reflector.get.mockReturnValue({ action: 'read', resource: 'PlatformReport' });

    const permissionsService = {
      getPlatformAbility: vi.fn().mockReturnValue(ability),
    } as unknown as PermissionsService;

    guard = new PlatformPermissionsGuard(reflector, permissionsService, cls);
    await expect(guard.canActivate(mockContext())).rejects.toThrow(ForbiddenException);
  });

  it('allows platform_admin to read PlatformReport', async () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformAdmin);
    (cls.get as any).mockReturnValue({
      ...platformOpsScope,
      role: PlatformRole.PlatformAdmin as unknown as any,
      platform_role: PlatformRole.PlatformAdmin,
    });
    reflector.get.mockReturnValue({ action: 'read', resource: 'PlatformReport' });

    const permissionsService = {
      getPlatformAbility: vi.fn().mockReturnValue(ability),
    } as unknown as PermissionsService;

    guard = new PlatformPermissionsGuard(reflector, permissionsService, cls);
    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });
});

function mockContext(): any {
  return { getHandler: () => ((): void => undefined) };
}
