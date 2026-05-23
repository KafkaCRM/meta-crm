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
  plugin_ids: string[];
  enabled_capabilities: string[];
  custom_limits?: Record<string, any>;
  plan?: {
    id: string;
    name: string;
    max_branches: number;
    max_users: number;
    max_plugins: number;
  } | null;
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

export interface CreatePlanRequest {
  name: string;
  max_branches: number;
  max_users: number;
  max_plugins: number;
  price_monthly?: number;
}

export interface UpdatePlanRequest {
  max_branches?: number;
  max_users?: number;
  max_plugins?: number;
  price_monthly?: number;
}

export async function listPlans(): Promise<SubscriptionPlan[]> {
  return apiCall<SubscriptionPlan[]>('/platform/plans');
}

export async function createPlan(data: CreatePlanRequest): Promise<SubscriptionPlan> {
  return apiCall<SubscriptionPlan>('/platform/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePlan(id: string, data: UpdatePlanRequest): Promise<SubscriptionPlan> {
  return apiCall<SubscriptionPlan>(`/platform/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function assignPlan(tenantId: string, planId: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/tenants/${tenantId}/assign-plan`, {
    method: 'POST',
    body: JSON.stringify({ plan_id: planId }),
  });
}

export interface PluginRegistry {
  id: string;
  package_name: string;
  version: string;
  manifest: {
    id: string;
    name: string;
    description: string;
    compatible_industries: string[];
    hooks: string[];
    extends: string[];
  };
  status: string;
  created_at: string;
  tenant_count?: number;
}

export interface CreatePluginRequest {
  package_name: string;
  version: string;
  manifest: Record<string, unknown>;
}

export async function listPlugins(): Promise<PluginRegistry[]> {
  return apiCall<PluginRegistry[]>('/platform/plugins');
}

export async function createPlugin(data: CreatePluginRequest): Promise<PluginRegistry> {
  return apiCall<PluginRegistry>('/platform/plugins', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deprecatePlugin(id: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/plugins/${id}/deprecate`, {
    method: 'PATCH',
  });
}

export async function disablePlugin(id: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/plugins/${id}/disable`, {
    method: 'PATCH',
  });
}

export async function getPlugin(id: string): Promise<PluginRegistry & { tenant_count: number }> {
  return apiCall<PluginRegistry & { tenant_count: number }>(`/platform/plugins/${id}`);
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  status: string;
  created_at: string;
}

export interface InvitePlatformUserRequest {
  name: string;
  email: string;
  role: string;
}

export async function listPlatformUsers(): Promise<PlatformUser[]> {
  return apiCall<PlatformUser[]>('/platform/team');
}

export async function invitePlatformUser(data: InvitePlatformUserRequest): Promise<PlatformUser> {
  return apiCall<PlatformUser>('/platform/team/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function changePlatformUserRole(userId: string, role: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/team/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function deactivatePlatformUser(userId: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/team/${userId}`, {
    method: 'DELETE',
  });
}

export interface TenantCountResponse {
  total: number;
  by_industry: { industry: string; count: number }[];
}

export interface MauResponse {
  monthly_active: { tenant_id: string; active_users: number }[];
}

export interface CasesPerDayResponse {
  daily: { date: string; count: number }[];
}

export interface PluginUsageResponse {
  plugins: { plugin_package: string; tenant_count: number }[];
}

export async function getTenantCount(): Promise<TenantCountResponse> {
  return apiCall<TenantCountResponse>('/platform/reports/tenant-count');
}

export async function getMau(params?: { date_from?: string; date_to?: string }): Promise<MauResponse> {
  const qs = new URLSearchParams();
  if (params?.date_from) qs.set('date_from', params.date_from);
  if (params?.date_to) qs.set('date_to', params.date_to);
  return apiCall<MauResponse>(`/platform/reports/mau?${qs.toString()}`);
}

export async function getCasesPerDay(params?: { date_from?: string; date_to?: string }): Promise<CasesPerDayResponse> {
  const qs = new URLSearchParams();
  if (params?.date_from) qs.set('date_from', params.date_from);
  if (params?.date_to) qs.set('date_to', params.date_to);
  return apiCall<CasesPerDayResponse>(`/platform/reports/cases-per-day?${qs.toString()}`);
}

export async function getPluginUsage(): Promise<PluginUsageResponse> {
  return apiCall<PluginUsageResponse>('/platform/reports/plugin-usage');
}

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  processing_rate: number;
}

export interface FailedJob {
  id: string;
  queue: string;
  name: string;
  attempts: number;
  max_attempts: number;
  failed_at: string;
  error: string;
}

export interface WebhookFailure {
  id: string;
  tenant_id: string;
  event_type: string;
  last_error: string;
  attempts: number;
  failed_at: string;
}

export async function getQueueStatus(): Promise<QueueStatus> {
  return apiCall<QueueStatus>('/platform/system/queue/status');
}

export async function getFailedJobs(): Promise<FailedJob[]> {
  return apiCall<FailedJob[]>('/platform/system/queue/failed');
}

export async function retryFailedJob(jobId: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/system/queue/failed/${jobId}/retry`, {
    method: 'POST',
  });
}

export async function getWebhookFailures(): Promise<WebhookFailure[]> {
  return apiCall<WebhookFailure[]>('/platform/system/webhooks/failures');
}

export async function retryWebhookFailure(failureId: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/system/webhooks/failures/${failureId}/retry`, {
    method: 'POST',
  });
}

export async function updateTenantEntitlements(id: string, pluginIds: string[]): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/platform/tenants/${id}/entitlements`, {
    method: 'PATCH',
    body: JSON.stringify({ plugin_ids: pluginIds }),
  });
}

export async function updateTenantCapabilities(id: string, capabilities: string[]): Promise<TenantDetail> {
  return apiCall<TenantDetail>(`/platform/tenants/${id}/capabilities`, {
    method: 'PATCH',
    body: JSON.stringify({ capabilities }),
  });
}

export async function resetTenantOwnerPassword(id: string): Promise<{ email: string; temporary_password: string }> {
  return apiCall<{ email: string; temporary_password: string }>(`/platform/tenants/${id}/reset-owner-password`, {
    method: 'PATCH',
  });
}

export async function updateTenantOverrides(id: string, overrides: Record<string, any>): Promise<TenantDetail> {
  return apiCall<TenantDetail>(`/platform/tenants/${id}/overrides`, {
    method: 'PATCH',
    body: JSON.stringify(overrides),
  });
}
