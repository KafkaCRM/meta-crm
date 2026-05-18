import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../../tenant/request-scope.interface';

export type ReportErrorCode = 'INVALID_PARAMS';

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
}

@Injectable()
export class TenantReportService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private get scope(): RequestScope {
    return this.cls.get<RequestScope>('scope')!;
  }

  private buildCaseFilter(params: ReportParams): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    const createdAt: Record<string, Date> = {};
    if (params.date_from) createdAt.gte = new Date(params.date_from);
    if (params.date_to) createdAt.lte = new Date(params.date_to);
    if (Object.keys(createdAt).length > 0) filter.created_at = createdAt;
    if (params.assignment_id) filter.branch_brand_assignment_id = params.assignment_id;
    if (params.workflow_id) filter.workflow_definition_id = params.workflow_id;
    return filter;
  }

  private buildInteractionFilter(params: ReportParams): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    const createdAt: Record<string, Date> = {};
    if (params.date_from) createdAt.gte = new Date(params.date_from);
    if (params.date_to) createdAt.lte = new Date(params.date_to);
    if (Object.keys(createdAt).length > 0) filter.created_at = createdAt;
    if (params.assignment_id) filter.branch_brand_assignment_id = params.assignment_id;
    return filter;
  }

  async pipelineFunnel(params: ReportParams): Promise<Result<PipelineFunnelResponse, ReportError>> {
    const filter = this.buildCaseFilter(params);

    const groups = await this.db.getClient().case.groupBy({
      by: ['stage'],
      where: filter,
      _count: { id: true },
      orderBy: { stage: 'asc' },
    });

    const total = groups.reduce((sum, g) => sum + g._count.id, 0);

    const stages: PipelineStage[] = groups.map((g) => ({
      name: g.stage,
      count: g._count.id,
      percentage: total > 0 ? Math.round((g._count.id / total) * 10000) / 100 : 0,
    }));

    return ok({ stages });
  }

  async conversionRate(params: ReportParams): Promise<Result<ConversionRateResponse, ReportError>> {
    const filter = this.buildCaseFilter(params);

    const total = await this.db.getClient().case.count({ where: filter });

    const wfGroups = await this.db.getClient().workflowStage.groupBy({
      by: ['workflow_definition_id'],
      _max: { order: true },
    });

    const lastStageByWorkflow = new Map<string, string[]>();
    for (const group of wfGroups) {
      const lastStages = await this.db.getClient().workflowStage.findMany({
        where: {
          workflow_definition_id: group.workflow_definition_id,
          order: group._max.order!,
        },
        select: { id: true },
      });
      lastStageByWorkflow.set(
        group.workflow_definition_id,
        lastStages.map((s) => s.id),
      );
    }

    const wfFilter = params.workflow_id
      ? filter
      : { ...filter, workflow_definition_id: { in: Array.from(lastStageByWorkflow.keys()) } };

    const cases = await this.db.getClient().case.findMany({
      where: wfFilter,
      select: { id: true, workflow_definition_id: true, stage: true },
    });

    const converted = cases.filter((c) => {
      const lastStageIds = lastStageByWorkflow.get(c.workflow_definition_id);
      return lastStageIds ? lastStageIds.includes(c.stage) : false;
    }).length;

    const rate = total > 0 ? Math.round((converted / total) * 10000) / 100 : 0;

    return ok({ rate, total, converted });
  }

  async stageTime(params: ReportParams): Promise<Result<StageTimeResponse, ReportError>> {
    const filter = this.buildCaseFilter(params);

    const events = await this.db.getClient().caseEvent.findMany({
      where: {
        event_type: 'stage_changed',
        ...(params.date_from || params.date_to
          ? { occurred_at: { ...(params.date_from ? { gte: new Date(params.date_from) } : {}), ...(params.date_to ? { lte: new Date(params.date_to) } : {}) } }
          : {}),
      },
      orderBy: [{ case_id: 'asc' }, { occurred_at: 'asc' }],
      select: {
        case_id: true,
        from_stage: true,
        to_stage: true,
        occurred_at: true,
      },
    });

    const caseEvents = new Map<string, typeof events>();
    for (const event of events) {
      const existing = caseEvents.get(event.case_id) ?? [];
      existing.push(event);
      caseEvents.set(event.case_id, existing);
    }

    const stageDurations: Record<string, number[]> = {};
    for (const evts of caseEvents.values()) {
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
    if (params.assignment_id) filter.branch_brand_assignment_id = params.assignment_id;

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
}
