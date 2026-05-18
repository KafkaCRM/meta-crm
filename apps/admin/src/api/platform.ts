import { apiCall } from '@/lib/api';

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  created_at: string;
  branch_count: number;
  user_count: number;
  case_count: number;
}

export interface TenantListResponse {
  data: TenantListItem[];
  next_cursor: string | undefined;
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  created_at: string;
  branch_count: number;
  user_count: number;
  plugin_list: string[];
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  industry: string;
  plan_id: string;
  owner: {
    name: string;
    email: string;
  };
}

export interface CreateTenantResponse {
  tenant: {
    id: string;
    name: string;
    slug: string;
    industry: string;
  };
  owner: {
    email: string;
    temporary_password: string;
  };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  max_branches: number;
  max_users: number;
  max_plugins: number;
  price_monthly: number | null;
  created_at: string;
}

export async function listTenants(cursor?: string, limit = 50): Promise<TenantListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  return apiCall<TenantListResponse>(`/platform/tenants?${params.toString()}`);
}

export async function getTenant(id: string): Promise<TenantDetail> {
  return apiCall<TenantDetail>(`/platform/tenants/${id}`);
}

export async function createTenant(data: CreateTenantRequest): Promise<CreateTenantResponse> {
  return apiCall<CreateTenantResponse>('/platform/tenants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function suspendTenant(id: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/tenants/${id}/suspend`, {
    method: 'PATCH',
  });
}

export async function reactivateTenant(id: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/tenants/${id}/reactivate`, {
    method: 'PATCH',
  });
}

export async function applyTemplate(id: string, industry: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/tenants/${id}/apply-template`, {
    method: 'POST',
    body: JSON.stringify({ industry }),
  });
}

export async function listPlans(): Promise<SubscriptionPlan[]> {
  return apiCall<SubscriptionPlan[]>('/platform/plans');
}

export async function assignPlan(tenantId: string, planId: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/tenants/${tenantId}/assign-plan`, {
    method: 'POST',
    body: JSON.stringify({ plan_id: planId }),
  });
}
