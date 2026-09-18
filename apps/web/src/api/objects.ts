import { apiCall } from '@/lib/api';

export interface CustomFieldMeta {
  id: string;
  name: string;
  label: string;
  field_type: string;
  options?: string[] | null;
  required: boolean;
  order: number;
}

export interface CustomObjectMeta {
  id: string;
  key: string;
  label: string;
  plural_label: string;
  domain: string;
  description: string | null;
  icon: string;
  primary_field: string;
  record_count?: number;
  fields?: CustomFieldMeta[];
  created_at?: string;
}

export interface FlexRecordItem {
  id: string;
  name: string;
  status: string;
  data: Record<string, any>;
  assigned_to?: { id: string; name: string; email: string } | null;
  branch?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface FlexRecordListResponse {
  data: FlexRecordItem[];
  next_cursor?: string;
}

export const objectsApi = {
  list: () => apiCall<CustomObjectMeta[]>('/objects'),
  get: (key: string) => apiCall<CustomObjectMeta>(`/objects/${key}`),
  create: (data: {
    key: string;
    label: string;
    plural_label: string;
    domain?: string;
    description?: string;
    icon?: string;
    fields?: Array<{ name: string; label: string; field_type: string; options?: string[]; required?: boolean }>;
  }) =>
    apiCall<CustomObjectMeta>('/objects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (key: string) =>
    apiCall<{ message: string }>(`/objects/${key}`, {
      method: 'DELETE',
    }),
  listRecords: (key: string, params?: { q?: string; status?: string; cursor?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    return apiCall<FlexRecordListResponse>(`/objects/${key}/records?${qs.toString()}`);
  },
  createRecord: (key: string, data: Record<string, any>) =>
    apiCall<FlexRecordItem>(`/objects/${key}/records`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRecord: (key: string, id: string, data: Record<string, any>) =>
    apiCall<FlexRecordItem>(`/objects/${key}/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteRecord: (key: string, id: string) =>
    apiCall<{ message: string }>(`/objects/${key}/records/${id}`, {
      method: 'DELETE',
    }),
  installPackage: (pkg: {
    domain: string;
    objects: Array<{
      key: string;
      label: string;
      plural_label: string;
      icon: string;
      fields: Array<{ name: string; label: string; field_type: string; options?: string[]; required?: boolean }>;
    }>;
  }) =>
    apiCall<{ success: boolean; domain: string; installed_objects: Array<{ key: string; label: string }> }>(
      '/objects/package/install',
      {
        method: 'POST',
        body: JSON.stringify(pkg),
      }
    ),
};
