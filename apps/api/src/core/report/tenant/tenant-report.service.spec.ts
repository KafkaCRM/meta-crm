import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../../tenant/tenant-scoped-prisma.service';
import { TenantReportService } from './tenant-report.service';
import type { RequestScope } from '../../tenant/request-scope.interface';

const scope: RequestScope = {
  user_id: 'user-1',
  tenant_id: 'tenant-a',
  assignment_ids: ['assign-1'],
  role: 'branch_manager' as any,
};

function buildMocks() {
  const client = {
    case: { groupBy: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    caseEvent: { findMany: vi.fn() },
    interaction: { groupBy: vi.fn() },
    party: { groupBy: vi.fn() },
    workflowStage: { groupBy: vi.fn(), findMany: vi.fn() },
  };
  const db = { getClient: vi.fn().mockReturnValue(client) } as unknown as TenantScopedPrismaService;
  const cls = { get: vi.fn().mockReturnValue(scope) } as unknown as ClsService;
  return { client, db, cls };
}

describe('TenantReportService', () => {
  let svc: TenantReportService;
  let client: ReturnType<typeof buildMocks>['client'];

  beforeEach(() => {
    vi.restoreAllMocks();
    const mocks = buildMocks();
    client = mocks.client;
    svc = new TenantReportService(mocks.db, mocks.cls);
  });

  /* ------------------------------------------------------------------ */
  /*  pipelineFunnel                                                      */
  /* ------------------------------------------------------------------ */
  describe('pipelineFunnel', () => {
    it('returns stage counts and percentages', async () => {
      (client.case.groupBy as any).mockResolvedValue([
        { stage: 'Enquiry', _count: { id: 10 } },
        { stage: 'Review', _count: { id: 5 } },
        { stage: 'Approved', _count: { id: 5 } },
      ]);

      const result = await svc.pipelineFunnel({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.stages).toHaveLength(3);
        expect(result.value.stages[0]).toEqual({ name: 'Enquiry', count: 10, percentage: 50 });
        expect(result.value.stages[1]).toEqual({ name: 'Review', count: 5, percentage: 25 });
        expect(result.value.stages[2]).toEqual({ name: 'Approved', count: 5, percentage: 25 });
      }
    });

    it('returns empty array when no cases', async () => {
      (client.case.groupBy as any).mockResolvedValue([]);

      const result = await svc.pipelineFunnel({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.stages).toEqual([]);
      }
    });

    it('filters by assignment_id', async () => {
      (client.case.groupBy as any).mockResolvedValue([{ stage: 'Enquiry', _count: { id: 3 } }]);

      await svc.pipelineFunnel({ assignment_id: 'assign-1' });

      expect(client.case.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branch_brand_assignment_id: 'assign-1' }),
        }),
      );
    });

    it('filters by date range', async () => {
      (client.case.groupBy as any).mockResolvedValue([]);

      await svc.pipelineFunnel({ date_from: '2025-01-01', date_to: '2025-12-31' });

      const callArgs = (client.case.groupBy as any).mock.calls[0][0];
      expect(callArgs.where.created_at).toBeDefined();
      expect(callArgs.where.created_at.gte).toEqual(new Date('2025-01-01'));
      expect(callArgs.where.created_at.lte).toEqual(new Date('2025-12-31'));
    });
  });

  /* ------------------------------------------------------------------ */
  /*  conversionRate                                                       */
  /* ------------------------------------------------------------------ */
  describe('conversionRate', () => {
    it('returns rate, total, and converted', async () => {
      (client.case.count as any).mockResolvedValue(20);
      (client.workflowStage.groupBy as any).mockResolvedValue([
        { workflow_definition_id: 'wf-1', _max: { order: 3 } },
      ]);
      (client.workflowStage.findMany as any).mockResolvedValue([
        { id: 'stage-final' },
      ]);
      (client.case.findMany as any).mockResolvedValue([
        { id: 'c-1', workflow_definition_id: 'wf-1', stage: 'stage-final' },
        { id: 'c-2', workflow_definition_id: 'wf-1', stage: 'Enquiry' },
      ]);

      const result = await svc.conversionRate({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.total).toBe(20);
        expect(result.value.converted).toBe(1);
        expect(result.value.rate).toBe(5);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  stageTime                                                            */
  /* ------------------------------------------------------------------ */
  describe('stageTime', () => {
    it('calculates avg hours from case_events', async () => {
      const base = new Date('2025-01-01T10:00:00Z');
      (client.caseEvent.findMany as any).mockResolvedValue([
        { case_id: 'c-1', from_stage: null, to_stage: 'Enquiry', occurred_at: base },
        { case_id: 'c-1', from_stage: 'Enquiry', to_stage: 'Review', occurred_at: new Date(base.getTime() + 2 * 3600000) },
        { case_id: 'c-1', from_stage: 'Review', to_stage: 'Approved', occurred_at: new Date(base.getTime() + 5 * 3600000) },
      ]);

      const result = await svc.stageTime({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.stages).toHaveLength(2);
        const enquiryStage = result.value.stages.find((s) => s.name === 'Enquiry');
        expect(enquiryStage).toBeDefined();
        expect(enquiryStage!.avg_hours).toBe(2);
        expect(enquiryStage!.min_hours).toBe(2);
        expect(enquiryStage!.max_hours).toBe(2);

        const reviewStage = result.value.stages.find((s) => s.name === 'Review');
        expect(reviewStage).toBeDefined();
        expect(reviewStage!.avg_hours).toBe(3);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  interactionVolume                                                    */
  /* ------------------------------------------------------------------ */
  describe('interactionVolume', () => {
    it('groups by channel with inbound/outbound breakdown', async () => {
      (client.interaction.groupBy as any).mockResolvedValue([
        { channel: 'whatsapp', direction: 'inbound', _count: { id: 5 } },
        { channel: 'whatsapp', direction: 'outbound', _count: { id: 3 } },
        { channel: 'email', direction: 'inbound', _count: { id: 2 } },
      ]);

      const result = await svc.interactionVolume({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.channels).toHaveLength(2);
        const wa = result.value.channels.find((c) => c.channel === 'whatsapp');
        expect(wa).toEqual({ channel: 'whatsapp', count: 8, inbound: 5, outbound: 3 });
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  partySources                                                         */
  /* ------------------------------------------------------------------ */
  describe('partySources', () => {
    it('groups parties by source', async () => {
      (client.party.groupBy as any).mockResolvedValue([
        { source: 'manual', _count: { id: 10 } },
        { source: 'whatsapp', _count: { id: 7 } },
      ]);

      const result = await svc.partySources({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.sources).toHaveLength(2);
        expect(result.value.sources[0]).toEqual({ source: 'manual', count: 10 });
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  requestExport                                                        */
  /* ------------------------------------------------------------------ */
  describe('requestExport', () => {
    it('returns a job_id', async () => {
      const result = await svc.requestExport({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.job_id).toBeDefined();
        expect(typeof result.value.job_id).toBe('string');
      }
    });
  });
});
