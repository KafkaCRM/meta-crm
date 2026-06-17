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
  oauth_supported?: boolean;
  url_generator?: boolean;
}

export interface IntakeRoute {
  id: string;
  connection_id: string;
  priority: number;
  conditions: Record<string, string>;
  mode: 'create_lead' | 'create_contact_opportunity';
  campaign_id: string | null;
  owner_id: string | null;
  assignment_rule: Record<string, unknown>;
  duplicate_strategy: 'skip' | 'update' | 'always_create';
  duplicate_match_fields: string[];
  fieldMappings?: FieldMapping[];
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

    getOAuthUrl: (provider: string, redirectTo?: string) =>
      apiCall<{ url: string }>(`/connections/oauth/${provider}/url${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`),
  },

  routes: {
    list: (connectionId: string) =>
      apiCall<IntakeRoute[]>(`/connections/${connectionId}/routes`),

    replace: (connectionId: string, data: Array<{
      priority: number;
      conditions?: Record<string, string> | null;
      mode: string;
      campaign_id?: string | null;
      owner_id?: string | null;
      assignment_rule?: Record<string, unknown>;
      duplicate_strategy?: string;
      duplicate_match_fields?: string[];
      fieldMappings?: Array<{
        source_field: string;
        target_entity: string;
        target_field: string;
        transform?: string | null;
        is_required?: boolean;
      }>;
    }>) =>
      apiCall<IntakeRoute[]>(`/connections/${connectionId}/routes`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  mappings: {
    list: (routeId: string) =>
      apiCall<FieldMapping[]>(`/connections/routes/${routeId}/mappings`),

    replace: (routeId: string, mappings: Array<{
      source_field: string;
      target_entity: string;
      target_field: string;
      transform?: string | null;
      is_required?: boolean;
    }>) =>
      apiCall<FieldMapping[]>(`/connections/routes/${routeId}/mappings`, { method: 'PUT', body: JSON.stringify(mappings) }),
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
