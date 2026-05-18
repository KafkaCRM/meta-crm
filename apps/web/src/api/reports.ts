import { apiCall } from '@/lib/api';

export interface ReportParams {
  date_from?: string;
  date_to?: string;
  assignment_id?: string;
  workflow_id?: string;
}

export interface PipelineFunnelResponse {
  stages: { name: string; count: number; percentage: number }[];
}

export interface ConversionRateResponse {
  rate: number;
  total: number;
  converted: number;
}

export interface StageTimeResponse {
  stages: { name: string; avg_hours: number; min_hours: number; max_hours: number }[];
}

export interface InteractionVolumeResponse {
  channels: { channel: string; count: number; inbound: number; outbound: number }[];
}

export interface PartySourcesResponse {
  sources: { source: string; count: number }[];
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
};

function buildQuery(params: ReportParams): string {
  const qs = new URLSearchParams();
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.assignment_id) qs.set('assignment_id', params.assignment_id);
  if (params.workflow_id) qs.set('workflow_id', params.workflow_id);
  const query = qs.toString();
  return query ? `?${query}` : '';
}
