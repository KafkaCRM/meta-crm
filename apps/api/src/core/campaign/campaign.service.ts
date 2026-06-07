import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { HooksService } from '../hooks/hooks.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import type { CreateCampaignDto } from './dto/create-campaign.dto';
import type { UpdateCampaignDto } from './dto/update-campaign.dto';
import type {
  CampaignResponse,
  CampaignStats,
  CampaignAggregateStatsResponse,
  CampaignSummaryStats,
} from './dto/campaign-response.dto';

export type CampaignErrorCode =
  | 'NOT_FOUND'
  | 'CAMPAIGN_HAS_LEADS'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export interface CampaignError {
  code: CampaignErrorCode;
  message?: string;
  count?: number;
}

export function generateUtmSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

@Injectable()
export class CampaignService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly hooks: HooksService,
  ) {}

  private get scope(): RequestScope {
    return this.cls.get<RequestScope>('scope')!;
  }

  async list(params: {
    vertical_id?: string;
    status?: string;
    channel?: string;
  }): Promise<Result<CampaignResponse[], CampaignError>> {
    try {
      const where: Record<string, any> = {
        status: params.status ? params.status : { not: 'deleted' },
      };

      if (params.vertical_id) {
        where.vertical_id = params.vertical_id;
      }

      if (params.channel) {
        where.channel = params.channel;
      }

      const campaigns = await this.db.getClient().campaign.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });

      const listData = await Promise.all(
        campaigns.map(async (c) => {
          const stats = await this.calculateCampaignStats(c.id, c.pipeline_id);
          return {
            id: c.id,
            tenant_id: c.tenant_id,
            branch_id: c.branch_id,
            brand_id: c.brand_id,
            vertical_id: c.vertical_id,
            pipeline_id: c.pipeline_id,
            name: c.name,
            status: c.status,
            channel: c.channel,
            start_date: c.start_date,
            end_date: c.end_date,
            target_leads: c.target_leads,
            utm_source: c.utm_source,
            utm_medium: c.utm_medium,
            utm_campaign: c.utm_campaign,
            attributes: (c.attributes || {}) as Record<string, any>,
            created_by: c.created_by,
            created_at: c.created_at,
            updated_at: c.updated_at,
            stats,
          };
        }),
      );

      return ok(listData);
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to list campaigns',
      });
    }
  }

  async findOne(id: string): Promise<Result<CampaignResponse, CampaignError>> {
    try {
      const campaign = await this.db.getClient().campaign.findFirst({
        where: { id, status: { not: 'deleted' } },
      });

      if (!campaign) {
        return err({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      const stats = await this.calculateCampaignStats(campaign.id, campaign.pipeline_id);
      return ok({
        id: campaign.id,
        tenant_id: campaign.tenant_id,
        branch_id: campaign.branch_id,
        brand_id: campaign.brand_id,
        vertical_id: campaign.vertical_id,
        pipeline_id: campaign.pipeline_id,
        name: campaign.name,
        status: campaign.status,
        channel: campaign.channel,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        target_leads: campaign.target_leads,
        utm_source: campaign.utm_source,
        utm_medium: campaign.utm_medium,
        utm_campaign: campaign.utm_campaign,
        attributes: (campaign.attributes || {}) as Record<string, any>,
        created_by: campaign.created_by,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
        stats,
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to retrieve campaign',
      });
    }
  }

  async create(dto: CreateCampaignDto): Promise<Result<CampaignResponse, CampaignError>> {
    try {
      const utmCampaign = dto.utm_campaign || generateUtmSlug(dto.name);
      const userId = this.scope?.user_id ?? 'system';

      const campaign = await this.db.getClient().campaign.create({
        data: {
          tenant_id: this.scope?.tenant_id ?? '',
          branch_id: dto.branch_id,
          brand_id: dto.brand_id,
          vertical_id: dto.vertical_id,
          pipeline_id: dto.pipeline_id,
          name: dto.name,
          status: dto.status || 'draft',
          channel: dto.channel,
          start_date: dto.start_date,
          end_date: dto.end_date,
          target_leads: dto.target_leads,
          utm_source: dto.utm_source,
          utm_medium: dto.utm_medium,
          utm_campaign: utmCampaign,
          attributes: (dto.attributes || {}) as any,
          created_by: userId,
        },
      });

      await this.hooks.emit('campaign:created', {
        campaign_id: campaign.id,
        tenant_id: this.scope?.tenant_id ?? '',
        vertical_id: campaign.vertical_id,
        channel: campaign.channel,
      });

      const stats: CampaignStats = {
        total_leads: 0,
        contacted: 0,
        converted: 0,
        lost: 0,
        conversion_rate: 0,
        avg_days_to_convert: 0,
        by_stage: [],
      };

      return ok({
        id: campaign.id,
        tenant_id: campaign.tenant_id,
        branch_id: campaign.branch_id,
        brand_id: campaign.brand_id,
        vertical_id: campaign.vertical_id,
        pipeline_id: campaign.pipeline_id,
        name: campaign.name,
        status: campaign.status,
        channel: campaign.channel,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        target_leads: campaign.target_leads,
        utm_source: campaign.utm_source,
        utm_medium: campaign.utm_medium,
        utm_campaign: campaign.utm_campaign,
        attributes: (campaign.attributes || {}) as Record<string, any>,
        created_by: campaign.created_by,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
        stats,
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to create campaign',
      });
    }
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Result<CampaignResponse, CampaignError>> {
    try {
      const existing = await this.db.getClient().campaign.findFirst({
        where: { id, status: { not: 'deleted' } },
      });

      if (!existing) {
        return err({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      const updateData: Record<string, any> = {};
      if (dto.branch_id !== undefined) updateData.branch_id = dto.branch_id;
      if (dto.brand_id !== undefined) updateData.brand_id = dto.brand_id;
      if (dto.vertical_id !== undefined) updateData.vertical_id = dto.vertical_id;
      if (dto.pipeline_id !== undefined) updateData.pipeline_id = dto.pipeline_id;
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.channel !== undefined) updateData.channel = dto.channel;
      if (dto.start_date !== undefined) updateData.start_date = dto.start_date;
      if (dto.end_date !== undefined) updateData.end_date = dto.end_date;
      if (dto.target_leads !== undefined) updateData.target_leads = dto.target_leads;
      if (dto.utm_source !== undefined) updateData.utm_source = dto.utm_source;
      if (dto.utm_medium !== undefined) updateData.utm_medium = dto.utm_medium;
      if (dto.utm_campaign !== undefined) updateData.utm_campaign = dto.utm_campaign;
      if (dto.attributes !== undefined) updateData.attributes = dto.attributes;

      const updated = await this.db.getClient().campaign.update({
        where: { id },
        data: updateData,
      });

      const stats = await this.calculateCampaignStats(updated.id, updated.pipeline_id);

      return ok({
        id: updated.id,
        tenant_id: updated.tenant_id,
        branch_id: updated.branch_id,
        brand_id: updated.brand_id,
        vertical_id: updated.vertical_id,
        pipeline_id: updated.pipeline_id,
        name: updated.name,
        status: updated.status,
        channel: updated.channel,
        start_date: updated.start_date,
        end_date: updated.end_date,
        target_leads: updated.target_leads,
        utm_source: updated.utm_source,
        utm_medium: updated.utm_medium,
        utm_campaign: updated.utm_campaign,
        attributes: (updated.attributes || {}) as Record<string, any>,
        created_by: updated.created_by,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        stats,
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to update campaign',
      });
    }
  }

  async updateStatus(id: string, status: string): Promise<Result<CampaignResponse, CampaignError>> {
    try {
      const existing = await this.db.getClient().campaign.findFirst({
        where: { id, status: { not: 'deleted' } },
      });

      if (!existing) {
        return err({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      const updated = await this.db.getClient().campaign.update({
        where: { id },
        data: { status },
      });

      const stats = await this.calculateCampaignStats(updated.id, updated.pipeline_id);

      return ok({
        id: updated.id,
        tenant_id: updated.tenant_id,
        branch_id: updated.branch_id,
        brand_id: updated.brand_id,
        vertical_id: updated.vertical_id,
        pipeline_id: updated.pipeline_id,
        name: updated.name,
        status: updated.status,
        channel: updated.channel,
        start_date: updated.start_date,
        end_date: updated.end_date,
        target_leads: updated.target_leads,
        utm_source: updated.utm_source,
        utm_medium: updated.utm_medium,
        utm_campaign: updated.utm_campaign,
        attributes: (updated.attributes || {}) as Record<string, any>,
        created_by: updated.created_by,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        stats,
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to update campaign status',
      });
    }
  }

  async delete(id: string): Promise<Result<void, CampaignError>> {
    try {
      const existing = await this.db.getClient().campaign.findFirst({
        where: { id, status: { not: 'deleted' } },
      });

      if (!existing) {
        return err({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      const casesCount = await this.db.getClient().case.count({
        where: { campaign_id: id },
      });

      if (casesCount > 0) {
        return err({
          code: 'CAMPAIGN_HAS_LEADS',
          message: `Cannot delete campaign: ${casesCount} cases tagged`,
          count: casesCount,
        });
      }

      await this.db.getClient().campaign.update({
        where: { id },
        data: { status: 'deleted' },
      });

      return ok(undefined);
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to delete campaign',
      });
    }
  }

  async getLeads(
    id: string,
    params: { cursor?: string; limit?: number },
  ): Promise<Result<{ data: any[]; next_cursor?: string }, CampaignError>> {
    try {
      const campaign = await this.db.getClient().campaign.findFirst({
        where: { id, status: { not: 'deleted' } },
      });

      if (!campaign) {
        return err({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      const limit = Math.min(params.limit ?? 50, 100);

      const cases = await this.db.getClient().case.findMany({
        where: { campaign_id: id },
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { created_at: 'desc' },
        include: { party: true },
      });

      const hasMore = cases.length > limit;
      const data = hasMore ? cases.slice(0, limit) : cases;

      return ok({
        data,
        ...(hasMore ? { next_cursor: data[data.length - 1]?.id } : {}),
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to retrieve campaign leads',
      });
    }
  }

  async getAggregateStats(): Promise<Result<CampaignAggregateStatsResponse, CampaignError>> {
    try {
      const campaigns = await this.db.getClient().campaign.findMany({
        where: { status: { not: 'deleted' } },
      });

      const campaignsData = await Promise.all(
        campaigns.map(async (c) => {
          const stats = await this.calculateCampaignStats(c.id, c.pipeline_id);
          return {
            id: c.id,
            name: c.name,
            channel: c.channel,
            status: c.status,
            total_leads: stats.total_leads,
            converted: stats.converted,
            conversion_rate: stats.conversion_rate,
            call_connect_rate: stats.call_connect_rate,
            untouched_leads: stats.untouched_leads,
            idle_agents: stats.idle_agents,
          } as CampaignSummaryStats;
        }),
      );

      let total_leads = 0;
      let total_converted = 0;
      const channelStats = new Map<string, { leads: number; converted: number }>();

      for (const c of campaignsData) {
        total_leads += c.total_leads;
        total_converted += c.converted;

        const existing = channelStats.get(c.channel) || { leads: 0, converted: 0 };
        existing.leads += c.total_leads;
        existing.converted += c.converted;
        channelStats.set(c.channel, existing);
      }

      const overall_conversion_rate =
        total_leads > 0 ? Math.round((total_converted / total_leads) * 10000) / 100 : 0;

      let top_channel: string | null = null;
      let maxRate = -1;

      for (const [channel, stats] of channelStats.entries()) {
        if (stats.leads > 0) {
          const rate = (stats.converted / stats.leads) * 100;
          if (rate > maxRate) {
            maxRate = rate;
            top_channel = channel;
          }
        }
      }

      return ok({
        campaigns: campaignsData,
        top_channel,
        total_leads,
        total_converted,
        overall_conversion_rate,
      });
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to compute aggregate stats',
      });
    }
  }

  private async calculateCampaignStats(campaignId: string, pipelineId: string): Promise<CampaignStats> {
    const total_leads = await this.db.getClient().case.count({
      where: { campaign_id: campaignId },
    });

    const stages = await this.db.getClient().pipelineStage.findMany({
      where: { pipeline_definition_id: pipelineId },
      orderBy: { order: 'asc' },
    });

    if (stages.length === 0 || total_leads === 0) {
      const campaign = await this.db.getClient().campaign.findUnique({
        where: { id: campaignId },
        select: { attributes: true },
      });
      const attributes = (campaign?.attributes || {}) as Record<string, any>;
      const selectedAgents = (attributes.selected_agents || []) as string[];

      let idle_agents = 0;
      if (selectedAgents.length > 0) {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const activeAgentEvents = await this.db.getClient().caseEvent.groupBy({
          by: ['actor_id'],
          where: {
            actor_id: { in: selectedAgents },
            occurred_at: { gte: twoHoursAgo },
          },
        });
        const activeAgentIds = new Set(activeAgentEvents.map((e) => e.actor_id));
        idle_agents = selectedAgents.filter((agentId) => !activeAgentIds.has(agentId)).length;
      }

      return {
        total_leads,
        contacted: 0,
        converted: 0,
        lost: 0,
        conversion_rate: 0,
        avg_days_to_convert: 0,
        by_stage: stages.map((s) => ({
          stage_name: s.name,
          count: 0,
          percentage: 0,
        })),
        call_connect_rate: 0,
        untouched_leads: 0,
        idle_agents,
      };
    }

    const initialStageId = stages[0]!.id;
    const maxOrder = Math.max(...stages.map((s) => s.order));
    const finalStages = stages.filter((s) => s.order === maxOrder);

    const finalPositiveStageIds: string[] = [];
    const finalNegativeStageIds: string[] = [];

    for (const fs of finalStages) {
      const nameLower = fs.name.toLowerCase();
      const isLost =
        nameLower.includes('lost') ||
        nameLower.includes('drop') ||
        nameLower.includes('fail') ||
        nameLower.includes('reject') ||
        nameLower.includes('abandon');
      if (isLost) {
        finalNegativeStageIds.push(fs.id);
      } else {
        finalPositiveStageIds.push(fs.id);
      }
    }

    const contacted = await this.db.getClient().case.count({
      where: {
        campaign_id: campaignId,
        stage: { not: initialStageId },
      },
    });

    const converted =
      finalPositiveStageIds.length > 0
        ? await this.db.getClient().case.count({
            where: {
              campaign_id: campaignId,
              stage: { in: finalPositiveStageIds },
            },
          })
        : 0;

    const lost =
      finalNegativeStageIds.length > 0
        ? await this.db.getClient().case.count({
            where: {
              campaign_id: campaignId,
              stage: { in: finalNegativeStageIds },
            },
          })
        : 0;

    const conversion_rate =
      total_leads > 0 ? Math.round((converted / total_leads) * 10000) / 100 : 0;

    let avg_days_to_convert = 0;
    if (converted > 0 && finalPositiveStageIds.length > 0) {
      const convertedCases = await this.db.getClient().case.findMany({
        where: {
          campaign_id: campaignId,
          stage: { in: finalPositiveStageIds },
        },
        select: {
          id: true,
          created_at: true,
        },
      });

      const caseIds = convertedCases.map((c) => c.id);
      const events = await this.db.getClient().caseEvent.findMany({
        where: {
          case_id: { in: caseIds },
          to_stage: { in: finalPositiveStageIds },
          event_type: 'stage_changed',
        },
        orderBy: { occurred_at: 'asc' },
      });

      const earliestEventPerCase = new Map<string, Date>();
      for (const event of events) {
        if (!earliestEventPerCase.has(event.case_id)) {
          earliestEventPerCase.set(event.case_id, event.occurred_at);
        }
      }

      let totalDays = 0;
      for (const c of convertedCases) {
        const convertDate = earliestEventPerCase.get(c.id) || c.created_at;
        const diffMs = convertDate.getTime() - c.created_at.getTime();
        const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
        totalDays += diffDays;
      }
      avg_days_to_convert = Math.round((totalDays / convertedCases.length) * 100) / 100;
    }

    const caseGroups = await this.db.getClient().case.groupBy({
      by: ['stage'],
      where: { campaign_id: campaignId },
      _count: { id: true },
    });

    const caseCountsByStage = new Map<string, number>();
    for (const cg of caseGroups) {
      caseCountsByStage.set(cg.stage, cg._count.id);
    }

    const by_stage = stages.map((s) => {
      const count = caseCountsByStage.get(s.id) || 0;
      const percentage = total_leads > 0 ? Math.round((count / total_leads) * 10000) / 100 : 0;
      return {
        stage_name: s.name,
        count,
        percentage,
      };
    });

    const untouched_leads = await this.db.getClient().case.count({
      where: {
        campaign_id: campaignId,
        interactions: { none: {} },
      },
    });

    const totalCalls = await this.db.getClient().interaction.count({
      where: {
        case: { campaign_id: campaignId },
        channel: 'call',
      },
    });

    let call_connect_rate = 0;
    if (totalCalls > 0) {
      const connectedCalls = await this.db.getClient().interaction.count({
        where: {
          case: { campaign_id: campaignId },
          channel: 'call',
          NOT: {
            OR: [
              { content: { contains: 'no answer', mode: 'insensitive' } },
              { content: { contains: 'no-answer', mode: 'insensitive' } },
              { content: { contains: 'busy', mode: 'insensitive' } },
              { content: { contains: 'missed', mode: 'insensitive' } },
              { content: { contains: 'failed', mode: 'insensitive' } },
            ],
          },
        },
      });
      call_connect_rate = Math.round((connectedCalls / totalCalls) * 100);
    }

    const campaign = await this.db.getClient().campaign.findUnique({
      where: { id: campaignId },
      select: { attributes: true },
    });
    const attributes = (campaign?.attributes || {}) as Record<string, any>;
    const selectedAgents = (attributes.selected_agents || []) as string[];

    let idle_agents = 0;
    if (selectedAgents.length > 0) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const activeAgentEvents = await this.db.getClient().caseEvent.groupBy({
        by: ['actor_id'],
        where: {
          actor_id: { in: selectedAgents },
          occurred_at: { gte: twoHoursAgo },
        },
      });
      const activeAgentIds = new Set(activeAgentEvents.map((e) => e.actor_id));
      idle_agents = selectedAgents.filter((agentId) => !activeAgentIds.has(agentId)).length;
    }

    return {
      total_leads,
      contacted,
      converted,
      lost,
      conversion_rate,
      avg_days_to_convert,
      by_stage,
      call_connect_rate,
      untouched_leads,
      idle_agents,
    };
  }
}
