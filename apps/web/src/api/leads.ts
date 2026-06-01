import { apiCall } from '@/lib/api';

export interface LeadListParams {
  cursor?: string;
  limit?: number;
  status?: string;
  source?: string;
  name?: string;
}

export interface LeadResponse {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string;
  source: string;
  status: string;
  notes: string | null;
  converted_party_id: string | null;
  converted_case_id: string | null;
  campaign_id?: string | null;
  attributes: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CursorPaginatedLeads {
  data: LeadResponse[];
  next_cursor?: string;
}

export interface ConvertLeadInput {
  branch_brand_assignment_id: string;
  create_case?: boolean;
  case_title?: string;
  case_type?: string;
  case_stage?: string;
  workflow_definition_id?: string;
  assigned_to_id?: string;
  vertical_id?: string;
  campaign_id?: string;
}

export interface ConvertLeadResult {
  party_id: string;
  case_id?: string;
}

export const leadsApi = {
  list: (params: LeadListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.status) qs.set('status', params.status);
    if (params.source) qs.set('source', params.source);
    if (params.name) qs.set('name', params.name);
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

  remove: (id: string) =>
    apiCall<{ success: boolean }>(`/leads/${id}`, {
      method: 'DELETE',
    }),

  convert: (id: string, data: ConvertLeadInput) =>
    apiCall<ConvertLeadResult>(`/leads/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
