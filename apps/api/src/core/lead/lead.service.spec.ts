import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { LeadService } from './lead.service';
import type { RequestScope } from '../tenant/request-scope.interface';

function mockCls(scope: RequestScope): ClsService {
  return { get: vi.fn().mockReturnValue(scope) } as unknown as ClsService;
}

function mockDb() {
  const transactionMock = vi.fn().mockImplementation(async (callback) => {
    return callback({
      party: {
        create: vi.fn().mockResolvedValue({ id: 'party-1' }),
      },
      case: {
        create: vi.fn().mockResolvedValue({ id: 'case-1' }),
      },
      lead: {
        update: vi.fn().mockResolvedValue({ id: 'lead-1', status: 'converted' }),
      },
      pipelineDefinition: {
        findFirst: vi.fn().mockResolvedValue({ id: 'wf-1', vertical_id: 'vert-1' }),
      },
      pipelineStage: {
        findMany: vi.fn().mockResolvedValue([{ id: 'stage-1', order: 0 }]),
      },
    });
  });

  return {
    getClient: vi.fn().mockReturnValue({
      lead: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      party: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: transactionMock,
    }),
  } as unknown as TenantScopedPrismaService;
}

const scope: RequestScope = {
  user_id: 'user-a',
  tenant_id: 'tenant-a',
  assignment_ids: ['assign-1'],
  role: 'branch_user' as any,
};

const LEAD = {
  id: 'lead-1',
  tenant_id: 'tenant-a',
  name: 'Lead John',
  email: 'leadjohn@example.com',
  phone: '+919876543210',
  source: 'facebook',
  status: 'new',
  notes: 'Interested in property',
  attributes: {},
  created_at: new Date('2025-01-01'),
};

describe('LeadService', () => {
  let db: TenantScopedPrismaService;
  let cls: ClsService;
  let svc: LeadService;

  beforeEach(() => {
    db = mockDb();
    cls = mockCls(scope);
    svc = new LeadService(db, cls);
  });

  describe('findMany', () => {
    it('returns paginated results', async () => {
      const client = db.getClient();
      (client.lead.findMany as any).mockResolvedValue([LEAD]);

      const result = await svc.findMany({ limit: 10 });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.data).toHaveLength(1);
      }
    });
  });

  describe('findOne', () => {
    it('returns lead when found', async () => {
      const client = db.getClient();
      (client.lead.findUnique as any).mockResolvedValue(LEAD);

      const result = await svc.findOne('lead-1');
      expect(result.isOk()).toBe(true);
    });

    it('returns NOT_FOUND when missing', async () => {
      const client = db.getClient();
      (client.lead.findUnique as any).mockResolvedValue(null);

      const result = await svc.findOne('lead-1');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('convert', () => {
    it('successfully converts lead to party and case in transaction', async () => {
      const client = db.getClient();
      (client.lead.findUnique as any).mockResolvedValue(LEAD);

      const result = await svc.convert('lead-1', {
        branch_brand_assignment_id: 'assign-1',
        create_case: true,
        case_title: 'Custom Opportunity',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.party_id).toBe('party-1');
        expect(result.value.case_id).toBe('case-1');
      }
    });

    it('returns ALREADY_CONVERTED if lead is already converted', async () => {
      const client = db.getClient();
      (client.lead.findUnique as any).mockResolvedValue({ ...LEAD, status: 'converted' });

      const result = await svc.convert('lead-1', {
        branch_brand_assignment_id: 'assign-1',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('ALREADY_CONVERTED');
      }
    });
  });
});
