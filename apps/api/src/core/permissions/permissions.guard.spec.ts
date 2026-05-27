import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { subject } from '@casl/ability';
import { buildTenantAbility, buildPlatformAbility } from '@meta-crm/permissions';
import { TenantRole, PlatformRole } from '@meta-crm/types';
import type { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../tenant/request-scope.interface';
import { PermissionsGuard, PlatformPermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';
import { PermissionCacheService } from './permission-cache.service';

const mockContext = (): any => ({ getHandler: () => ((): void => undefined) });

const tenantScope: RequestScope = {
  user_id: 'user-a',
  tenant_id: 'tenant-a',
  assignment_ids: ['assign-1'],
  role: TenantRole.Member,
};

const adminScope: RequestScope = {
  user_id: 'admin-1',
  tenant_id: '',
  assignment_ids: [],
  role: PlatformRole.PlatformAdmin as unknown as TenantRole,
  platform_role: PlatformRole.PlatformAdmin,
};

function mockPermissionsService(ability: any): PermissionsService {
  return {
    getTenantAbility: vi.fn().mockResolvedValue(ability),
    getPlatformAbility: vi.fn().mockReturnValue(ability),
  } as unknown as PermissionsService;
}

/* ------------------------------------------------------------------ */
/*  PermissionsGuard (tenant)                                          */
/* ------------------------------------------------------------------ */
describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let cls: ClsService;
  let reflector: any;

  beforeEach(() => {
    cls = { get: vi.fn() } as unknown as ClsService;
    reflector = { get: vi.fn() };
  });

  it('allows when ability.can returns true', async () => {
    const ability = buildTenantAbility([{ role: TenantRole.Admin }], []);
    (cls.get as any).mockReturnValue(tenantScope);
    reflector.get.mockReturnValue({ action: 'read', resource: 'Case' });

    guard = new PermissionsGuard(reflector, mockPermissionsService(ability), cls);
    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });

  it('denies with PERMISSION_DENIED when ability.can returns false', async () => {
    const ability = buildTenantAbility([{ role: TenantRole.Member }], ['assign-1']);
    (cls.get as any).mockReturnValue(tenantScope);
    reflector.get.mockReturnValue({ action: 'manage', resource: 'Workflow' });

    guard = new PermissionsGuard(reflector, mockPermissionsService(ability), cls);
    try {
      await guard.canActivate(mockContext());
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect(e.response).toEqual({
        code: 'PERMISSION_DENIED',
        resource: 'Workflow',
        action: 'manage',
      });
    }
  });

  it('returns true when no decorator is present', async () => {
    guard = new PermissionsGuard(reflector, mockPermissionsService(null as any), cls);
    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });

  it('denies with PERMISSION_DENIED when no scope in CLS', async () => {
    const ability = buildTenantAbility([{ role: TenantRole.Admin }], []);
    (cls.get as any).mockReturnValue(null);
    reflector.get.mockReturnValue({ action: 'read', resource: 'Case' });

    guard = new PermissionsGuard(reflector, mockPermissionsService(ability), cls);
    try {
      await guard.canActivate(mockContext());
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e.response).toEqual({
        code: 'PERMISSION_DENIED',
        resource: 'Case',
        action: 'read',
      });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  PlatformPermissionsGuard                                           */
/* ------------------------------------------------------------------ */
describe('PlatformPermissionsGuard', () => {
  let guard: PlatformPermissionsGuard;
  let cls: ClsService;
  let reflector: any;

  beforeEach(() => {
    cls = { get: vi.fn() } as unknown as ClsService;
    reflector = { get: vi.fn() };
  });

  it('allows platform_admin to manage PlatformTenant', async () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformAdmin);
    (cls.get as any).mockReturnValue(adminScope);
    reflector.get.mockReturnValue({ action: 'manage', resource: 'PlatformTenant' });

    guard = new PlatformPermissionsGuard(reflector, mockPermissionsService(ability), cls);
    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });

  it('denies platform_support from managing PlatformTenant', async () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformSupport);
    (cls.get as any).mockReturnValue({ ...adminScope, role: PlatformRole.PlatformSupport as unknown as TenantRole });
    reflector.get.mockReturnValue({ action: 'manage', resource: 'PlatformTenant' });

    guard = new PlatformPermissionsGuard(reflector, mockPermissionsService(ability), cls);
    await expect(guard.canActivate(mockContext())).rejects.toThrow(ForbiddenException);
  });

  it('returns 403 with typed code', async () => {
    const ability = buildPlatformAbility(PlatformRole.PlatformSupport);
    (cls.get as any).mockReturnValue({ ...adminScope, role: PlatformRole.PlatformSupport as unknown as TenantRole });
    reflector.get.mockReturnValue({ action: 'manage', resource: 'PlatformTenant' });

    guard = new PlatformPermissionsGuard(reflector, mockPermissionsService(ability), cls);
    try {
      await guard.canActivate(mockContext());
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e.response).toEqual({
        code: 'PERMISSION_DENIED',
        resource: 'PlatformTenant',
        action: 'manage',
      });
    }
  });

  it('returns true when no decorator is present', async () => {
    guard = new PlatformPermissionsGuard(reflector, mockPermissionsService(null as any), cls);
    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  PermissionCacheService                                              */
/* ------------------------------------------------------------------ */
describe('PermissionCacheService', () => {
  let cache: PermissionCacheService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = { get: vi.fn(), set: vi.fn(), del: vi.fn(), quit: vi.fn() };
    cache = new PermissionCacheService(mockRedis);
  });

  it('getRules returns parsed value from redis', async () => {
    const rules = [{ action: 'read', subject: 'Case' }];
    mockRedis.get.mockResolvedValue(JSON.stringify(rules));

    const result = await cache.getRules('user-1', 'tenant-1');
    expect(result).toEqual(rules);
    expect(mockRedis.get).toHaveBeenCalledWith('perm:user-1:tenant-1');
  });

  it('getRules returns null when cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    expect(await cache.getRules('user-1', 'tenant-1')).toBeNull();
  });

  it('setRules stores serialized rules with TTL 300', async () => {
    const rules = [{ action: 'manage', subject: 'all' }];
    await cache.setRules('user-a', 'tenant-a', rules);
    expect(mockRedis.set).toHaveBeenCalledWith('perm:user-a:tenant-a', JSON.stringify(rules), 'EX', 300);
  });

  it('invalidate deletes the cache key', async () => {
    await cache.invalidate('user-x', 'tenant-y');
    expect(mockRedis.del).toHaveBeenCalledWith('perm:user-x:tenant-y');
  });
});

/* ------------------------------------------------------------------ */
/*  Attribute condition — own_assignment_only                           */
/* ------------------------------------------------------------------ */
describe('Attribute condition — own_assignment_only', () => {
  const buildAbility = (assignments: string[]) =>
    buildTenantAbility([{ role: TenantRole.Member }], assignments);

  it('allows access when branch_brand_assignment_id is in user assignments', () => {
    const ability = buildAbility(['assign-1', 'assign-2']);

    const allowed = ability.can('update', subject('Case', { branch_brand_assignment_id: 'assign-1' }) as any);
    expect(allowed).toBe(true);
  });

  it('denies access when branch_brand_assignment_id is NOT in user assignments', () => {
    const ability = buildAbility(['assign-1']);

    const denied = ability.can('update', subject('Case', { branch_brand_assignment_id: 'assign-999' }) as any);
    expect(denied).toBe(false);
  });

  it('denies access when the subject has no branch_brand_assignment_id', () => {
    const ability = buildAbility(['assign-1']);

    const denied = ability.can('update', subject('Case', {} as any) as any);
    expect(denied).toBe(false);
  });

  it('tenant_admin with manage permission bypasses assignment check', () => {
    const ability = buildTenantAbility([{ role: TenantRole.Admin }], []);

    const allowed = ability.can('manage', subject('Case', { branch_brand_assignment_id: 'any' }) as any);
    expect(allowed).toBe(true);
  });
});
