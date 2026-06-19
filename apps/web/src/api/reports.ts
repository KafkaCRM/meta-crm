import { apiCall } from '@/lib/api';

export interface ReportParams {
  date_from?: string;
  date_to?: string;
  assignment_id?: string;
  workflow_id?: string;
}

function buildQuery(params: ReportParams): string {
  const qs = new URLSearchParams();
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.assignment_id) qs.set('assignment_id', params.assignment_id);
  if (params.workflow_id) qs.set('workflow_id', params.workflow_id);
  const query = qs.toString();
  return query ? `&${query}` : '';
}

export interface PipelineFunnelResponse {
  stages: { name: string; count: number; percentage: number }[];
}

export interface ConversionRateResponse {
  rate: number;
  total: number;
  converted: number;
  trend: { date: string; rate: number }[];
}

export interface StageTimeResponse {
  stages: { name: string; avg_hours: number; min_hours: number; max_hours: number; sla_hours: number }[];
}

export interface InteractionVolumeResponse {
  channels: { channel: string; count: number; inbound: number; outbound: number }[];
  daily: { date: string; inbound: number; outbound: number }[];
}

export interface PartySourcesResponse {
  sources: { source: string; count: number }[];
  total: number;
}

export interface CampaignReportEntry {
  id: string;
  name: string;
  channel: string;
  status: string;
  total_leads: number;
  contacted: number;
  converted: number;
  conversion_rate: number;
  call_connect_rate: number;
  untouched_leads: number;
}

export interface CampaignReportResponse {
  campaigns: CampaignReportEntry[];
  next_cursor?: string;
}

export interface CampaignComparisonResponse {
  campaigns: {
    id: string;
    name: string;
    channel: string;
    total_leads: number;
    converted: number;
    conversion_rate: number;
    call_connect_rate: number;
    untouched_leads: number;
  }[];
}

export interface ChannelPerformanceResponse {
  channels: {
    channel: string;
    total_leads: number;
    converted: number;
    conversion_rate: number;
    total_interactions: number;
  }[];
}

export interface MyCasesResponse {
  cases: {
    id: string;
    title: string;
    party_name: string;
    stage: string;
    last_updated: string;
  }[];
}

export interface MyFollowUpsResponse {
  followUps: {
    id: string;
    party_name: string;
    type: string;
    time: string;
    channel: string;
  }[];
}

export const reportsApi = {
  pipelineFunnel: (params: ReportParams = {}) => {
    const qs = buildQuery(params);
    return apiCall<PipelineFunnelResponse>(`/reports/pipeline-funnel${qs}`);
  },

  conversionRate: (params: ReportParams = {}) => {
    const qs = buildQuery(params);
    return apiCall<ConversionRateResponse>(`/reports/conversion-rate${qs}`);
  },

  stageTime: (params: ReportParams = {}) => {
    const qs = buildQuery(params);
    return apiCall<StageTimeResponse>(`/reports/stage-time${qs}`);
  },

  interactionVolume: (params: ReportParams = {}) => {
    const qs = buildQuery(params);
    return apiCall<InteractionVolumeResponse>(`/reports/interaction-volume${qs}`);
  },

  partySources: (params: ReportParams = {}) => {
    const qs = buildQuery(params);
    return apiCall<PartySourcesResponse>(`/reports/party-sources${qs}`);
  },

  myCases: (params: ReportParams = {}) => {
    const qs = buildQuery(params);
    return apiCall<MyCasesResponse>(`/cases?assigned_to_me=true&limit=5${qs}`);
  },

  myFollowUps: (params: ReportParams = {}) => {
    const qs = buildQuery(params);
    return apiCall<MyFollowUpsResponse>(`/interactions?follow_up_today=true&limit=5${qs}`);
  },

  campaigns: (params: ReportParams & { vertical_id?: string; channel?: string; cursor?: string; limit?: string } = {}) => {
    const { vertical_id, channel, cursor, limit, ...rest } = params as any;
    let qs = buildQuery(rest);
    if (vertical_id) qs += `&vertical_id=${encodeURIComponent(vertical_id)}`;
    if (channel) qs += `&channel=${encodeURIComponent(channel)}`;
    if (cursor) qs += `&cursor=${encodeURIComponent(cursor)}`;
    if (limit) qs += `&limit=${encodeURIComponent(limit)}`;
    return apiCall<CampaignReportResponse>(`/reports/campaigns${qs}`);
  },

  campaignComparison: (campaignIds: string[]) => {
    const qs = campaignIds.map((id) => `campaign_ids=${encodeURIComponent(id)}`).join('&');
    return apiCall<CampaignComparisonResponse>(`/reports/campaign-comparison?${qs}`);
  },

  channelPerformance: (params: ReportParams & { vertical_id?: string } = {}) => {
    const { vertical_id, ...rest } = params as any;
    let qs = buildQuery(rest);
    if (vertical_id) qs += `&vertical_id=${encodeURIComponent(vertical_id)}`;
    return apiCall<ChannelPerformanceResponse>(`/reports/channel-performance${qs}`);
  },
};
