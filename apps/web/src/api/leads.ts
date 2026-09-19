import { apiCall } from '@/lib/api';

export interface LeadListParams {
  cursor?: string;
  limit?: number;
  offset?: number;
  status?: string;
  source?: string;
  name?: string;
  assigned_to_id?: string;
  pipeline_definition_id?: string;
  stage?: string;
  vertical_ids?: string;
  vertical_id?: string;
  branch_id?: string;
  branch_ids?: string;
  campaign_id?: string;
  course?: string;
  disposition?: string;
  segment?: 'all' | 'hot' | 'warm' | 'cold' | string;
  sla_breached?: boolean | string;
  is_duplicate?: boolean | string;
  red_flagged?: boolean | string;
  date_from?: string;
  date_to?: string;
  follow_up?: 'all' | 'today' | 'overdue' | string;
  search?: string;
  q?: string;
  sort?: 'newest' | 'oldest' | 'name_asc' | 'name_desc' | string;
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
  stages?: { id: string; name: string; order: number }[];
}

export interface LeadResponse {
  id: string;
  tenant_id?: string;
  tenantId?: string;
  name: string;
  email: string | null;
  phone: string;
  source: string;
  status: string;
  stage: string | null;
  pipeline_definition_id?: string | null;
  pipelineDefinitionId?: string | null;
  vertical_id?: string | null;
  verticalId?: string | null;
  notes: string | null;
  campaign_id?: string | null;
  campaignId?: string | null;
  assigned_to_id?: string | null;
  assignedToId?: string | null;
  party_id?: string | null;
  partyId?: string | null;
  duplicate_risk?: boolean;
  phone_valid?: boolean;
  assigned_to?: {
    id: string;
    name: string;
    email: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  party?: {
    id: string;
    name: string;
    email: string;
    phoneRaw?: string;
    phone_raw?: string;
    source: string;
  } | null;
  vertical?: {
    id: string;
    name: string;
    branchId?: string;
    branch?: {
      id: string;
      name: string;
    } | null;
  } | null;
  pipelineDefinition?: LeadPipelineInfo | null;
  campaign?: {
    id: string;
    name: string;
    channel?: string;
    status?: string;
    branchId?: string;
    branch?: {
      id: string;
      name: string;
    } | null;
  } | null;
  events?: LeadEventResponse[];
  attributes: Record<string, any>;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface CursorPaginatedLeads {
  data: LeadResponse[];
  next_cursor?: string;
  total_count?: number;
}
export type PaginatedLeads = CursorPaginatedLeads;

export interface CreateLeadDto {
  name: string;
  phone: string;
  alternate_phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  dob?: string | null;
  branch_id?: string | null;
  vertical_id?: string | null;
  pipeline_definition_id?: string | null;
  campaign_id?: string | null;
  source?: string;
  course?: string | null;
  training_mode?: string | null;
  course_fee?: string | number | null;
  city?: string | null;
  assigned_to_id?: string | null;
  assign_round_robin?: boolean;
  status?: string;
  stage?: string | null;
  next_follow_up_date?: string | null;
  created_at?: string | null;
  notes?: string | null;
  parents_number?: string | null;
  last_call_disposition?: string | null;
  score?: number | string | null;
  attributes?: Record<string, any>;
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
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.status) qs.set('status', params.status);
    if (params.source) qs.set('source', params.source);
    if (params.name) qs.set('name', params.name);
    if (params.assigned_to_id) qs.set('assigned_to_id', params.assigned_to_id);
    if (params.pipeline_definition_id) qs.set('pipeline_definition_id', params.pipeline_definition_id);
    if (params.stage) qs.set('stage', params.stage);
    if (params.vertical_ids) qs.set('vertical_ids', params.vertical_ids);
    if (params.vertical_id) qs.set('vertical_id', params.vertical_id);
    if (params.branch_id) qs.set('branch_id', params.branch_id);
    if (params.branch_ids) qs.set('branch_ids', params.branch_ids);
    if (params.campaign_id) qs.set('campaign_id', params.campaign_id);
    if (params.course) qs.set('course', params.course);
    if (params.disposition) qs.set('disposition', params.disposition);
    if (params.segment) qs.set('segment', params.segment);
    if (params.sla_breached !== undefined) qs.set('sla_breached', String(params.sla_breached));
    if (params.is_duplicate !== undefined) qs.set('is_duplicate', String(params.is_duplicate));
    if (params.red_flagged !== undefined) qs.set('red_flagged', String(params.red_flagged));
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    if (params.follow_up) qs.set('follow_up', params.follow_up);
    if (params.search) qs.set('search', params.search);
    if (params.q) qs.set('q', params.q);
    if (params.sort) qs.set('sort', params.sort);
    const query = qs.toString();
    return apiCall<CursorPaginatedLeads>(`/leads${query ? `?${query}` : ''}`);
  },

  get: (id: string) => apiCall<LeadResponse>(`/leads/${id}`),

  create: (data: CreateLeadDto | Partial<LeadResponse>) =>
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

  checkDuplicate: (params: { phone?: string; email?: string }) => {
    const qs = new URLSearchParams();
    if (params.phone) qs.set('phone', params.phone);
    if (params.email) qs.set('email', params.email);
    return apiCall<{ is_duplicate: boolean; existing_lead: any | null }>(
      `/leads/check-duplicate?${qs.toString()}`
    );
  },

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
