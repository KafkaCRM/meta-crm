import type {
  InteractionDto,
  ThreadDto,
  CreateInteractionDto,
  TimelineItem,
} from '@meta-crm/types';
import { apiCall } from '@/lib/api';

export interface InteractionListParams {
  case_id?: string;
  party_id?: string;
  cursor?: string;
  limit?: number;
}

export interface InteractionListResponse {
  items: TimelineItem[];
  next_cursor: string | null;
}

export const interactionsApi = {
  list: (params: InteractionListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.case_id) qs.set('case_id', params.case_id);
    if (params.party_id) qs.set('party_id', params.party_id);
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return apiCall<InteractionListResponse>(
      `/interactions${query ? `?${query}` : ''}`,
    );
  },

  create: (data: CreateInteractionDto) =>
    apiCall<InteractionDto>('/interactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  pin: (id: string) =>
    apiCall<InteractionDto>(`/interactions/${id}/pin`, {
      method: 'POST',
    }),

  unpin: (id: string) =>
    apiCall<InteractionDto>(`/interactions/${id}/pin`, {
      method: 'DELETE',
    }),
};
