import type {
  CreateParty,
  UpdateParty,
  PartyResponse,
  CheckDuplicateResponse,
} from '@meta-crm/types';
import { apiCall } from '@/lib/api';

export interface PartyListParams {
  cursor?: string;
  limit?: number;
  phone?: string;
  name?: string;
  source?: string;
  type?: string;
  vertical_ids?: string;
}

export interface CursorPaginatedParties {
  data: PartyResponse[];
  next_cursor?: string;
}

export interface MergeInput {
  canonical_id: string;
  duplicate_id: string;
  field_overrides?: Record<string, any>;
}

export interface MergeResult {
  party: PartyResponse;
}

export const partiesApi = {
  list: (params: PartyListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.phone) qs.set('phone', params.phone);
    if (params.name) qs.set('name', params.name);
    if (params.source) qs.set('source', params.source);
    if (params.type) qs.set('type', params.type);
    if (params.vertical_ids) qs.set('vertical_ids', params.vertical_ids);
    const query = qs.toString();
    return apiCall<CursorPaginatedParties>(`/parties${query ? `?${query}` : ''}`);
  },

  get: (id: string) => apiCall<PartyResponse>(`/parties/${id}`),

  create: (data: CreateParty) =>
    apiCall<PartyResponse>('/parties', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateParty) =>
    apiCall<PartyResponse>(`/parties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    apiCall<{ message: string }>(`/parties/${id}`, {
      method: 'DELETE',
    }),

  checkDuplicate: (phone: string) =>
    apiCall<CheckDuplicateResponse>(
      `/parties/check-duplicate?phone=${encodeURIComponent(phone)}`,
    ),

  merge: (data: MergeInput) =>
    apiCall<MergeResult>('/parties/merge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listCandidates: (phone?: string, name?: string) => {
    const qs = new URLSearchParams();
    if (phone) qs.set('phone', phone);
    if (name) qs.set('name', name);
    qs.set('limit', '20');
    const query = qs.toString();
    return apiCall<CursorPaginatedParties>(`/parties${query ? `?${query}` : ''}`);
  },
};
