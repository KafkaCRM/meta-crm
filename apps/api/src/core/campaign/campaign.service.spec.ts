import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { HooksService } from '../hooks/hooks.service';
import { CampaignService } from './campaign.service';
import { CampaignAutoTagService } from './campaign-auto-tag.service';
import type { RequestScope } from '../tenant/request-scope.interface';

function mockCls(scope: RequestScope): ClsService {
  return {
    get: vi.fn().mockReturnValue(scope),
    isActive: vi.fn().mockReturnValue(true),
    set: vi.fn(),
  } as unknown as ClsService;
}

function mockHooks(): HooksService {
  return {
    emit: vi.fn().mockResolvedValue(undefined),
  } as unknown as HooksService;
}

function mockDb() {
  const client = {
    campaign: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue({ id: 'campaign-1', attributes: {} }),
    },
    case: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    pipelineStage: {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    caseEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    interaction: {
      count: vi.fn().mockResolvedValue(0),
    },
    pipelineDefinition: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
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

const CAMPAIGN = {
  id: 'campaign-1',
  tenant_id: 'tenant-a',
  branch_id: 'branch-1',
  brand_id: 'brand-1',
  vertical_id: 'vertical-1',
  pipeline_id: 'pipeline-1',
  name: 'NEET Facebook May 2026',
  status: 'active',
  channel: 'facebook',
  start_date: new Date('2026-05-01'),
  end_date: new Date('2026-05-31'),
  target_leads: 100,
  utm_source: 'facebook',
  utm_medium: 'cpc',
  utm_campaign: 'neet-facebook-may-2026',
  attributes: {},
  created_by: 'user-a',
  created_at: new Date('2026-05-01'),
  updated_at: new Date('2026-05-01'),
};

describe('Campaign Modules', () => {
  let db: TenantScopedPrismaService;
  let cls: ClsService;
  let hooks: HooksService;
  let campaignService: CampaignService;
  let autoTagService: CampaignAutoTagService;

  beforeEach(() => {
    db = mockDb();
    cls = mockCls(scope);
    hooks = mockHooks();
    campaignService = new CampaignService(db, cls, hooks);
    autoTagService = new CampaignAutoTagService(db, cls, hooks);
  });

  describe('Campaign Creation & UTM Slug Generation', () => {
    it('creates campaign and auto-generates utm_campaign slug from name if not provided', async () => {
      const client = db.getClient();
      (client.campaign.create as any).mockResolvedValue({
        ...CAMPAIGN,
        utm_campaign: 'neet-facebook-may-2026',
      });

      const result = await campaignService.create({
        branch_id: 'branch-1',
        brand_id: 'brand-1',
        vertical_id: 'vertical-1',
        pipeline_id: 'pipeline-1',
        name: 'NEET Facebook May 2026',
        channel: 'facebook',
        start_date: new Date('2026-05-01'),
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.utm_campaign).toBe('neet-facebook-may-2026');
        expect(result.value.stats?.total_leads).toBe(0);
      }

      expect(client.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            utm_campaign: 'neet-facebook-may-2026',
          }),
        }),
      );
      expect(hooks.emit).toHaveBeenCalledWith('campaign:created', expect.any(Object));
    });

    it('respects user-provided utm_campaign overrides', async () => {
      const client = db.getClient();
      (client.campaign.create as any).mockResolvedValue({
        ...CAMPAIGN,
        utm_campaign: 'custom-slug-value',
      });

      const result = await campaignService.create({
        branch_id: 'branch-1',
        brand_id: 'brand-1',
        vertical_id: 'vertical-1',
        pipeline_id: 'pipeline-1',
        name: 'NEET Facebook May 2026',
        channel: 'facebook',
        start_date: new Date('2026-05-01'),
        utm_campaign: 'custom-slug-value',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.utm_campaign).toBe('custom-slug-value');
      }
      expect(client.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            utm_campaign: 'custom-slug-value',
          }),
        }),
      );
    });
  });

  describe('campaign-auto-tag.service.ts', () => {
    it('tags case by UTM match when utmCampaign matches active campaign', async () => {
      const client = db.getClient();
      (client.campaign.findFirst as any).mockResolvedValue(CAMPAIGN);

      const result = await autoTagService.autoTagCampaign({
        caseId: 'case-123',
        channel: 'facebook',
        utmCampaign: 'neet-facebook-may-2026',
        verticalId: 'vertical-1',
        scope,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('campaign-1');
      }

      expect(client.campaign.findFirst).toHaveBeenCalledWith({
        where: {
          utm_campaign: 'neet-facebook-may-2026',
          status: 'active',
        },
      });
      expect(client.case.update).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        data: { campaign_id: 'campaign-1' },
      });
      expect(hooks.emit).toHaveBeenCalledWith('campaign:lead_added', {
        campaign_id: 'campaign-1',
        case_id: 'case-123',
        tenant_id: 'tenant-a',
        channel: 'facebook',
        tagged_automatically: true,
      });
    });

    it('tags case by channel+vertical match if no UTM match is found', async () => {
      const client = db.getClient();
      // First findFirst call (UTM match) returns null, second call returns CAMPAIGN
      (client.campaign.findFirst as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(CAMPAIGN);

      const result = await autoTagService.autoTagCampaign({
        caseId: 'case-123',
        channel: 'facebook',
        utmCampaign: 'some-non-matching-utm',
        verticalId: 'vertical-1',
        scope,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('campaign-1');
      }

      expect(client.campaign.findFirst).toHaveBeenCalledTimes(2);
      expect(client.case.update).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        data: { campaign_id: 'campaign-1' },
      });
    });

    it('returns Ok(null) if campaign has expired (past end_date)', async () => {
      const client = db.getClient();
      // Mock search results to return nothing
      (client.campaign.findFirst as any).mockResolvedValue(null);

      const result = await autoTagService.autoTagCampaign({
        caseId: 'case-123',
        channel: 'facebook',
        utmCampaign: null,
        verticalId: 'vertical-1',
        scope,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeNull();
      }
      expect(client.case.update).not.toHaveBeenCalled();
    });

    it('returns Ok(null) if no matches are found', async () => {
      const client = db.getClient();
      (client.campaign.findFirst as any).mockResolvedValue(null);

      const result = await autoTagService.autoTagCampaign({
        caseId: 'case-123',
        channel: 'linkedin',
        utmCampaign: null,
        verticalId: 'vertical-999',
        scope,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeNull();
      }
      expect(client.case.update).not.toHaveBeenCalled();
    });

    it('matches most recently created campaign if multiple channel+vertical candidates match', async () => {
      const client = db.getClient();
      (client.campaign.findFirst as any).mockResolvedValue(CAMPAIGN);

      await autoTagService.autoTagCampaign({
        caseId: 'case-123',
        channel: 'facebook',
        utmCampaign: null,
        verticalId: 'vertical-1',
        scope,
      });

      expect(client.campaign.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
    });
  });

  describe('Campaign Telemetry Statistics', () => {
    it('computes detailed campaign stats', async () => {
      const client = db.getClient();
      (client.campaign.findFirst as any).mockResolvedValue(CAMPAIGN);

      // total leads = 10
      (client.case.count as any).mockImplementation((args: any) => {
        const where = args?.where;
        if (where?.stage?.not) {
          // contacted (not initial)
          return Promise.resolve(8);
        }
        if (where?.stage?.in) {
          if (where.stage.in.includes('stage-won')) {
            // converted
            return Promise.resolve(5);
          }
          if (where.stage.in.includes('stage-lost')) {
            // lost
            return Promise.resolve(3);
          }
        }
        // total leads count
        return Promise.resolve(10);
      });

      // stages in pipeline: Enquiry (initial, order 1), Won (final positive, order 3), Lost (final negative, order 3)
      (client.pipelineStage.findMany as any).mockResolvedValue([
        { id: 'stage-enquiry', name: 'Enquiry', order: 1 },
        { id: 'stage-won', name: 'Closed Won', order: 3 },
        { id: 'stage-lost', name: 'Closed Lost', order: 3 },
      ]);

      (client.case.findMany as any).mockResolvedValue([
        { id: 'case-1', created_at: new Date('2026-05-01') },
        { id: 'case-2', created_at: new Date('2026-05-02') },
      ]);

      (client.caseEvent.findMany as any).mockResolvedValue([
        { case_id: 'case-1', to_stage: 'stage-won', occurred_at: new Date('2026-05-03'), event_type: 'stage_changed' },
        { case_id: 'case-2', to_stage: 'stage-won', occurred_at: new Date('2026-05-06'), event_type: 'stage_changed' },
      ]);

      (client.case.groupBy as any).mockResolvedValue([
        { stage: 'stage-enquiry', _count: { id: 2 } },
        { stage: 'stage-won', _count: { id: 5 } },
        { stage: 'stage-lost', _count: { id: 3 } },
      ]);

      const result = await campaignService.findOne('campaign-1');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const stats = result.value.stats!;
        expect(stats.total_leads).toBe(10);
        expect(stats.contacted).toBe(8);
        expect(stats.converted).toBe(5);
        expect(stats.lost).toBe(3);
        expect(stats.conversion_rate).toBe(50);
        expect(stats.avg_days_to_convert).toBe(3); // case-1 = 2 days, case-2 = 4 days -> avg = 3
        expect(stats.by_stage).toHaveLength(3);
        expect(stats.by_stage[1]?.stage_name).toBe('Closed Won');
        expect(stats.by_stage[1]?.count).toBe(5);
        expect(stats.by_stage[1]?.percentage).toBe(50);
      }
    });
  });

  describe('Campaign Deletion Blocks & Soft Deletion', () => {
    it('returns CAMPAIGN_HAS_LEADS error when attempting to delete a campaign with tagged cases', async () => {
      const client = db.getClient();
      (client.campaign.findFirst as any).mockResolvedValue(CAMPAIGN);
      (client.case.count as any).mockResolvedValue(4);

      const result = await campaignService.delete('campaign-1');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('CAMPAIGN_HAS_LEADS');
        expect(result.error.count).toBe(4);
      }
      expect(client.campaign.update).not.toHaveBeenCalled();
    });

    it('soft deletes successfully when no cases are tagged to the campaign', async () => {
      const client = db.getClient();
      (client.campaign.findFirst as any).mockResolvedValue(CAMPAIGN);
      (client.case.count as any).mockResolvedValue(0);

      const result = await campaignService.delete('campaign-1');

      expect(result.isOk()).toBe(true);
      expect(client.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: { status: 'deleted' },
      });
    });
  });

  describe('Aggregate Report Statistics', () => {
    it('calculates aggregate statistics and resolves top_channel with the highest conversion rate', async () => {
      const client = db.getClient();

      // Mock two active campaigns
      (client.campaign.findMany as any).mockResolvedValue([
        { ...CAMPAIGN, id: 'c-fb', channel: 'facebook', pipeline_id: 'p-1' },
        { ...CAMPAIGN, id: 'c-gg', channel: 'google', pipeline_id: 'p-1' },
      ]);

      // Mock stage count query to calculate stats for each campaign
      // For c-fb (Facebook): 10 leads, 5 converted -> 50%
      // For c-gg (Google): 10 leads, 2 converted -> 20%
      (client.pipelineStage.findMany as any).mockResolvedValue([
        { id: 'stage-won', name: 'Closed Won', order: 3 },
      ]);

      (client.case.count as any).mockImplementation((args: any) => {
        const where = args?.where;
        const isFacebook = where.campaign_id === 'c-fb';
        
        if (where?.stage?.in) {
          // converted
          return Promise.resolve(isFacebook ? 5 : 2);
        }
        // total leads
        return Promise.resolve(10);
      });

      const result = await campaignService.getAggregateStats();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const agg = result.value;
        expect(agg.total_leads).toBe(20);
        expect(agg.total_converted).toBe(7);
        expect(agg.overall_conversion_rate).toBe(35); // 7 / 20 * 100
        expect(agg.top_channel).toBe('facebook'); // facebook conversion rate = 50%, google = 20%
        expect(agg.campaigns).toHaveLength(2);
      }
    });
  });
});
