import { apiCall } from '@/lib/api';

export interface Campaign {
  id: string;
  tenant_id: string;
  branch_id: string;
  vertical_id: string;
  pipeline_id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'inactive';
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
  branch?: { id: string; name: string };
  vertical?: { id: string; name: string };
  pipeline?: { id: string; name: string };
  leads_count?: number;
  won_count?: number;
  revenue?: number;
  cpl?: number | null;
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
  active_campaigns?: number;
  total_leads: number;
  leads_mtd?: number;
  won?: number;
  lost?: number;
  revenue?: number;
  active_leads?: number;
  closed?: number;
  campaigns: {
    id: string;
    name: string;
    channel: string;
    status: string;
    total_leads: number;
    converted: number;
    conversion_rate: number;
    spend?: number;
    cpl?: number | null;
    call_connect_rate?: number;
    untouched_leads?: number;
    idle_agents?: number;
  }[];
  top_channel?: string;
  total_converted?: number;
  overall_conversion_rate?: number;
}

export const campaignsApi = {
  list: (params: {
    branch_id?: string;
    branch_ids?: string;
    vertical_id?: string;
    pipeline_id?: string;
    vertical_ids?: string;
    assigned_to?: string;
    name?: string;
    status?: string;
    channel?: string;
    include_inactive?: boolean;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.branch_id) qs.set('branch_id', params.branch_id);
    if (params.branch_ids) qs.set('branch_ids', params.branch_ids);
    if (params.vertical_id) qs.set('vertical_id', params.vertical_id);
    if (params.pipeline_id) qs.set('pipeline_id', params.pipeline_id);
    if (params.vertical_ids) qs.set('vertical_ids', params.vertical_ids);
    if (params.assigned_to) qs.set('assigned_to', params.assigned_to);
    if (params.name) qs.set('name', params.name);
    if (params.status) qs.set('status', params.status);
    if (params.channel) qs.set('channel', params.channel);
    if (params.include_inactive !== undefined) qs.set('include_inactive', String(params.include_inactive));
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

  getAggregateStats: (params?: { branch_id?: string; branch_ids?: string; vertical_id?: string; pipeline_id?: string; vertical_ids?: string }) => {
    const qs = new URLSearchParams();
    if (params?.branch_id) qs.set('branch_id', params.branch_id);
    if (params?.branch_ids) qs.set('branch_ids', params.branch_ids);
    if (params?.vertical_id) qs.set('vertical_id', params.vertical_id);
    if (params?.pipeline_id) qs.set('pipeline_id', params.pipeline_id);
    if (params?.vertical_ids) qs.set('vertical_ids', params.vertical_ids);
    const query = qs.toString();
    return apiCall<CampaignsStatsSummary>(`/campaigns/stats${query ? `?${query}` : ''}`);
  },
};
