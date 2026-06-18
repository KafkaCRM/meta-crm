import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { VerticalService } from './vertical.service';
import type { RequestScope } from '../tenant/request-scope.interface';

function mockCls(scope: RequestScope): ClsService {
  return { get: vi.fn().mockReturnValue(scope) } as unknown as ClsService;
}

function mockDb() {
  const client = {
    vertical: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    getClient: vi.fn().mockReturnValue(client),
  } as unknown as TenantScopedPrismaService;
}

const scope: RequestScope = {
  user_id: 'user-a',
  tenant_id: 'tenant-a',
  assignment_ids: ['assign-1'],
  role: 'branch_user' as any,
};

const VERTICAL = {
  id: 'vertical-1',
  tenant_id: 'tenant-a',
  branch_id: 'branch-1',
  name: 'NEET',
  created_at: new Date('2025-01-01'),
};

describe('VerticalService', () => {
  let db: TenantScopedPrismaService;
  let svc: VerticalService;

  beforeEach(() => {
    db = mockDb();
    svc = new VerticalService(db);
  });

  describe('list', () => {
    it('returns verticals filtered by tenant', async () => {
      const client = db.getClient();
      (client.vertical.findMany as any).mockResolvedValue([VERTICAL]);

      const result = await svc.list('tenant-a');

      expect(result).toHaveLength(1);
      expect(client.vertical.findMany).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-a' },
        orderBy: { created_at: 'desc' },
      });
    });

    it('filters by branch_id', async () => {
      const client = db.getClient();
      (client.vertical.findMany as any).mockResolvedValue([VERTICAL]);

      const result = await svc.list('tenant-a', 'branch-1');

      expect(result).toHaveLength(1);
      expect(client.vertical.findMany).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-a', branch_id: 'branch-1' },
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('creates a vertical', async () => {
      const client = db.getClient();
      (client.vertical.create as any).mockResolvedValue(VERTICAL);

      const result = await svc.create('tenant-a', {
        branch_id: 'branch-1',
        name: 'NEET',
      });

      expect(result.id).toBe('vertical-1');
      expect(result.name).toBe('NEET');
      expect(client.vertical.create).toHaveBeenCalledWith({
        data: {
          tenant_id: 'tenant-a',
          branch_id: 'branch-1',
          name: 'NEET',
        },
      });
    });
  });

  describe('findOne', () => {
    it('returns vertical when found', async () => {
      const client = db.getClient();
      (client.vertical.findFirst as any).mockResolvedValue(VERTICAL);

      const result = await svc.findOne('tenant-a', 'vertical-1');
      expect(result.id).toBe('vertical-1');
    });

    it('throws NotFoundException when missing', async () => {
      const client = db.getClient();
      (client.vertical.findFirst as any).mockResolvedValue(null);

      await expect(svc.findOne('tenant-a', 'vertical-404')).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('updates a vertical name', async () => {
      const client = db.getClient();
      (client.vertical.findFirst as any).mockResolvedValue(VERTICAL);
      (client.vertical.update as any).mockResolvedValue({ ...VERTICAL, name: 'JEE' });

      const result = await svc.update('tenant-a', 'vertical-1', { name: 'JEE' });
      expect(result.name).toBe('JEE');
    });
  });
});
