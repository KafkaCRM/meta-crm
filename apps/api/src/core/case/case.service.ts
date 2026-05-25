import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { CaseEventService } from './events/case-event.service';
import type { CreateCaseDto } from './dto/create-case.dto';
import type { RequestScope } from '../tenant/request-scope.interface';
import { CampaignAutoTagService } from '../campaign/campaign-auto-tag.service';
import { FieldValidationService } from '../metadata/field-validation.service';

export type CaseErrorCode = 'NOT_FOUND' | 'PARTY_NOT_FOUND' | 'WORKFLOW_NOT_FOUND' | 'VALIDATION_FAILED';

export interface CaseError {
  code: CaseErrorCode;
  message?: string;
  errors?: string[];
}

@Injectable()
export class CaseService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly caseEvent: CaseEventService,
    private readonly campaignAutoTagService: CampaignAutoTagService,
    private readonly fieldValidation: FieldValidationService,
  ) {}

  async findMany(params: {
    cursor?: string;
    limit?: number;
    stage?: string;
    assigned_to_id?: string;
    party_id?: string;
    type?: string;
    vertical_id?: string;
    campaign_id?: string;
    channel?: string;
    include?: string;
  }): Promise<Result<{ data: any[]; next_cursor?: string }, CaseError>> {
    const limit = Math.min(params.limit ?? 50, 100);

    const where: Record<string, any> = {};
    if (params.stage) where.stage = params.stage;
    if (params.assigned_to_id) where.assigned_to_id = params.assigned_to_id;
    if (params.party_id) where.party_id = params.party_id;
    if (params.type) where.type = params.type;
    if (params.vertical_id) where.vertical_id = params.vertical_id;
    if (params.campaign_id) where.campaign_id = params.campaign_id;

    if (params.channel) {
      const campaigns = await this.db.getClient().campaign.findMany({
        where: { channel: params.channel },
        select: { id: true },
      });
      const campaignIds = campaigns.map((c) => c.id);
      where.campaign_id = { in: campaignIds };
    }

    const cases = await this.db.getClient().case.findMany({
      where,
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      include: { party: true },
    });

    const hasMore = cases.length > limit;
    const data = hasMore ? cases.slice(0, limit) : cases;

    const includeCampaign = params.include === 'campaign' || params.include?.includes('campaign');

    const formattedData = await Promise.all(
      data.map(async (c: any) => {
        let campaign: any = undefined;
        if (includeCampaign && c.campaign_id) {
          const camp = await this.db.getClient().campaign.findUnique({
            where: { id: c.campaign_id },
            select: { id: true, name: true, channel: true },
          });
          if (camp) {
            campaign = camp;
          }
        }
        return {
          ...c,
          campaign,
        };
      }),
    );

    return ok({
      data: formattedData,
      ...(hasMore ? { next_cursor: data[data.length - 1]?.id } : {}),
    });
  }

  async findOne(id: string, include?: string): Promise<Result<any, CaseError>> {
    const caseRecord = await this.db.getClient().case.findUnique({
      where: { id },
      include: {
        party: true,
        caseEvents: { orderBy: { occurred_at: 'desc' }, take: 20 },
        interactions: { orderBy: { created_at: 'desc' }, take: 10 },
      },
    });

    if (!caseRecord) {
      return err({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    let campaign: any = undefined;
    const includeCampaign = include === 'campaign' || include?.includes('campaign');
    if (includeCampaign && caseRecord.campaign_id) {
      const camp = await this.db.getClient().campaign.findUnique({
        where: { id: caseRecord.campaign_id },
        select: { id: true, name: true, channel: true },
      });
      if (camp) {
        campaign = camp;
      }
    }

    return ok({
      ...(caseRecord as any),
      campaign,
    });
  }

  async create(dto: CreateCaseDto): Promise<Result<any, CaseError>> {
    const scope = this.cls.get<RequestScope>('scope');

    const party = await this.db.getClient().party.findUnique({
      where: { id: dto.party_id },
    });
    if (!party) {
      return err({ code: 'PARTY_NOT_FOUND', message: 'Party not found' });
    }

    const workflow = await this.db.getClient().workflowDefinition.findUnique({
      where: { id: dto.workflow_definition_id },
    });
    if (!workflow) {
      return err({ code: 'WORKFLOW_NOT_FOUND', message: 'Workflow definition not found' });
    }

    const validationResult = await this.fieldValidation.validateAttributes('Case', dto.attributes ?? {});
    if (validationResult.isErr()) {
      return err({
        code: 'VALIDATION_FAILED',
        message: 'Attributes validation failed',
        errors: validationResult.error,
      } as CaseError);
    }

    let campaignId = dto.campaign_id;

    const caseRecord = await this.db.getClient().case.create({
      data: {
        party_id: dto.party_id,
        type: dto.type,
        title: dto.title,
        stage: dto.stage,
        workflow_definition_id: dto.workflow_definition_id,
        branch_brand_assignment_id: dto.branch_brand_assignment_id,
        assigned_to_id: dto.assigned_to_id,
        vertical_id: dto.vertical_id,
        campaign_id: campaignId,
        attributes: (dto.attributes ?? {}) as any,
      } as any,
    });

    if (!campaignId && dto.vertical_id) {
      const autoTagResult = await this.campaignAutoTagService.autoTagCampaign({
        caseId: caseRecord.id,
        channel: ((dto as any).source || party.source),
        utmCampaign: dto.utm_campaign ?? null,
        verticalId: dto.vertical_id,
        scope: scope!,
      });
      if (autoTagResult.isOk() && autoTagResult.value) {
        campaignId = autoTagResult.value;
        caseRecord.campaign_id = campaignId;
      }
    }

    await this.caseEvent.write({
      case_id: caseRecord.id,
      event_type: 'case_created',
      actor_id: scope?.user_id ?? 'system',
      actor_type: 'user',
      payload: { title: dto.title, type: dto.type, stage: dto.stage },
    });

    return ok(caseRecord);
  }

  async update(
    id: string,
    data: { title?: string; attributes?: Record<string, unknown>; assigned_to_id?: string | null },
  ): Promise<Result<any, CaseError>> {
    const scope = this.cls.get<RequestScope>('scope');

    const existing = await this.db.getClient().case.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.attributes !== undefined) {
      const validationResult = await this.fieldValidation.validateAttributes('Case', data.attributes);
      if (validationResult.isErr()) {
        return err({
          code: 'VALIDATION_FAILED',
          message: 'Attributes validation failed',
          errors: validationResult.error,
        } as CaseError);
      }
      updateData.attributes = data.attributes;
    }
    if (data.assigned_to_id !== undefined) {
      updateData.assigned_to_id = data.assigned_to_id;
      await this.caseEvent.write({
        case_id: id,
        event_type: 'assignment_changed',
        actor_id: scope?.user_id ?? 'system',
        actor_type: 'user',
        payload: { from: existing.assigned_to_id, to: data.assigned_to_id },
      });
    }

    const updated = await this.db.getClient().case.update({
      where: { id },
      data: updateData,
    });

    if (data.attributes !== undefined) {
      await this.caseEvent.write({
        case_id: id,
        event_type: 'attribute_updated',
        actor_id: scope?.user_id ?? 'system',
        actor_type: 'user',
      });
    }

    return ok(updated);
  }

  async bulkAssign(
    caseIds: string[],
    assigned_to_id: string | null,
  ): Promise<Result<{ count: number }, CaseError>> {
    const scope = this.cls.get<RequestScope>('scope');

    for (const caseId of caseIds) {
      const existing = await this.db.getClient().case.findUnique({ where: { id: caseId } });
      if (!existing) continue;

      await this.db.getClient().case.update({
        where: { id: caseId },
        data: { assigned_to_id },
      });

      await this.caseEvent.write({
        case_id: caseId,
        event_type: 'assignment_changed',
        actor_id: scope?.user_id ?? 'system',
        actor_type: 'user',
        payload: { from: existing.assigned_to_id, to: assigned_to_id },
      });
    }

    return ok({ count: caseIds.length });
  }

  async findEvents(
    caseId: string,
    params: { cursor?: string; limit?: number },
  ): Promise<Result<{ data: any[]; next_cursor?: string }, CaseError>> {
    const limit = Math.min(params.limit ?? 50, 100);

    const events = await this.db.getClient().caseEvent.findMany({
      where: { case_id: caseId },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { occurred_at: 'desc' },
    });

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;

    return ok({
      data,
      ...(hasMore ? { next_cursor: data[data.length - 1]?.id } : {}),
    });
  }
}
