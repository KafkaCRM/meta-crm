import { apiCall } from '@/lib/api';

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  address?: string;
  city?: string;
  manager_id?: string;
  created_at: string;
}

export interface Brand {
  id: string;
  tenant_id: string;
  name: string;
  logo_url?: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  tenant_id: string;
  branch_id: string;
  brand_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface Vertical {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  description?: string | null;
  status: string;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email?: string | null;
  phone_number?: string;
  status: string;
  created_at: string;
  roles?: { role_id: string; role_name: string; assignment_id?: string }[];
}

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  is_system_role: boolean;
  permissions: { resource: string; action: string; conditions?: Record<string, unknown> }[];
  created_at: string;
}

export interface FieldDefinition {
  id: string;
  tenant_id: string;
  entity_type: string;
  name: string;
  label: string;
  field_type: string;
  options?: string[];
  required: boolean;
  order: number;
  visibility_rules?: unknown[];
  related_to?: string;
  created_at: string;
}

export interface LabelOverride {
  label_key: string;
  override_value: string;
}

export interface IntegrationConfig {
  id: string;
  tenant_id?: string;
  provider: string;
  name: string;
  description: string;
  icon: string;
  credential_fields: string[];
  status: 'connected' | 'disconnected' | 'error';
  has_credentials: boolean;
  configured_at?: string;
  config_json: Record<string, unknown>;
}

export interface IntegrationTestResult {
  provider: string;
  status: 'healthy' | 'error';
  message: string;
  last_checked_at: string;
  checked_fields: string[];
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  requires_plan?: string;
  installed: boolean;
}

const pipelineSettingsApi = {
  list: () => apiCall<any[]>('/pipelines'),
  create: (data: { name: string; entity_type?: string }) =>
    apiCall<any>('/pipelines', { method: 'POST', body: JSON.stringify(data) }),
  getDefault: () => apiCall<any>('/pipelines/default'),
  update: (id: string, data: { name: string; stages: any[]; transitions: any[] }) =>
    apiCall<any>(`/pipelines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiCall<{ success: boolean }>(`/pipelines/${id}`, { method: 'DELETE' }),
};

export const settingsApi = {
  branches: {
    list: () => apiCall<Branch[]>('/branches'),
    create: (data: { name: string; address?: string; city?: string }) =>
      apiCall<Branch>('/branches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; address?: string; city?: string }) =>
      apiCall<Branch>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiCall<{ message: string }>(`/branches/${id}`, { method: 'DELETE' }),
  },

  brands: {
    list: () => apiCall<Brand[]>('/brands'),
    create: (data: { name: string; logo_url?: string }) =>
      apiCall<Brand>('/brands', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; logo_url?: string }) =>
      apiCall<Brand>(`/brands/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  assignments: {
    list: () => apiCall<Assignment[]>('/assignments'),
    create: (data: { branch_id: string; brand_id: string; is_primary?: boolean }) =>
      apiCall<Assignment>('/assignments', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiCall<{ message: string }>(`/assignments/${id}`, { method: 'DELETE' }),
  },

  verticals: {
    list: (params?: { brand_id?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.brand_id) qs.set('brand_id', params.brand_id);
      if (params?.status) qs.set('status', params.status);
      const query = qs.toString();
      return apiCall<Vertical[]>(`/verticals${query ? `?${query}` : ''}`);
    },
    create: (data: { brand_id: string; name: string; description?: string; status?: string }) =>
      apiCall<Vertical>('/verticals', { method: 'POST', body: JSON.stringify(data) }),
  },

  users: {
    list: () => apiCall<User[]>('/users'),
    invite: (data: {
      name: string;
      email?: string;
      phone_number: string;
      password?: string;
      role_ids: string[];
      assignment_ids?: string[];
      vertical_ids?: string[];
    }) =>
      apiCall<User & { temporary_password?: string }>('/users/invite', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        phone_number?: string;
        role_ids?: string[];
        assignment_ids?: string[];
        vertical_ids?: string[];
      },
    ) =>
      apiCall<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiCall<{ message: string }>(`/users/${id}`, { method: 'DELETE' }),
  },

  roles: {
    list: () => apiCall<Role[]>('/roles'),
    create: (data: { name: string; slug: string; description?: string }) =>
      apiCall<Role>('/roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; description?: string; permissions?: { resource: string; action: string; conditions?: Record<string, unknown> }[] }) =>
      apiCall<Role>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiCall<{ message: string }>(`/roles/${id}`, { method: 'DELETE' }),
  },

  fieldDefinitions: {
    list: (entityType: string) => apiCall<FieldDefinition[]>(`/field-definitions?entity_type=${entityType}`),
    create: (data: { entity_type: string; name: string; label: string; field_type: string; options?: string[]; required?: boolean; order?: number; visibility_rules?: unknown[] }) =>
      apiCall<FieldDefinition>('/field-definitions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ label: string; field_type: string; options: string[]; required: boolean; order: number; visibility_rules: unknown[] }>) =>
      apiCall<FieldDefinition>(`/field-definitions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiCall<{ message: string }>(`/field-definitions/${id}`, { method: 'DELETE' }),
  },

  pageLayouts: {
    list: (objectType: string) => apiCall<any[]>(`/page-layouts?object_type=${objectType}`),
    getDefault: (objectType: string) => apiCall<any>(`/page-layouts/default?object_type=${objectType}`),
    create: (data: { object_type: string; name: string; layout_json: any }) =>
      apiCall<any>('/page-layouts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      apiCall<any>(`/page-layouts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  labels: {
    list: () => apiCall<Record<string, string>>('/labels'),
    update: (key: string, value: string) =>
      apiCall<LabelOverride>(`/labels/${key}`, { method: 'PUT', body: JSON.stringify({ override_value: value }) }),
  },

  capabilities: {
    list: () => apiCall<{ id: string; name: string; description: string; enabled: boolean }[]>('/capabilities'),
    toggle: (id: string, enabled: boolean) =>
      apiCall<{ id: string; enabled: boolean }>(`/capabilities/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  },

  plugins: {
    list: () => apiCall<Plugin[]>('/plugins'),
    install: (id: string) =>
      apiCall<Plugin>(`/plugins/${id}/install`, { method: 'POST' }),
    uninstall: (id: string) =>
      apiCall<Plugin>(`/plugins/${id}/uninstall`, { method: 'POST' }),
  },

  integrations: {
    list: () => apiCall<IntegrationConfig[]>('/integrations'),
    configure: (provider: string, data: Record<string, string>) =>
      apiCall<IntegrationConfig>(`/integrations/${provider}/configure`, { method: 'POST', body: JSON.stringify(data) }),
    test: (provider: string) =>
      apiCall<IntegrationTestResult>(`/integrations/${provider}/test`, { method: 'POST' }),
    disconnect: (provider: string) =>
      apiCall<{ message: string }>(`/integrations/${provider}`, { method: 'DELETE' }),
  },

  pipelines: pipelineSettingsApi,
  workflows: pipelineSettingsApi,
  customObjects: {
    list: () => apiCall<any[]>('/custom-objects'),
    get: (id: string) => apiCall<any>(`/custom-objects/${id}`),
    create: (data: { api_name: string; singular_label: string; plural_label: string; description?: string }) =>
      apiCall<any>('/custom-objects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { singular_label?: string; plural_label?: string; description?: string }) =>
      apiCall<any>(`/custom-objects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiCall<{ message: string }>(`/custom-objects/${id}`, { method: 'DELETE' }),
  },
  setupAudits: {
    list: () => apiCall<any[]>('/setup-audits'),
  },
  templates: {
    apply: (industry: string) =>
      apiCall<{ success: boolean }>('/templates/apply', { method: 'POST', body: JSON.stringify({ industry }) }),
  },
};
