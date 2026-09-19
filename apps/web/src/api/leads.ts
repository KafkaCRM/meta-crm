import { apiCall } from '@/lib/api';

export interface LeadListParams {
  cursor?: string;
  limit?: number;
  status?: string;
  source?: string;
  name?: string;
  assigned_to_id?: string;
  pipeline_definition_id?: string;
  stage?: string;
  vertical_ids?: string;
  campaign_id?: string;
}

export interface LeadEventResponse {
  id: string;
  lead_id: string;
  event_type: string;
  from_stage: string | null;
  to_stage: string | null;
  metadata: Record<string, any>;
  actor_id: string;
  occurred_at: string;
}

export interface LeadPipelineInfo {
  id: string;
  name: string;
  stages: { id: string; name: string; order: number }[];
}

export interface LeadResponse {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string;
  source: string;
  status: string;
  stage: string | null;
  pipeline_definition_id: string | null;
  notes: string | null;
  campaign_id: string | null;
  assigned_to_id: string | null;
  party_id: string | null;
  duplicate_risk?: boolean;
  phone_valid?: boolean;
  assigned_to?: {
    id: string;
    name: string;
    email: string;
  } | null;
  party?: {
    id: string;
    name: string;
    email: string;
    phone_raw: string;
    source: string;
  } | null;
  pipelineDefinition?: LeadPipelineInfo | null;
  campaign?: {
    id: string;
    name: string;
    channel?: string;
    status?: string;
  } | null;
  events?: LeadEventResponse[];
  attributes: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CursorPaginatedLeads {
  data: LeadResponse[];
  next_cursor?: string;
}

export interface ConvertLeadInput {
  vertical_id: string;
  assigned_to_id?: string;
}

export interface ConvertLeadResult {
  party_id: string;
}

export const leadsApi = {
  list: (params: LeadListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.status) qs.set('status', params.status);
    if (params.source) qs.set('source', params.source);
    if (params.name) qs.set('name', params.name);
    if (params.assigned_to_id) qs.set('assigned_to_id', params.assigned_to_id);
    if (params.pipeline_definition_id) qs.set('pipeline_definition_id', params.pipeline_definition_id);
    if (params.stage) qs.set('stage', params.stage);
    if (params.vertical_ids) qs.set('vertical_ids', params.vertical_ids);
    if (params.campaign_id) qs.set('campaign_id', params.campaign_id);
    const query = qs.toString();
    return apiCall<CursorPaginatedLeads>(`/leads${query ? `?${query}` : ''}`);
  },

  get: (id: string) => apiCall<LeadResponse>(`/leads/${id}`),

  create: (data: Partial<LeadResponse>) =>
    apiCall<LeadResponse>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<LeadResponse>) =>
    apiCall<LeadResponse>(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  bulkAction: (data: {
    action: 'enroll_campaign' | 'assign_rep' | 'update_status' | 'delete';
    lead_ids: string[];
    campaign_id?: string | null;
    assigned_to_id?: string | null;
    status?: string;
  }) =>
    apiCall<{ success: boolean; count: number }>('/leads/bulk-action', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    apiCall<{ success: boolean }>(`/leads/${id}`, {
      method: 'DELETE',
    }),

  logInteraction: (
    id: string,
    data: {
      type: 'call' | 'whatsapp' | 'email' | 'note';
      outcome?: string;
      notes?: string;
      status?: string;
      next_follow_up?: string;
    }
  ) =>
    apiCall<{ success: boolean; event: any }>(`/leads/${id}/log-interaction`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addToPipeline: (id: string, pipeline_definition_id: string) =>
    apiCall<LeadResponse>(`/leads/${id}/pipeline`, {
      method: 'POST',
      body: JSON.stringify({ pipeline_definition_id }),
    }),

  transitionStage: (id: string, to_stage_id: string) =>
    apiCall<LeadResponse>(`/leads/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ to_stage_id }),
    }),

  byStage: (pipelineDefinitionId: string) =>
    apiCall<{ stages: any[]; leads: Record<string, any[]> }>(
      `/leads/by-stage?pipeline_definition_id=${pipelineDefinitionId}`,
    ),

  getEvents: (id: string, params?: { cursor?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return apiCall<{ data: LeadEventResponse[]; next_cursor?: string }>(
      `/leads/${id}/events${query ? `?${query}` : ''}`,
    );
  },

  convert: (id: string, data: ConvertLeadInput) =>
    apiCall<ConvertLeadResult>(`/leads/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
