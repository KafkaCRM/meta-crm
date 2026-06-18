import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { ok } from 'neverthrow';
import { TenantScopedPrismaService } from '../../tenant/tenant-scoped-prisma.service';
import { TenantReportService } from './tenant-report.service';
import type { RequestScope } from '../../tenant/request-scope.interface';
import { CampaignService } from '../../campaign/campaign.service';

const scope: RequestScope = {
  user_id: 'user-1',
  tenant_id: 'tenant-a',
  assignment_ids: ['assign-1'],
  role: 'branch_manager' as any,
};

function buildMocks() {
  const client = {
    lead: { groupBy: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    leadEvent: { findMany: vi.fn() },
    interaction: { groupBy: vi.fn() },
    party: { groupBy: vi.fn() },
    pipelineStage: { groupBy: vi.fn(), findMany: vi.fn() },
    campaign: { findMany: vi.fn(), findFirst: vi.fn() },
  };
  const db = { getClient: vi.fn().mockReturnValue(client) } as unknown as TenantScopedPrismaService;
  const cls = { get: vi.fn().mockReturnValue(scope) } as unknown as ClsService;
  const campaignService = { findOne: vi.fn() } as unknown as CampaignService;
  return { client, db, cls, campaignService };
}

describe('TenantReportService', () => {
  let svc: TenantReportService;
  let client: ReturnType<typeof buildMocks>['client'];
  let campaignServiceMock: ReturnType<typeof buildMocks>['campaignService'];

  beforeEach(() => {
    vi.restoreAllMocks();
    const mocks = buildMocks();
    client = mocks.client;
    campaignServiceMock = mocks.campaignService;
    svc = new TenantReportService(mocks.db, mocks.cls, mocks.campaignService);
  });

  /* ------------------------------------------------------------------ */
  /*  pipelineFunnel                                                      */
  /* ------------------------------------------------------------------ */
  describe('pipelineFunnel', () => {
    it('returns stage counts and percentages', async () => {
      (client.lead.groupBy as any).mockResolvedValue([
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

    it('returns empty array when no leads', async () => {
      (client.lead.groupBy as any).mockResolvedValue([]);

      const result = await svc.pipelineFunnel({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.stages).toEqual([]);
      }
    });

    it('filters by date range', async () => {
      (client.lead.groupBy as any).mockResolvedValue([]);

      await svc.pipelineFunnel({ date_from: '2025-01-01', date_to: '2025-12-31' });

      const callArgs = (client.lead.groupBy as any).mock.calls[0][0];
      expect(callArgs.where.created_at).toBeDefined();
      expect(callArgs.where.created_at.gte).toEqual(new Date('2025-01-01'));
      expect(callArgs.where.created_at.lte).toEqual(new Date('2025-12-31'));
    });

    it('filters by campaign_id', async () => {
      (client.lead.groupBy as any).mockResolvedValue([]);

      await svc.pipelineFunnel({ campaign_id: 'camp-123' });

      expect(client.lead.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ campaign_id: 'camp-123' }),
        }),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /*  conversionRate                                                       */
  /* ------------------------------------------------------------------ */
  describe('conversionRate', () => {
    it('returns rate, total, and converted', async () => {
      (client.lead.count as any).mockResolvedValue(20);
      (client.pipelineStage.groupBy as any).mockResolvedValue([
        { pipeline_definition_id: 'wf-1', _max: { order: 3 } },
      ]);
      (client.pipelineStage.findMany as any).mockResolvedValue([
        { id: 'stage-final' },
      ]);
      (client.lead.findMany as any).mockResolvedValue([
        { id: 'c-1', pipeline_definition_id: 'wf-1', stage: 'stage-final' },
        { id: 'c-2', pipeline_definition_id: 'wf-1', stage: 'Enquiry' },
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
    it('calculates avg hours from lead events', async () => {
      const base = new Date('2025-01-01T10:00:00Z');
      (client.leadEvent.findMany as any).mockResolvedValue([
        { lead_id: 'c-1', from_stage: null, to_stage: 'Enquiry', occurred_at: base },
        { lead_id: 'c-1', from_stage: 'Enquiry', to_stage: 'Review', occurred_at: new Date(base.getTime() + 2 * 3600000) },
        { lead_id: 'c-1', from_stage: 'Review', to_stage: 'Approved', occurred_at: new Date(base.getTime() + 5 * 3600000) },
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

  /* ------------------------------------------------------------------ */
  /*  campaigns                                                          */
  /* ------------------------------------------------------------------ */
  describe('campaigns', () => {
    it('returns campaigns with stats', async () => {
      (client.campaign.findMany as any).mockResolvedValue([
        { id: 'camp-1', name: 'Facebook Ad', channel: 'facebook', pipeline_id: 'pipe-1' },
      ]);
      (client.lead.groupBy as any).mockResolvedValue([
        { campaign_id: 'camp-1', stage: 'stage-final', _count: { id: 5 } },
        { campaign_id: 'camp-1', stage: 'Enquiry', _count: { id: 5 } },
      ]);
      (client.pipelineStage.findMany as any).mockResolvedValue([
        { id: 'Enquiry', name: 'Enquiry', order: 1, pipeline_definition_id: 'pipe-1' },
        { id: 'stage-final', name: 'Won', order: 2, pipeline_definition_id: 'pipe-1' },
      ]);

      const result = await svc.campaigns({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual({
          id: 'camp-1',
          name: 'Facebook Ad',
          channel: 'facebook',
          total_leads: 10,
          converted: 5,
          conversion_rate: 50,
        });
      }
      expect(client.campaign.findMany).toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  campaignComparison                                                */
  /* ------------------------------------------------------------------ */
  describe('campaignComparison', () => {
    it('compares up to 5 campaigns', async () => {
      campaignServiceMock.findOne = vi.fn().mockResolvedValue(ok({ id: 'camp-1', name: 'Camp 1', stats: {} }));

      const result = await svc.campaignComparison(['camp-1']);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].id).toBe('camp-1');
      }
    });

    it('returns error if more than 5 campaigns requested', async () => {
      const result = await svc.campaignComparison(['1', '2', '3', '4', '5', '6']);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_PARAMS');
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  channelPerformance                                                */
  /* ------------------------------------------------------------------ */
  describe('channelPerformance', () => {
    it('aggregates performance by channel and sorts by conversion_rate DESC', async () => {
      (client.campaign.findMany as any).mockResolvedValue([
        { id: 'camp-fb', name: 'Facebook Ad', channel: 'facebook', pipeline_id: 'pipe-1' },
        { id: 'camp-google', name: 'Google Search', channel: 'google', pipeline_id: 'pipe-1' },
      ]);
      (client.lead.groupBy as any).mockResolvedValue([
        { campaign_id: 'camp-fb', stage: 'stage-final', _count: { id: 2 } },
        { campaign_id: 'camp-fb', stage: 'Enquiry', _count: { id: 8 } },
        { campaign_id: 'camp-google', stage: 'stage-final', _count: { id: 5 } },
        { campaign_id: 'camp-google', stage: 'Enquiry', _count: { id: 5 } },
      ]);
      (client.pipelineStage.findMany as any).mockResolvedValue([
        { id: 'Enquiry', name: 'Enquiry', order: 1, pipeline_definition_id: 'pipe-1' },
        { id: 'stage-final', name: 'Won', order: 2, pipeline_definition_id: 'pipe-1' },
      ]);

      const result = await svc.channelPerformance({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toEqual({
          channel: 'google',
          total_leads: 10,
          converted: 5,
          conversion_rate: 50,
        });
        expect(result.value[1]).toEqual({
          channel: 'facebook',
          total_leads: 10,
          converted: 2,
          conversion_rate: 20,
        });
      }
    });
  });
});
