import { describe, it, expect, vi } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { applyTenantScope, TENANT_SCOPED_MODELS } from './tenant-scoped-prisma.service';
import { MissingTenantContextError } from './missing-tenant-context.error';
import type { RequestScope } from './request-scope.interface';
import { TenantRole } from '@meta-crm/types';

function mockCls(scope: RequestScope | null): ClsService {
  return { get: vi.fn().mockReturnValue(scope) } as unknown as ClsService;
}

const tenantAScope: RequestScope = {
  user_id: 'user-a',
  tenant_id: 'tenant-a',
  assignment_ids: ['assign-1'],
  role: TenantRole.BranchUser,
  vertical_ids: [],
};

const tenantBScope: RequestScope = {
  user_id: 'user-b',
  tenant_id: 'tenant-b',
  assignment_ids: ['assign-2'],
  role: TenantRole.BranchUser,
  vertical_ids: [],
};

async function exec(opts: {
  model: string;
  operation: string;
  args?: any;
  scope?: RequestScope | null;
}) {
  const cls = mockCls(opts.scope ?? null);
  const query = vi.fn().mockResolvedValue('result');
  await applyTenantScope(cls, opts.model, opts.operation, opts.args ?? {}, query);
  return query;
}

describe('applyTenantScope', () => {
  describe('non-tenant-scoped models pass through', () => {
    const SKIP_MODELS = ['Tenant', 'PlatformUser', 'PlatformUserRole', 'PluginRegistry', 'SubscriptionPlan', 'RefreshToken'];

    for (const model of SKIP_MODELS) {
      it(`${model} does not get tenant_id injection`, async () => {
        const query = await exec({ model, operation: 'findMany', args: { where: { name: 'test' } }, scope: tenantAScope });
        expect(query).toHaveBeenCalledWith({ where: { name: 'test' } });
      });
    }
  });

  describe('findUnique / findUniqueOrThrow pass through', () => {
    for (const op of ['findUnique', 'findUniqueOrThrow']) {
      it(`${op} does not inject tenant_id`, async () => {
        const query = await exec({ model: 'User', operation: op, args: { where: { id: 'some-id' } }, scope: tenantAScope });
        expect(query).toHaveBeenCalledWith({ where: { id: 'some-id' } });
      });
    }
  });

  describe('throws MissingTenantContextError', () => {
    for (const op of ['findMany', 'findFirst', 'create', 'update', 'delete', 'upsert', 'count', 'aggregate', 'groupBy']) {
      it(`${op} throws MissingTenantContextError when no scope`, async () => {
        const cls = mockCls(null);
        await expect(
          applyTenantScope(cls, 'User', op, { where: {} }, vi.fn()),
        ).rejects.toThrow(MissingTenantContextError);
      });
    }

    it('createMany throws MissingTenantContextError when no scope', async () => {
      const cls = mockCls(null);
      await expect(
        applyTenantScope(cls, 'User', 'createMany', { data: [{ name: 'x' }] }, vi.fn()),
      ).rejects.toThrow(MissingTenantContextError);
    });
  });

  describe('injects tenant_id into where clause', () => {
    const WHERE_OPS = ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'];

    for (const op of WHERE_OPS) {
      it(`${op} adds tenant_id to where`, async () => {
        const query = await exec({ model: 'User', operation: op, args: { where: { name: 'test' } }, scope: tenantAScope });
        expect(query).toHaveBeenCalledWith({ where: { name: 'test', tenant_id: 'tenant-a' } });
      });
    }

    it('adds where and is idempotent — preserves existing where fields', async () => {
      const query = await exec({ model: 'User', operation: 'findMany', args: { where: { email: 'a@b.com' } }, scope: tenantAScope });
      expect(query).toHaveBeenCalledWith({ where: { email: 'a@b.com', tenant_id: 'tenant-a' } });
    });
  });

  describe('injects tenant_id into data for create', () => {
    it('create adds tenant_id to data', async () => {
      const query = await exec({ model: 'User', operation: 'create', args: { data: { name: 'new' } }, scope: tenantAScope });
      expect(query).toHaveBeenCalledWith({ data: { name: 'new', tenant_id: 'tenant-a' } });
    });

    it('createMany adds tenant_id to each item', async () => {
      const query = await exec({
        model: 'User', operation: 'createMany', args: { data: [{ name: 'a' }, { name: 'b' }] }, scope: tenantAScope,
      });
      expect(query).toHaveBeenCalledWith({
        data: [{ name: 'a', tenant_id: 'tenant-a' }, { name: 'b', tenant_id: 'tenant-a' }],
      });
    });
  });

  describe('update / delete / upsert operations', () => {
    it('update adds tenant_id to where', async () => {
      const query = await exec({ model: 'User', operation: 'update', args: { where: { id: 'x' }, data: { name: 'new' } }, scope: tenantAScope });
      expect(query).toHaveBeenCalledWith({ where: { id: 'x', tenant_id: 'tenant-a' }, data: { name: 'new' } });
    });

    it('delete adds tenant_id to where', async () => {
      const query = await exec({ model: 'User', operation: 'delete', args: { where: { id: 'x' } }, scope: tenantAScope });
      expect(query).toHaveBeenCalledWith({ where: { id: 'x', tenant_id: 'tenant-a' } });
    });

    it('upsert adds tenant_id to where and create', async () => {
      const query = await exec({
        model: 'User', operation: 'upsert',
        args: { where: { id: 'x' }, create: { name: 'new' }, update: { name: 'updated' } },
        scope: tenantAScope,
      });
      expect(query).toHaveBeenCalledWith({
        where: { id: 'x', tenant_id: 'tenant-a' },
        create: { name: 'new', tenant_id: 'tenant-a' },
        update: { name: 'updated' },
      });
    });

    it('updateMany adds tenant_id to where', async () => {
      const query = await exec({ model: 'User', operation: 'updateMany', args: { where: { name: 'x' }, data: { name: 'y' } }, scope: tenantAScope });
      expect(query).toHaveBeenCalledWith({ where: { name: 'x', tenant_id: 'tenant-a' }, data: { name: 'y' } });
    });

    it('deleteMany adds tenant_id to where', async () => {
      const query = await exec({ model: 'User', operation: 'deleteMany', args: { where: { name: 'x' } }, scope: tenantAScope });
      expect(query).toHaveBeenCalledWith({ where: { name: 'x', tenant_id: 'tenant-a' } });
    });
  });

  describe('tenant isolation — two tenants do not leak', () => {
    it('Tenant A query does not see Tenant B data', async () => {
      const queryA = vi.fn().mockResolvedValue([{ id: '1', tenant_id: 'tenant-a' }]);
      const queryB = vi.fn().mockResolvedValue([{ id: '2', tenant_id: 'tenant-b' }]);

      const clsA = mockCls(tenantAScope);
      const clsB = mockCls(tenantBScope);

      const resultA = await applyTenantScope(clsA, 'Party', 'findMany', { where: { type: 'lead' } }, queryA);
      const resultB = await applyTenantScope(clsB, 'Party', 'findMany', { where: { type: 'lead' } }, queryB);

      expect(queryA).toHaveBeenCalledWith({ where: { type: 'lead', tenant_id: 'tenant-a' } });
      expect(queryB).toHaveBeenCalledWith({ where: { type: 'lead', tenant_id: 'tenant-b' } });

      for (const row of (resultA as any[])) {
        expect(row.tenant_id).toBe('tenant-a');
      }
      for (const row of (resultB as any[])) {
        expect(row.tenant_id).toBe('tenant-b');
      }
    });
  });

  describe('background job context', () => {
    it('succeeds when ClsService.run() provides scope', async () => {
      const cls = mockCls(tenantAScope);
      const query = vi.fn().mockResolvedValue([{ id: '1' }]);

      const result = await applyTenantScope(cls, 'Case', 'findMany', { where: { stage: 'open' } }, query);
      expect(result).toEqual([{ id: '1' }]);
      expect(query).toHaveBeenCalledWith({ where: { stage: 'open', tenant_id: 'tenant-a' } });
    });

    it('throws MissingTenantContextError without ClsService context', async () => {
      const cls = mockCls(null);
      await expect(
        applyTenantScope(cls, 'Case', 'findMany', { where: { stage: 'open' } }, vi.fn()),
      ).rejects.toThrow(MissingTenantContextError);
    });
  });

  describe('TENANT_SCOPED_MODELS includes expected models', () => {
    it('contains all tenant-scoped models', () => {
      expect(TENANT_SCOPED_MODELS).toContain('Brand');
      expect(TENANT_SCOPED_MODELS).toContain('Branch');
      expect(TENANT_SCOPED_MODELS).toContain('User');
      expect(TENANT_SCOPED_MODELS).toContain('Party');
      expect(TENANT_SCOPED_MODELS).toContain('Case');
      expect(TENANT_SCOPED_MODELS).toContain('TenantPlugin');
      expect(TENANT_SCOPED_MODELS).toContain('TenantPlan');
    });

    it('does NOT include non-tenant-scoped models', () => {
      expect(TENANT_SCOPED_MODELS).not.toContain('Tenant');
      expect(TENANT_SCOPED_MODELS).not.toContain('PlatformUser');
      expect(TENANT_SCOPED_MODELS).not.toContain('RefreshToken');
      expect(TENANT_SCOPED_MODELS).not.toContain('PluginRegistry');
      expect(TENANT_SCOPED_MODELS).not.toContain('SubscriptionPlan');
      expect(TENANT_SCOPED_MODELS).not.toContain('IndustryTemplate');
    });
  });

  describe('vertical awareness scoping', () => {
    it("User with vertical_ids: ['v1', 'v2'] cannot see cases where vertical_id = 'v3'", async () => {
      const scope: RequestScope = {
        user_id: 'user-a',
        tenant_id: 'tenant-a',
        assignment_ids: ['assign-1'],
        role: TenantRole.BranchUser,
        vertical_ids: ['v1', 'v2'],
      };

      const query = await exec({
        model: 'Case',
        operation: 'findMany',
        args: { where: { stage: 'open' } },
        scope,
      });

      expect(query).toHaveBeenCalledWith({
        where: {
          stage: 'open',
          tenant_id: 'tenant-a',
          vertical_id: { in: ['v1', 'v2'] },
        },
      });
    });

    it('User with empty vertical_ids: can see all cases in tenant', async () => {
      const scope: RequestScope = {
        user_id: 'user-a',
        tenant_id: 'tenant-a',
        assignment_ids: ['assign-1'],
        role: TenantRole.BranchManager,
        vertical_ids: [],
      };

      const query = await exec({
        model: 'Case',
        operation: 'findMany',
        args: { where: { stage: 'open' } },
        scope,
      });

      expect(query).toHaveBeenCalledWith({
        where: {
          stage: 'open',
          tenant_id: 'tenant-a',
        },
      });
    });

    it("Vertical filter compounds with tenant filter: cannot see other tenant's cases even with matching vertical_id", async () => {
      const scope: RequestScope = {
        user_id: 'user-a',
        tenant_id: 'tenant-a',
        assignment_ids: ['assign-1'],
        role: TenantRole.BranchUser,
        vertical_ids: ['v1'],
      };

      const query = await exec({
        model: 'Case',
        operation: 'findMany',
        args: { where: { vertical_id: 'v1' } },
        scope,
      });

      expect(query).toHaveBeenCalledWith({
        where: {
          vertical_id: { in: ['v1'] },
          tenant_id: 'tenant-a',
        },
      });
    });
  });
});
