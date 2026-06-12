import { apiCall } from '@/lib/api';

export interface ConnectionDto {
  id: string;
  tenant_id: string;
  provider: string;
  name: string;
  status: string;
  config_json: Record<string, unknown>;
  has_credentials: boolean;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionTestResult {
  connection_id: string;
  status: 'healthy' | 'error' | 'untested';
  message: string;
  last_tested_at: string;
}

export interface IntegrationManifest {
  id: string;
  provider: string;
  name: string;
  description: string;
  icon: string;
  credential_fields: string[];
}

export interface IntakeRoute {
  id: string;
  connection_id: string;
  mode: 'create_lead' | 'create_contact_opportunity';
  campaign_id: string | null;
  branch_brand_assignment_id: string | null;
  vertical_id: string | null;
  pipeline_id: string | null;
  entry_stage_id: string | null;
  owner_id: string | null;
  assignment_rule: Record<string, unknown>;
  duplicate_strategy: 'skip' | 'update' | 'always_create';
  duplicate_match_fields: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldMapping {
  id: string;
  route_id: string;
  source_field: string;
  target_entity: string;
  target_field: string;
  transform: string | null;
  is_required: boolean;
  created_at: string;
}

export interface InboundEvent {
  id: string;
  connection_id: string;
  provider_event_id: string;
  event_type: string;
  raw_payload: Record<string, unknown>;
  status: 'received' | 'deduplicated' | 'processing' | 'routed' | 'failed' | 'dead_lettered';
  result_entity_type: string | null;
  result_entity_id: string | null;
  error_message: string | null;
  received_at: string;
  processed_at: string | null;
}

export interface DeliveryAttempt {
  id: string;
  inbound_event_id: string;
  attempt_number: number;
  action: string;
  status: string;
  error_detail: Record<string, unknown> | null;
  duration_ms: number | null;
  attempted_at: string;
}

export const integrationsApi = {
  connections: {
    list: () =>
      apiCall<{ data: ConnectionDto[]; manifests: IntegrationManifest[] }>('/connections'),

    get: (id: string) =>
      apiCall<ConnectionDto>(`/connections/${id}`),

    connect: (provider: string, body: { credentials?: Record<string, string>; config_json?: Record<string, unknown> }) =>
      apiCall<ConnectionDto>(`/connections/${provider}/connect`, { method: 'POST', body: JSON.stringify(body) }),

    disconnect: (id: string) =>
      apiCall<{ message: string }>(`/connections/${id}`, { method: 'DELETE' }),

    test: (id: string) =>
      apiCall<ConnectionTestResult>(`/connections/${id}/test`, { method: 'POST' }),
  },

  routes: {
    get: (connectionId: string) =>
      apiCall<IntakeRoute>(`/connections/${connectionId}/route`),

    upsert: (connectionId: string, data: Partial<IntakeRoute>) =>
      apiCall<IntakeRoute>(`/connections/${connectionId}/route`, { method: 'POST', body: JSON.stringify(data) }),
  },

  mappings: {
    list: (connectionId: string) =>
      apiCall<FieldMapping[]>(`/connections/${connectionId}/mappings`),

    upsert: (connectionId: string, mappings: Partial<FieldMapping>[]) =>
      apiCall<FieldMapping[]>(`/connections/${connectionId}/mappings`, { method: 'POST', body: JSON.stringify(mappings) }),
  },

  events: {
    list: (connectionId: string, params?: { cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: InboundEvent[]; next_cursor?: string }>(`/connections/${connectionId}/events${query ? `?${query}` : ''}`);
    },

    retry: (connectionId: string, eventId: string) =>
      apiCall<InboundEvent>(`/connections/${connectionId}/events/${eventId}/retry`, { method: 'POST' }),
  },
};
