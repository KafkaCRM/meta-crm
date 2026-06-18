import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../../tenant/request-scope.interface';
import { CampaignService } from '../../campaign/campaign.service';

export type ReportErrorCode = 'INVALID_PARAMS' | 'INTERNAL_ERROR';

export interface ReportError {
  code: ReportErrorCode;
  message: string;
}

export interface PipelineStage {
  name: string;
  count: number;
  percentage: number;
}

export interface PipelineFunnelResponse {
  stages: PipelineStage[];
}

export interface ConversionRateResponse {
  rate: number;
  total: number;
  converted: number;
}

export interface StageTimeEntry {
  name: string;
  avg_hours: number;
  min_hours: number;
  max_hours: number;
}

export interface StageTimeResponse {
  stages: StageTimeEntry[];
}

export interface ChannelVolume {
  channel: string;
  count: number;
  inbound: number;
  outbound: number;
}

export interface InteractionVolumeResponse {
  channels: ChannelVolume[];
}

export interface SourceEntry {
  source: string;
  count: number;
}

export interface PartySourcesResponse {
  sources: SourceEntry[];
}

export interface ExportResponse {
  job_id: string;
}

export interface ReportParams {
  date_from?: string;
  date_to?: string;
  assignment_id?: string;
  workflow_id?: string;
  campaign_id?: string;
}

@Injectable()
export class TenantReportService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly campaignService: CampaignService,
  ) {}

  private get scope(): RequestScope {
    return this.cls.get<RequestScope>('scope')!;
  }

  private buildLeadFilter(params: ReportParams): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    const createdAt: Record<string, Date> = {};
    if (params.date_from) createdAt.gte = new Date(params.date_from);
    if (params.date_to) createdAt.lte = new Date(params.date_to);
    if (Object.keys(createdAt).length > 0) filter.created_at = createdAt;
    if (params.workflow_id) filter.pipeline_definition_id = params.workflow_id;
    if (params.campaign_id) filter.campaign_id = params.campaign_id;
    return filter;
  }

  private buildInteractionFilter(params: ReportParams): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    const createdAt: Record<string, Date> = {};
    if (params.date_from) createdAt.gte = new Date(params.date_from);
    if (params.date_to) createdAt.lte = new Date(params.date_to);
    if (Object.keys(createdAt).length > 0) filter.created_at = createdAt;
    if (params.assignment_id) filter.vertical_id = params.assignment_id;
    return filter;
  }

  async pipelineFunnel(params: ReportParams): Promise<Result<PipelineFunnelResponse, ReportError>> {
    const filter = this.buildLeadFilter(params);

    const groups = await this.db.getClient().lead.groupBy({
      by: ['stage'],
      where: filter,
      _count: { id: true },
      orderBy: { stage: 'asc' },
    });

    const total = groups.reduce((sum, g) => sum + g._count.id, 0);

    const stages: PipelineStage[] = groups.map((g) => ({
      name: g.stage ?? '',
      count: g._count.id,
      percentage: total > 0 ? Math.round((g._count.id / total) * 10000) / 100 : 0,
    }));

    return ok({ stages });
  }

  async conversionRate(params: ReportParams): Promise<Result<ConversionRateResponse, ReportError>> {
    const filter = this.buildLeadFilter(params);

    const total = await this.db.getClient().lead.count({ where: filter });

    const wfGroups = await this.db.getClient().pipelineStage.groupBy({
      by: ['pipeline_definition_id'],
      _max: { order: true },
    });

    const lastStageByWorkflow = new Map<string, string[]>();
    for (const group of wfGroups) {
      const lastStages = await this.db.getClient().pipelineStage.findMany({
        where: {
          pipeline_definition_id: group.pipeline_definition_id,
          order: group._max.order!,
        },
        select: { id: true },
      });
      lastStageByWorkflow.set(
        group.pipeline_definition_id,
        lastStages.map((s) => s.id),
      );
    }

    const wfFilter = params.workflow_id
      ? filter
      : { ...filter, pipeline_definition_id: { in: Array.from(lastStageByWorkflow.keys()) } };

    const leads = await this.db.getClient().lead.findMany({
      where: wfFilter,
      select: { id: true, pipeline_definition_id: true, stage: true },
    });

    const converted = leads.filter((l) => {
      if (!l.pipeline_definition_id) return false;
      const lastStageIds = lastStageByWorkflow.get(l.pipeline_definition_id);
      return lastStageIds && l.stage ? lastStageIds.includes(l.stage) : false;
    }).length;

    const rate = total > 0 ? Math.round((converted / total) * 10000) / 100 : 0;

    return ok({ rate, total, converted });
  }

  async stageTime(params: ReportParams): Promise<Result<StageTimeResponse, ReportError>> {
    const filter = this.buildLeadFilter(params);

    const events = await this.db.getClient().leadEvent.findMany({
      where: {
        event_type: 'stage_changed',
        ...(params.date_from || params.date_to
          ? { occurred_at: { ...(params.date_from ? { gte: new Date(params.date_from) } : {}), ...(params.date_to ? { lte: new Date(params.date_to) } : {}) } }
          : {}),
      },
      orderBy: [{ lead_id: 'asc' }, { occurred_at: 'asc' }],
      select: {
        lead_id: true,
        from_stage: true,
        to_stage: true,
        occurred_at: true,
      },
    });

    const leadEvents = new Map<string, typeof events>();
    for (const event of events) {
      const existing = leadEvents.get(event.lead_id) ?? [];
      existing.push(event);
      leadEvents.set(event.lead_id, existing);
    }

    const stageDurations: Record<string, number[]> = {};
    for (const evts of leadEvents.values()) {
      for (let i = 0; i < evts.length - 1; i++) {
        const current = evts[i];
        const next = evts[i + 1];
        if (!current || !next) continue;
        const stageName = current.to_stage ?? current.from_stage ?? 'unknown';
        const durationMs = next.occurred_at.getTime() - current.occurred_at.getTime();
        const durationHours = Math.round((durationMs / 3600000) * 100) / 100;
        const existing = stageDurations[stageName];
        if (existing) {
          existing.push(durationHours);
        } else {
          stageDurations[stageName] = [durationHours];
        }
      }
    }

    const stages: StageTimeEntry[] = Object.entries(stageDurations).map(([name, durations]) => {
      const sum = durations.reduce((a, b) => a + b, 0);
      return {
        name,
        avg_hours: Math.round((sum / durations.length) * 100) / 100,
        min_hours: Math.round(Math.min(...durations) * 100) / 100,
        max_hours: Math.round(Math.max(...durations) * 100) / 100,
      };
    });

    return ok({ stages });
  }

  async interactionVolume(params: ReportParams): Promise<Result<InteractionVolumeResponse, ReportError>> {
    const filter = this.buildInteractionFilter(params);

    const groups = await this.db.getClient().interaction.groupBy({
      by: ['channel', 'direction'],
      where: filter,
      _count: { id: true },
    });

    const channelMap = new Map<string, ChannelVolume>();
    for (const g of groups) {
      if (!channelMap.has(g.channel)) {
        channelMap.set(g.channel, { channel: g.channel, count: 0, inbound: 0, outbound: 0 });
      }
      const entry = channelMap.get(g.channel)!;
      entry.count += g._count.id;
      if (g.direction === 'inbound') entry.inbound += g._count.id;
      if (g.direction === 'outbound') entry.outbound += g._count.id;
    }

    return ok({ channels: Array.from(channelMap.values()) });
  }

  async partySources(params: ReportParams): Promise<Result<PartySourcesResponse, ReportError>> {
    const filter: Record<string, unknown> = {};
    if (params.date_from || params.date_to) {
      const createdAt: Record<string, Date> = {};
      if (params.date_from) createdAt.gte = new Date(params.date_from);
      if (params.date_to) createdAt.lte = new Date(params.date_to);
      filter.created_at = createdAt;
    }
    if (params.assignment_id) filter.vertical_id = params.assignment_id;

    const groups = await this.db.getClient().party.groupBy({
      by: ['source'],
      where: filter,
      _count: { id: true },
      orderBy: { source: 'asc' },
    });

    const sources: SourceEntry[] = groups.map((g) => ({
      source: g.source,
      count: g._count.id,
    }));

    return ok({ sources });
  }

  async requestExport(params: ReportParams): Promise<Result<ExportResponse, ReportError>> {
    const jobId = crypto.randomUUID();
    return ok({ job_id: jobId });
  }

  async campaigns(params: {
    vertical_id?: string;
    channel?: string;
    date_from?: string;
    date_to?: string;
    cursor?: string;
    limit?: number;
  }): Promise<Result<any[], ReportError>> {
    try {
      const limit = params.limit ? Math.min(params.limit, 100) : 50;
      const campaigns = await this.db.getClient().campaign.findMany({
        where: {
          status: { not: 'deleted' },
          ...(params.vertical_id ? { vertical_id: params.vertical_id } : {}),
          ...(params.channel ? { channel: params.channel } : {}),
        },
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
      });

      const hasMore = campaigns.length > limit;
      const campaignsToProcess = hasMore ? campaigns.slice(0, limit) : campaigns;
      const campaignIds = campaignsToProcess.map((c) => c.id);

      const leadWhere: Record<string, any> = {
        campaign_id: { in: campaignIds },
      };
      if (params.date_from || params.date_to) {
        const createdAt: Record<string, Date> = {};
        if (params.date_from) createdAt.gte = new Date(params.date_from);
        if (params.date_to) createdAt.lte = new Date(params.date_to);
        leadWhere.created_at = createdAt;
      }

      const leadGroups = await this.db.getClient().lead.groupBy({
        by: ['campaign_id', 'stage'],
        where: leadWhere,
        _count: { id: true },
      });

      const pipelineIds = Array.from(new Set(campaignsToProcess.map((c) => c.pipeline_id)));
      const stages = await this.db.getClient().pipelineStage.findMany({
        where: { pipeline_definition_id: { in: pipelineIds } },
        orderBy: { order: 'asc' },
      });

      const pipelineStagesMap = new Map<string, typeof stages>();
      for (const stage of stages) {
        const existing = pipelineStagesMap.get(stage.pipeline_definition_id) ?? [];
        existing.push(stage);
        pipelineStagesMap.set(stage.pipeline_definition_id, existing);
      }

      const pipelineFinalPositiveStageIdsMap = new Map<string, Set<string>>();
      for (const [pipelineId, pipelineStages] of pipelineStagesMap.entries()) {
        if (pipelineStages.length === 0) continue;
        const maxOrder = Math.max(...pipelineStages.map((s) => s.order));
        const finalStages = pipelineStages.filter((s) => s.order === maxOrder);
        const positiveIds = new Set<string>();
        for (const fs of finalStages) {
          const nameLower = fs.name.toLowerCase();
          const isLost =
            nameLower.includes('lost') ||
            nameLower.includes('drop') ||
            nameLower.includes('fail') ||
            nameLower.includes('reject') ||
            nameLower.includes('abandon');
          if (!isLost) {
            positiveIds.add(fs.id);
          }
        }
        pipelineFinalPositiveStageIdsMap.set(pipelineId, positiveIds);
      }

      const campaignStatsMap = new Map<string, { total_leads: number; converted: number }>();
      for (const cId of campaignIds) {
        campaignStatsMap.set(cId, { total_leads: 0, converted: 0 });
      }

      for (const group of leadGroups) {
        const cId = group.campaign_id;
        if (!cId) continue;
        const count = group._count.id;
        const campaign = campaignsToProcess.find((c) => c.id === cId);
        if (!campaign) continue;

        const stats = campaignStatsMap.get(cId) || { total_leads: 0, converted: 0 };
        stats.total_leads += count;

        const finalPositiveIds = pipelineFinalPositiveStageIdsMap.get(campaign.pipeline_id);
        if (finalPositiveIds && group.stage && finalPositiveIds.has(group.stage)) {
          stats.converted += count;
        }
        campaignStatsMap.set(cId, stats);
      }

      const result = campaignsToProcess.map((c) => {
        const stats = campaignStatsMap.get(c.id) || { total_leads: 0, converted: 0 };
        const conversion_rate =
          stats.total_leads > 0 ? Math.round((stats.converted / stats.total_leads) * 10000) / 100 : 0;
        return {
          id: c.id,
          name: c.name,
          channel: c.channel,
          total_leads: stats.total_leads,
          converted: stats.converted,
          conversion_rate,
        };
      });

      return ok(result);
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to compute campaign reports',
      });
    }
  }

  async campaignComparison(campaignIds: string[]): Promise<Result<any[], ReportError>> {
    try {
      if (!campaignIds || campaignIds.length === 0) {
        return err({ code: 'INVALID_PARAMS', message: 'campaign_ids query param is required' });
      }
      if (campaignIds.length > 5) {
        return err({ code: 'INVALID_PARAMS', message: 'Cannot compare more than 5 campaigns' });
      }

      const results: any[] = [];
      for (const id of campaignIds) {
        const campRes = await this.campaignService.findOne(id);
        if (campRes.isOk()) {
          results.push(campRes.value);
        } else {
          return err({ code: 'INVALID_PARAMS', message: `Campaign not found or inaccessible: ${id}` });
        }
      }
      return ok(results);
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to compare campaigns',
      });
    }
  }

  async channelPerformance(params: {
    vertical_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<Result<any[], ReportError>> {
    try {
      const campaigns = await this.db.getClient().campaign.findMany({
        where: {
          status: { not: 'deleted' },
          ...(params.vertical_id ? { vertical_id: params.vertical_id } : {}),
        },
      });

      const campaignIds = campaigns.map((c) => c.id);
      const campaignMap = new Map<string, typeof campaigns[0]>();
      for (const c of campaigns) {
        campaignMap.set(c.id, c);
      }

      const leadWhere: Record<string, any> = {
        campaign_id: { in: campaignIds },
      };
      if (params.date_from || params.date_to) {
        const createdAt: Record<string, Date> = {};
        if (params.date_from) createdAt.gte = new Date(params.date_from);
        if (params.date_to) createdAt.lte = new Date(params.date_to);
        leadWhere.created_at = createdAt;
      }

      const leadGroups = await this.db.getClient().lead.groupBy({
        by: ['campaign_id', 'stage'],
        where: leadWhere,
        _count: { id: true },
      });

      const pipelineIds = Array.from(new Set(campaigns.map((c) => c.pipeline_id)));
      const stages = await this.db.getClient().pipelineStage.findMany({
        where: { pipeline_definition_id: { in: pipelineIds } },
        orderBy: { order: 'asc' },
      });

      const pipelineStagesMap = new Map<string, typeof stages>();
      for (const stage of stages) {
        const existing = pipelineStagesMap.get(stage.pipeline_definition_id) ?? [];
        existing.push(stage);
        pipelineStagesMap.set(stage.pipeline_definition_id, existing);
      }

      const pipelineFinalPositiveStageIdsMap = new Map<string, Set<string>>();
      for (const [pipelineId, pipelineStages] of pipelineStagesMap.entries()) {
        if (pipelineStages.length === 0) continue;
        const maxOrder = Math.max(...pipelineStages.map((s) => s.order));
        const finalStages = pipelineStages.filter((s) => s.order === maxOrder);
        const positiveIds = new Set<string>();
        for (const fs of finalStages) {
          const nameLower = fs.name.toLowerCase();
          const isLost =
            nameLower.includes('lost') ||
            nameLower.includes('drop') ||
            nameLower.includes('fail') ||
            nameLower.includes('reject') ||
            nameLower.includes('abandon');
          if (!isLost) {
            positiveIds.add(fs.id);
          }
        }
        pipelineFinalPositiveStageIdsMap.set(pipelineId, positiveIds);
      }

      const channelStatsMap = new Map<string, { total_leads: number; converted: number }>();

      for (const group of leadGroups) {
        const cId = group.campaign_id;
        if (!cId) continue;
        const campaign = campaignMap.get(cId);
        if (!campaign) continue;

        const channel = campaign.channel;
        const count = group._count.id;

        const stats = channelStatsMap.get(channel) || { total_leads: 0, converted: 0 };
        stats.total_leads += count;

        const finalPositiveIds = pipelineFinalPositiveStageIdsMap.get(campaign.pipeline_id);
        if (finalPositiveIds && group.stage && finalPositiveIds.has(group.stage)) {
          stats.converted += count;
        }
        channelStatsMap.set(channel, stats);
      }

      const activeChannels = Array.from(new Set(campaigns.map((c) => c.channel)));
      for (const channel of activeChannels) {
        if (!channelStatsMap.has(channel)) {
          channelStatsMap.set(channel, { total_leads: 0, converted: 0 });
        }
      }

      const result = Array.from(channelStatsMap.entries()).map(([channel, stats]) => {
        const conversion_rate =
          stats.total_leads > 0 ? Math.round((stats.converted / stats.total_leads) * 10000) / 100 : 0;
        return {
          channel,
          total_leads: stats.total_leads,
          converted: stats.converted,
          conversion_rate,
        };
      });

      result.sort((a, b) => b.conversion_rate - a.conversion_rate);

      return ok(result);
    } catch (e: any) {
      return err({
        code: 'INTERNAL_ERROR',
        message: e?.message ?? 'Failed to compute channel performance',
      });
    }
  }
}
