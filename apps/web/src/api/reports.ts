import { apiCall } from '@/lib/api';

export interface ReportParams {
  date_from?: string;
  date_to?: string;
  assignment_id?: string;
  workflow_id?: string;
}

function buildQuery(params: Record<string, any>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
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
    return apiCall<MyCasesResponse>(`/reports/my-cases${qs}`);
  },

  myFollowUps: (params: ReportParams = {}) => {
    const qs = buildQuery(params);
    return apiCall<MyFollowUpsResponse>(`/reports/my-followups${qs}`);
  },

  campaigns: (params: ReportParams & { vertical_id?: string; channel?: string; cursor?: string; limit?: string } = {}) => {
    const qs = buildQuery(params);
    return apiCall<CampaignReportResponse>(`/reports/campaigns${qs}`);
  },

  campaignComparison: (campaignIds: string[]) => {
    const qs = new URLSearchParams();
    campaignIds.forEach((id) => qs.append('campaign_ids', id));
    const str = qs.toString();
    return apiCall<CampaignComparisonResponse>(`/reports/campaign-comparison${str ? `?${str}` : ''}`);
  },

  channelPerformance: (params: ReportParams & { vertical_id?: string } = {}) => {
    const qs = buildQuery(params);
    return apiCall<ChannelPerformanceResponse>(`/reports/channel-performance${qs}`);
  },
};
