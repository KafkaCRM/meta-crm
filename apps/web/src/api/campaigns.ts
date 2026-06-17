import { apiCall } from '@/lib/api';

export interface Campaign {
  id: string;
  tenant_id: string;
  branch_id: string;
  brand_id: string;
  vertical_id: string;
  pipeline_id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  channel: string;
  start_date: string;
  end_date?: string | null;
  target_leads?: number | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  attributes: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
  stats?: CampaignStats;
}

export interface CampaignStats {
  total_leads: number;
  contacted: number;
  converted: number;
  lost: number;
  conversion_rate: number;
  avg_days_to_convert: number;
  by_stage: { stage_name: string; count: number; percentage: number }[];
  call_connect_rate?: number;
  untouched_leads?: number;
  idle_agents?: number;
}

export interface CreateCampaignDto {
  branch_id: string;
  brand_id: string;
  vertical_id: string;
  pipeline_id: string;
  name: string;
  status?: string;
  channel: string;
  start_date: string;
  end_date?: string;
  target_leads?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  attributes?: Record<string, any>;
}

export interface CampaignsStatsSummary {
  campaigns: {
    id: string;
    name: string;
    channel: string;
    status: string;
    total_leads: number;
    converted: number;
    conversion_rate: number;
    call_connect_rate?: number;
    untouched_leads?: number;
    idle_agents?: number;
  }[];
  top_channel: string;
  total_leads: number;
  total_converted: number;
  overall_conversion_rate: number;
}

export const campaignsApi = {
  list: (params: { vertical_id?: string; status?: string; channel?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.vertical_id) qs.set('vertical_id', params.vertical_id);
    if (params.status) qs.set('status', params.status);
    if (params.channel) qs.set('channel', params.channel);
    const query = qs.toString();
    return apiCall<Campaign[]>(`/campaigns${query ? `?${query}` : ''}`);
  },

  get: (id: string) => apiCall<Campaign>(`/campaigns/${id}`),

  create: (data: CreateCampaignDto) =>
    apiCall<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateCampaignDto>) =>
    apiCall<Campaign>(`/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateStatus: (id: string, status: string) =>
    apiCall<Campaign>(`/campaigns/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  remove: (id: string) =>
    apiCall<void>(`/campaigns/${id}`, {
      method: 'DELETE',
    }),

  getLeads: (id: string, params: { cursor?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return apiCall<{ data: any[]; next_cursor?: string }>(`/campaigns/${id}/leads${query ? `?${query}` : ''}`);
  },

  getAggregateStats: () => apiCall<CampaignsStatsSummary>('/campaigns/stats'),
};
