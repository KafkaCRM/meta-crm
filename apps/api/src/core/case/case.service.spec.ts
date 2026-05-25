import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { CaseEventService } from './events/case-event.service';
import { CampaignAutoTagService } from '../campaign/campaign-auto-tag.service';
import { CaseService } from './case.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { ok } from 'neverthrow';
import { FieldValidationService } from '../metadata/field-validation.service';

function mockCls(scope: RequestScope): ClsService {
  return { get: vi.fn().mockReturnValue(scope) } as unknown as ClsService;
}

function mockCaseEvent(): CaseEventService {
  return { write: vi.fn().mockResolvedValue(undefined) } as unknown as CaseEventService;
}

function mockAutoTag(): CampaignAutoTagService {
  return { autoTagCampaign: vi.fn().mockResolvedValue(ok('campaign-1')) } as unknown as CampaignAutoTagService;
}

function mockFieldValidation(): FieldValidationService {
  return {
    validateAttributes: vi.fn().mockResolvedValue(ok(undefined)),
  } as unknown as FieldValidationService;
}

function mockDb() {
  const client = {
    case: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    party: {
      findUnique: vi.fn(),
    },
    workflowDefinition: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    workflowStage: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    campaign: {
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

const CASE = {
  id: 'case-1',
  tenant_id: 'tenant-a',
  party_id: 'party-1',
  type: 'individual',
  title: 'NEET Admission',
  stage: 'stage-1',
  workflow_definition_id: 'wf-1',
  branch_brand_assignment_id: 'assign-1',
  assigned_to_id: null,
  vertical_id: null,
  campaign_id: null,
  attributes: {},
  created_at: new Date(),
  updated_at: new Date(),
};

const PARTY = {
  id: 'party-1',
  source: 'whatsapp',
};

const WORKFLOW = {
  id: 'wf-1',
};

describe('CaseService Campaigns & Verticals Integration', () => {
  let db: TenantScopedPrismaService;
  let cls: ClsService;
  let caseEvent: CaseEventService;
  let autoTagService: CampaignAutoTagService;
  let fieldValidation: FieldValidationService;
  let caseService: CaseService;

  beforeEach(() => {
    db = mockDb();
    cls = mockCls(scope);
    caseEvent = mockCaseEvent();
    autoTagService = mockAutoTag();
    fieldValidation = mockFieldValidation();
    caseService = new CaseService(db, cls, caseEvent, autoTagService, fieldValidation);
  });

  describe('create case auto-tagging', () => {
    it('Create case with vertical_id and utm_campaign → auto-tagged to campaign', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue(PARTY);
      (client.workflowDefinition.findUnique as any).mockResolvedValue(WORKFLOW);
      (client.workflowDefinition.findFirst as any).mockResolvedValue(WORKFLOW);
      (client.case.create as any).mockResolvedValue({ ...CASE, vertical_id: 'vertical-1' });

      const result = await caseService.create({
        party_id: 'party-1',
        type: 'individual',
        title: 'NEET Admission',
        workflow_definition_id: 'wf-1',
        stage: 'stage-1',
        branch_brand_assignment_id: 'assign-1',
        vertical_id: 'vertical-1',
        utm_campaign: 'neet-facebook-may-2026',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.campaign_id).toBe('campaign-1');
      }

      expect(autoTagService.autoTagCampaign).toHaveBeenCalledWith({
        caseId: 'case-1',
        channel: 'whatsapp',
        utmCampaign: 'neet-facebook-may-2026',
        verticalId: 'vertical-1',
        scope,
      });
    });

    it('Create case with vertical_id and channel=whatsapp → auto-tagged to active campaign matching channel + vertical', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue(PARTY);
      (client.workflowDefinition.findUnique as any).mockResolvedValue(WORKFLOW);
      (client.workflowDefinition.findFirst as any).mockResolvedValue(WORKFLOW);
      (client.case.create as any).mockResolvedValue({ ...CASE, vertical_id: 'vertical-1' });

      const result = await caseService.create({
        party_id: 'party-1',
        type: 'individual',
        title: 'NEET Admission',
        workflow_definition_id: 'wf-1',
        stage: 'stage-1',
        branch_brand_assignment_id: 'assign-1',
        vertical_id: 'vertical-1',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.campaign_id).toBe('campaign-1');
      }

      expect(autoTagService.autoTagCampaign).toHaveBeenCalledWith({
        caseId: 'case-1',
        channel: 'whatsapp',
        utmCampaign: null,
        verticalId: 'vertical-1',
        scope,
      });
    });

    it('Create case with campaign_id manually set → that campaign used, autoTagService NOT called', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue(PARTY);
      (client.workflowDefinition.findUnique as any).mockResolvedValue(WORKFLOW);
      (client.workflowDefinition.findFirst as any).mockResolvedValue(WORKFLOW);
      (client.case.create as any).mockResolvedValue({
        ...CASE,
        vertical_id: 'vertical-1',
        campaign_id: 'campaign-custom',
      });

      const result = await caseService.create({
        party_id: 'party-1',
        type: 'individual',
        title: 'NEET Admission',
        workflow_definition_id: 'wf-1',
        stage: 'stage-1',
        branch_brand_assignment_id: 'assign-1',
        vertical_id: 'vertical-1',
        campaign_id: 'campaign-custom',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.campaign_id).toBe('campaign-custom');
      }
      expect(autoTagService.autoTagCampaign).not.toHaveBeenCalled();
    });

    it('Create case with no vertical_id → campaign_id stays null, no error', async () => {
      const client = db.getClient();
      (client.party.findUnique as any).mockResolvedValue(PARTY);
      (client.workflowDefinition.findUnique as any).mockResolvedValue(WORKFLOW);
      (client.workflowDefinition.findFirst as any).mockResolvedValue(WORKFLOW);
      (client.case.create as any).mockResolvedValue(CASE);

      const result = await caseService.create({
        party_id: 'party-1',
        type: 'individual',
        title: 'NEET Admission',
        workflow_definition_id: 'wf-1',
        stage: 'stage-1',
        branch_brand_assignment_id: 'assign-1',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.campaign_id).toBeNull();
      }
      expect(autoTagService.autoTagCampaign).not.toHaveBeenCalled();
    });
  });

  describe('findMany queries and filters', () => {
    it('GET /cases?vertical_id= → returns only cases for that vertical', async () => {
      const client = db.getClient();
      (client.case.findMany as any).mockResolvedValue([{ ...CASE, vertical_id: 'vertical-1' }]);

      const result = await caseService.findMany({ vertical_id: 'vertical-1' });

      expect(result.isOk()).toBe(true);
      expect(client.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vertical_id: 'vertical-1',
          }),
        }),
      );
    });

    it('GET /cases?campaign_id= → returns only cases for that campaign', async () => {
      const client = db.getClient();
      (client.case.findMany as any).mockResolvedValue([{ ...CASE, campaign_id: 'campaign-1' }]);

      const result = await caseService.findMany({ campaign_id: 'campaign-1' });

      expect(result.isOk()).toBe(true);
      expect(client.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            campaign_id: 'campaign-1',
          }),
        }),
      );
    });
  });
});
