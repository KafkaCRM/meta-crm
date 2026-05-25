import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { HooksService } from '../hooks/hooks.service';
import { VerticalService } from './vertical.service';
import type { RequestScope } from '../tenant/request-scope.interface';

function mockCls(scope: RequestScope): ClsService {
  return { get: vi.fn().mockReturnValue(scope) } as unknown as ClsService;
}

function mockHooks(): HooksService {
  return {
    emit: vi.fn().mockResolvedValue(undefined),
  } as unknown as HooksService;
}

function mockDb() {
  const client = {
    vertical: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    branchBrandAssignment: {
      findMany: vi.fn(),
    },
    workflowDefinition: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    campaign: {
      count: vi.fn(),
    },
    workflowStage: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    case: {
      count: vi.fn(),
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
  description: 'NEET Coaching',
  status: 'active',
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
};

describe('VerticalService', () => {
  let db: TenantScopedPrismaService;
  let cls: ClsService;
  let hooks: HooksService;
  let svc: VerticalService;

  beforeEach(() => {
    db = mockDb();
    cls = mockCls(scope);
    hooks = mockHooks();
    svc = new VerticalService(db, cls, hooks);
  });

  describe('create', () => {
    it('creates a vertical and returns it with zero stats', async () => {
      const client = db.getClient();
      (client.vertical.create as any).mockResolvedValue(VERTICAL);

      const result = await svc.create({
        branch_id: 'branch-1',
        name: 'NEET',
        description: 'NEET Coaching',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe('vertical-1');
        expect(result.value.name).toBe('NEET');
        expect(result.value.stats).toEqual({
          total_leads: 0,
          active_leads: 0,
          converted: 0,
          conversion_rate: 0,
          active_campaigns: 0,
          pipelines: 0,
        });
      }
      expect(hooks.emit).toHaveBeenCalledWith('vertical:created', {
        id: 'vertical-1',
        name: 'NEET',
        tenant_id: 'tenant-a',
        branch_id: 'branch-1',
      });
    });
  });

  describe('list', () => {
    it('lists verticals filtered by brand_id', async () => {
      const client = db.getClient();
      (client.branchBrandAssignment.findMany as any).mockResolvedValue([{ branch_id: 'branch-1' }]);
      (client.vertical.findMany as any).mockResolvedValue([VERTICAL]);
      (client.workflowDefinition.count as any).mockResolvedValue(1);
      (client.campaign.count as any).mockResolvedValue(2);

      const result = await svc.list({ brand_id: 'brand-a', status: 'active' });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]?.pipeline_count).toBe(1);
        expect(result.value[0]?.active_campaign_count).toBe(2);
      }
      expect(client.branchBrandAssignment.findMany).toHaveBeenCalledWith({
        where: { brand_id: 'brand-a' },
        select: { branch_id: true },
      });
      expect(client.vertical.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          branch_id: { in: ['branch-1'] },
        },
        orderBy: { created_at: 'desc' },
      });
    });

    it('lists verticals without brand_id filtering', async () => {
      const client = db.getClient();
      (client.vertical.findMany as any).mockResolvedValue([VERTICAL]);
      (client.workflowDefinition.count as any).mockResolvedValue(0);
      (client.campaign.count as any).mockResolvedValue(0);

      const result = await svc.list({ status: 'active' });

      expect(result.isOk()).toBe(true);
      expect(client.branchBrandAssignment.findMany).not.toHaveBeenCalled();
      expect(client.vertical.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('updateStatus', () => {
    it('returns VERTICAL_HAS_ACTIVE_CASES error if active cases exist', async () => {
      const client = db.getClient();
      (client.vertical.findUnique as any).mockResolvedValue(VERTICAL);
      (client.workflowDefinition.findMany as any).mockResolvedValue([{ id: 'wf-1' }]);
      (client.workflowStage.groupBy as any).mockResolvedValue([{ workflow_definition_id: 'wf-1', _max: { order: 3 } }]);
      (client.workflowStage.findMany as any).mockResolvedValue([{ id: 'stage-final' }]);
      (client.case.count as any).mockResolvedValue(3);

      const result = await svc.updateStatus('vertical-1', 'inactive');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('VERTICAL_HAS_ACTIVE_CASES');
        expect(result.error.count).toBe(3);
      }
      expect(client.vertical.update).not.toHaveBeenCalled();
      expect(hooks.emit).not.toHaveBeenCalled();
    });

    it('returns VERTICAL_HAS_ACTIVE_CASES error if active cases exist with no workflow definitions', async () => {
      const client = db.getClient();
      (client.vertical.findUnique as any).mockResolvedValue(VERTICAL);
      (client.workflowDefinition.findMany as any).mockResolvedValue([]);
      (client.case.count as any).mockResolvedValue(2);

      const result = await svc.updateStatus('vertical-1', 'inactive');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('VERTICAL_HAS_ACTIVE_CASES');
        expect(result.error.count).toBe(2);
      }
    });

    it('succeeds in deactivating vertical if no active cases exist', async () => {
      const client = db.getClient();
      (client.vertical.findUnique as any).mockResolvedValue(VERTICAL);

      // For getActiveCasesCount
      (client.workflowDefinition.findMany as any).mockImplementation((args: any) => {
        return Promise.resolve([{ id: 'wf-1' }]);
      });
      (client.workflowStage.groupBy as any).mockResolvedValue([{ workflow_definition_id: 'wf-1', _max: { order: 3 } }]);
      (client.workflowStage.findMany as any).mockResolvedValue([{ id: 'stage-final' }]);
      
      // For getActiveCasesCount and calculateStats
      (client.case.count as any).mockImplementation((args: any) => {
        const where = args?.where;
        if (where?.stage?.notIn) {
          return Promise.resolve(0);
        }
        if (where?.stage?.in) {
          return Promise.resolve(5);
        }
        return Promise.resolve(5);
      });

      (client.vertical.update as any).mockResolvedValue({ ...VERTICAL, status: 'inactive' });
      (client.campaign.count as any).mockResolvedValue(0);
      (client.workflowDefinition.count as any).mockResolvedValue(1);

      const result = await svc.updateStatus('vertical-1', 'inactive');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe('inactive');
        expect(result.value.stats).toEqual({
          total_leads: 5,
          active_leads: 0,
          converted: 5,
          conversion_rate: 100,
          active_campaigns: 0,
          pipelines: 1,
        });
      }
      expect(client.vertical.update).toHaveBeenCalledWith({
        where: { id: 'vertical-1' },
        data: { status: 'inactive' },
      });
      expect(hooks.emit).toHaveBeenCalledWith('vertical:deactivated', {
        id: 'vertical-1',
        name: 'NEET',
        tenant_id: 'tenant-a',
        branch_id: 'branch-1',
      });
    });
  });

  describe('findOne stats calculation', () => {
    it('increments total_leads when case count increases', async () => {
      const client = db.getClient();
      (client.vertical.findUnique as any).mockResolvedValue(VERTICAL);
      (client.campaign.count as any).mockResolvedValue(0);
      (client.workflowDefinition.count as any).mockResolvedValue(1);
      (client.workflowDefinition.findMany as any).mockResolvedValue([{ id: 'wf-1' }]);
      (client.workflowStage.groupBy as any).mockResolvedValue([{ workflow_definition_id: 'wf-1', _max: { order: 3 } }]);
      (client.workflowStage.findMany as any).mockResolvedValue([{ id: 'stage-final' }]);

      // First run: 5 total leads, 4 converted, 1 active
      let mockTotalLeads = 5;
      (client.case.count as any).mockImplementation((args: any) => {
        const where = args?.where;
        if (where?.stage?.notIn) {
          return Promise.resolve(1);
        }
        if (where?.stage?.in) {
          return Promise.resolve(4);
        }
        return Promise.resolve(mockTotalLeads);
      });

      const firstResult = await svc.findOne('vertical-1');
      expect(firstResult.isOk()).toBe(true);
      if (firstResult.isOk()) {
        expect(firstResult.value.stats.total_leads).toBe(5);
        expect(firstResult.value.stats.active_leads).toBe(1);
        expect(firstResult.value.stats.converted).toBe(4);
        expect(firstResult.value.stats.conversion_rate).toBe(80);
      }

      // Simulate a new case creation by incrementing count
      mockTotalLeads = 6;
      // Let's assume the new lead is active, so active leads becomes 2
      (client.case.count as any).mockImplementation((args: any) => {
        const where = args?.where;
        if (where?.stage?.notIn) {
          return Promise.resolve(2);
        }
        if (where?.stage?.in) {
          return Promise.resolve(4);
        }
        return Promise.resolve(mockTotalLeads);
      });

      const secondResult = await svc.findOne('vertical-1');
      expect(secondResult.isOk()).toBe(true);
      if (secondResult.isOk()) {
        expect(secondResult.value.stats.total_leads).toBe(6);
        expect(secondResult.value.stats.active_leads).toBe(2);
        expect(secondResult.value.stats.converted).toBe(4);
        expect(secondResult.value.stats.conversion_rate).toBe(66.67);
      }
    });
  });
});
