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

export interface Vertical {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email?: string | null;
  phone_number?: string;
  status: string;
  branch_id?: string;
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
  list: (params?: { branch_id?: string; vertical_id?: string; vertical_ids?: string }) => {
    const qs = new URLSearchParams();
    if (params?.branch_id) qs.set('branch_id', params.branch_id);
    if (params?.vertical_id) qs.set('vertical_id', params.vertical_id);
    if (params?.vertical_ids) qs.set('vertical_ids', params.vertical_ids);
    const query = qs.toString();
    return apiCall<any[]>(`/pipelines${query ? `?${query}` : ''}`);
  },
  create: (data: { name: string; entity_type?: string; vertical_id?: string }) =>
    apiCall<any>('/pipelines', { method: 'POST', body: JSON.stringify(data) }),
  getDefault: () => apiCall<any>('/pipelines/default'),
  update: (id: string, data: { name: string; stages: any[]; transitions: any[] }) =>
    apiCall<any>(`/pipelines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiCall<{ success: boolean }>(`/pipelines/${id}`, { method: 'DELETE' }),
};

export const settingsApi = {
  branches: {
    list: (params?: { accessible?: boolean }) => {
      const qs = params?.accessible ? '?accessible=true' : '';
      return apiCall<Branch[]>(`/branches${qs}`);
    },
    create: (data: { name: string; address?: string; city?: string }) =>
      apiCall<Branch>('/branches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; address?: string; city?: string }) =>
      apiCall<Branch>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiCall<{ message: string }>(`/branches/${id}`, { method: 'DELETE' }),
  },

  verticals: {
    list: (params?: { branch_id?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.branch_id) qs.set('branch_id', params.branch_id);
      if (params?.status) qs.set('status', params.status);
      const query = qs.toString();
      return apiCall<Vertical[]>(`/verticals${query ? `?${query}` : ''}`);
    },
    create: (data: { branch_id: string; name: string }) =>
      apiCall<Vertical>('/verticals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string }) =>
      apiCall<Vertical>(`/verticals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiCall<{ message: string }>(`/verticals/${id}`, { method: 'DELETE' }),
  },

  users: {
    list: () => apiCall<User[]>('/users'),
    get: (id: string) => apiCall<any>(`/users/${id}`),
    invite: (data: {
      name: string;
      phone_number: string;
      password?: string;
      role_ids?: string[];
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
        branch_id?: string;
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
  courses: {
    list: (params?: { vertical_id?: string; status?: string; search?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.vertical_id) qs.set('vertical_id', params.vertical_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: any[]; next_cursor?: string }>(`/courses${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<any>(`/courses/${id}`),
    create: (data: {
      name: string; code: string; vertical_id?: string; description?: string;
      category?: string; duration_value?: number; duration_unit?: string;
      mode?: string; fee?: number;
    }) => apiCall<any>('/courses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{
      name: string; code: string; description: string; category: string;
      duration_value: number; duration_unit: string; mode: string; fee: number; status: string;
    }>) => apiCall<any>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/courses/${id}`, { method: 'DELETE' }),
  },

  batches: {
    list: (params?: { course_id?: string; branch_id?: string; status?: string; trainer_id?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.course_id) qs.set('course_id', params.course_id);
      if (params?.branch_id) qs.set('branch_id', params.branch_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.trainer_id) qs.set('trainer_id', params.trainer_id);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: any[]; next_cursor?: string }>(`/batches${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<any>(`/batches/${id}`),
    create: (data: {
      course_id: string; name: string; code: string; branch_id?: string;
      trainer_id?: string; room?: string; start_date?: string; end_date?: string;
      capacity?: number;
    }) => apiCall<any>('/batches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{
      name: string; code: string; trainer_id: string; room: string;
      start_date: string; end_date: string; capacity: number; status: string;
    }>) => apiCall<any>(`/batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/batches/${id}`, { method: 'DELETE' }),
  },

  enrollments: {
    list: (params?: { batch_id?: string; course_id?: string; status?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.batch_id) qs.set('batch_id', params.batch_id);
      if (params?.course_id) qs.set('course_id', params.course_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: any[]; next_cursor?: string }>(`/enrollments${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<any>(`/enrollments/${id}`),
    create: (data: { party_id: string; batch_id?: string; course_id?: string; student_id?: string; roll_number?: string; parent_name?: string; parent_phone?: string }) =>
      apiCall<any>('/enrollments', { method: 'POST', body: JSON.stringify(data) }),
    transfer: (id: string, new_batch_id: string) =>
      apiCall<any>(`/enrollments/${id}/transfer`, { method: 'POST', body: JSON.stringify({ new_batch_id }) }),
    withdraw: (id: string) =>
      apiCall<{ message: string }>(`/enrollments/${id}/withdraw`, { method: 'POST' }),
  },

  attendance: {
    mark: (data: { batch_id: string; enrollment_id: string; date: string; status: string; remarks?: string }) =>
      apiCall<any>('/attendance/mark', { method: 'POST', body: JSON.stringify(data) }),
    bulkMark: (data: { batch_id: string; date: string; records: { enrollment_id: string; status: string; remarks?: string }[] }) =>
      apiCall<any>('/attendance/bulk-mark', { method: 'POST', body: JSON.stringify(data) }),
    list: (params: { batch_id: string; date: string }) =>
      apiCall<any[]>(`/attendance?batch_id=${params.batch_id}&date=${params.date}`),
    report: (params: { batch_id: string; from_date?: string; to_date?: string }) => {
      const qs = new URLSearchParams({ batch_id: params.batch_id });
      if (params.from_date) qs.set('from_date', params.from_date);
      if (params.to_date) qs.set('to_date', params.to_date);
      return apiCall<any>(`/attendance/report?${qs.toString()}`);
    },
  },

  tests: {
    list: (params?: { course_id?: string; batch_id?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.course_id) qs.set('course_id', params.course_id);
      if (params?.batch_id) qs.set('batch_id', params.batch_id);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/tests?${qs.toString()}`);
    },
    get: (id: string) => apiCall<any>(`/tests/${id}`),
    create: (data: { course_id: string; name: string; max_marks: number; batch_id?: string; type?: string; held_on?: string }) =>
      apiCall<any>('/tests', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; type: string; max_marks: number; held_on: string }>) =>
      apiCall<any>(`/tests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/tests/${id}`, { method: 'DELETE' }),
  },

  testScores: {
    record: (data: { test_id: string; enrollment_id: string; marks_obtained: number; grade?: string }) =>
      apiCall<any>('/test-scores/record', { method: 'POST', body: JSON.stringify(data) }),
    bulkRecord: (data: { test_id: string; scores: { enrollment_id: string; marks_obtained: number; grade?: string }[] }) =>
      apiCall<any>('/test-scores/bulk-record', { method: 'POST', body: JSON.stringify(data) }),
    list: (test_id: string) => apiCall<any[]>(`/test-scores?test_id=${test_id}`),
    update: (id: string, data: { marks_obtained?: number; grade?: string }) =>
      apiCall<any>(`/test-scores/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  assignments: {
    list: (params?: { course_id?: string; batch_id?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.course_id) qs.set('course_id', params.course_id);
      if (params?.batch_id) qs.set('batch_id', params.batch_id);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/assignments?${qs.toString()}`);
    },
    get: (id: string) => apiCall<any>(`/assignments/${id}`),
    create: (data: { course_id: string; title: string; batch_id?: string; description?: string; due_date?: string; max_marks?: number }) =>
      apiCall<any>('/assignments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ title: string; description: string; due_date: string; max_marks: number }>) =>
      apiCall<any>(`/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/assignments/${id}`, { method: 'DELETE' }),
  },

  assignmentSubmissions: {
    submit: (data: { assignment_id: string; enrollment_id: string; submission_text?: string; file_url?: string }) =>
      apiCall<any>('/assignment-submissions/submit', { method: 'POST', body: JSON.stringify(data) }),
    grade: (id: string, data: { marks_obtained: number; feedback?: string }) =>
      apiCall<any>(`/assignment-submissions/${id}/grade`, { method: 'POST', body: JSON.stringify(data) }),
    list: (assignment_id: string) => apiCall<any[]>(`/assignment-submissions?assignment_id=${assignment_id}`),
  },

  studyMaterials: {
    list: (params?: { course_id?: string; batch_id?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.course_id) qs.set('course_id', params.course_id);
      if (params?.batch_id) qs.set('batch_id', params.batch_id);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/study-materials?${qs.toString()}`);
    },
    create: (data: { course_id: string; title: string; type: string; url: string; description?: string; batch_id?: string }) =>
      apiCall<any>('/study-materials', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/study-materials/${id}`, { method: 'DELETE' }),
  },

  certificates: {
  departments: {
    list: (params?: { status?: string; cursor?: string; limit?: number }) => apiCall<{ data: any[]; next_cursor?: string }>(`/departments${params?.status ? `?status=${params.status}` : ''}`),
    create: (data: { name: string; description?: string }) => apiCall<any>('/departments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; description: string; status: string }>) => apiCall<any>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/departments/${id}`, { method: 'DELETE' }),
  },
  employees: {
    list: (params?: { department_id?: string; status?: string; search?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.department_id) qs.set('department_id', params.department_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/employees?${qs.toString()}`);
    },
    get: (id: string) => apiCall<any>(`/employees/${id}`),
    create: (data: { employee_code: string; user_id?: string; department_id?: string; designation?: string; joining_date?: string; salary?: number }) =>
      apiCall<any>('/employees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ employee_code: string; department_id: string; designation: string; joining_date: string; salary: number; status: string }>) =>
      apiCall<any>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/employees/${id}`, { method: 'DELETE' }),
  },
  leaveTypes: {
    list: (params?: { status?: string; cursor?: string; limit?: number }) => apiCall<{ data: any[]; next_cursor?: string }>(`/leave-types${params?.status ? `?status=${params.status}` : ''}`),
    create: (data: { name: string; days_per_year: number; carry_forward?: boolean }) => apiCall<any>('/leave-types', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/leave-types/${id}`, { method: 'DELETE' }),
  },
  leaveRequests: {
    list: (params?: { employee_id?: string; status?: string; from_date?: string; to_date?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.employee_id) qs.set('employee_id', params.employee_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.from_date) qs.set('from_date', params.from_date);
      if (params?.to_date) qs.set('to_date', params.to_date);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/leave-requests?${qs.toString()}`);
    },
    create: (data: { employee_id: string; leave_type_id: string; from_date: string; to_date: string; reason?: string }) =>
      apiCall<any>('/leave-requests', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: string) => apiCall<any>(`/leave-requests/${id}/approve`, { method: 'POST' }),
    reject: (id: string) => apiCall<any>(`/leave-requests/${id}/reject`, { method: 'POST' }),
  },
  payslips: {
    list: (params?: { employee_id?: string; month?: number; year?: number; status?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.employee_id) qs.set('employee_id', params.employee_id);
      if (params?.month) qs.set('month', String(params.month));
      if (params?.year) qs.set('year', String(params.year));
      if (params?.status) qs.set('status', params.status);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/payslips?${qs.toString()}`);
    },
    create: (data: { employee_id: string; month: number; year: number; basic?: number; hra?: number; allowances?: number; deductions?: number; net_pay: number }) =>
      apiCall<any>('/payslips', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) => apiCall<any>(`/payslips/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
  templates: {
      list: () => apiCall<any[]>('/certificates/templates'),
      create: (data: { name: string; content: string; description?: string; variables?: any }) =>
        apiCall<any>('/certificates/templates', { method: 'POST', body: JSON.stringify(data) }),
    },
    issue: (data: { enrollment_id: string; template_id?: string; serial_number?: string; completion_date?: string }) =>
      apiCall<any>('/certificates/issue', { method: 'POST', body: JSON.stringify(data) }),
    list: (enrollment_id: string) => apiCall<any[]>(`/certificates?enrollment_id=${enrollment_id}`),
  },

  feePlans: {
    list: (params?: { course_id?: string; status?: string; search?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.course_id) qs.set('course_id', params.course_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: any[]; next_cursor?: string }>(`/fee-plans${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<any>(`/fee-plans/${id}`),
    create: (data: { name: string; course_id: string; total_fee: number; description?: string; installments?: { name: string; amount: number; due_days: number; late_fee?: number }[] }) =>
      apiCall<any>('/fee-plans', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; description: string; total_fee: number; status: string }>) =>
      apiCall<any>(`/fee-plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/fee-plans/${id}`, { method: 'DELETE' }),
  },

  studentFees: {
    list: (params?: { enrollment_id?: string; status?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.enrollment_id) qs.set('enrollment_id', params.enrollment_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: any[]; next_cursor?: string }>(`/student-fees${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<any>(`/student-fees/${id}`),
    create: (data: { enrollment_id: string; fee_plan_id?: string; total_fee: number; discount_amount?: number }) =>
      apiCall<any>('/student-fees', { method: 'POST', body: JSON.stringify(data) }),
    recordPayment: (installmentId: string, data: { amount: number; paid_date?: string; notes?: string }) =>
      apiCall<any>(`/student-fees/${installmentId}/payments`, { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/student-fees/${id}`, { method: 'DELETE' }),
  },

  callLogs: {
    list: (params?: { party_id?: string; lead_id?: string; user_id?: string; direction?: string; from_date?: string; to_date?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.party_id) qs.set('party_id', params.party_id);
      if (params?.lead_id) qs.set('lead_id', params.lead_id);
      if (params?.user_id) qs.set('user_id', params.user_id);
      if (params?.direction) qs.set('direction', params.direction);
      if (params?.from_date) qs.set('from_date', params.from_date);
      if (params?.to_date) qs.set('to_date', params.to_date);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: any[]; next_cursor?: string }>(`/call-logs${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<any>(`/call-logs/${id}`),
    create: (data: { direction: string; from_number: string; to_number: string; party_id?: string; lead_id?: string; user_id?: string; duration_secs?: number; status?: string; recording_url?: string; twilio_call_sid?: string; notes?: string }) =>
      apiCall<any>('/call-logs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ duration_secs: number; status: string; recording_url: string; notes: string; ended_at: string }>) =>
      apiCall<any>(`/call-logs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/call-logs/${id}`, { method: 'DELETE' }),
  },

  scholarships: {
    list: (params?: { status?: string; search?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: any[]; next_cursor?: string }>(`/scholarships${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<any>(`/scholarships/${id}`),
    create: (data: { name: string; type?: string; value: number; eligibility?: string }) =>
      apiCall<any>('/scholarships', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; type: string; value: number; eligibility: string; status: string }>) =>
      apiCall<any>(`/scholarships/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/scholarships/${id}`, { method: 'DELETE' }),
    award: (data: { enrollment_id: string; scholarship_id: string; amount: number }) =>
      apiCall<any>('/scholarships/award', { method: 'POST', body: JSON.stringify(data) }),
    revokeAward: (id: string) =>
      apiCall<any>(`/scholarships/awards/${id}/revoke`, { method: 'POST' }),
    listAwards: (params?: { enrollment_id?: string; scholarship_id?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.enrollment_id) qs.set('enrollment_id', params.enrollment_id);
      if (params?.scholarship_id) qs.set('scholarship_id', params.scholarship_id);
      if (params?.status) qs.set('status', params.status);
      return apiCall<any[]>(`/scholarships/awards/list?${qs.toString()}`);
    },
  },

  employeeAttendance: {
    findByDate: (params: { date: string; department_id?: string }) => {
      const qs = new URLSearchParams({ date: params.date });
      if (params.department_id) qs.set('department_id', params.department_id);
      return apiCall<any[]>(`/employee-attendance?${qs.toString()}`);
    },
    mark: (data: { employee_id: string; date: string; check_in?: string; check_out?: string; status?: string; notes?: string }) =>
      apiCall<any>('/employee-attendance/mark', { method: 'POST', body: JSON.stringify(data) }),
    bulkMark: (data: { date: string; records: { employee_id: string; status: string; check_in?: string; check_out?: string; notes?: string }[] }) =>
      apiCall<any>('/employee-attendance/bulk-mark', { method: 'POST', body: JSON.stringify(data) }),
    report: (params: { employee_id: string; from_date?: string; to_date?: string }) => {
      const qs = new URLSearchParams({ employee_id: params.employee_id });
      if (params.from_date) qs.set('from_date', params.from_date);
      if (params.to_date) qs.set('to_date', params.to_date);
      return apiCall<any[]>(`/employee-attendance/report?${qs.toString()}`);
    },
  },

  departments: {
    list: (params?: { status?: string; cursor?: string; limit?: number }) => apiCall<{ data: any[]; next_cursor?: string }>(`/departments${params?.status ? `?status=${params.status}` : ''}`),
    create: (data: { name: string; description?: string }) => apiCall<any>('/departments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; description: string; status: string }>) => apiCall<any>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/departments/${id}`, { method: 'DELETE' }),
  },
  employees: {
    list: (params?: { department_id?: string; status?: string; search?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.department_id) qs.set('department_id', params.department_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/employees?${qs.toString()}`);
    },
    get: (id: string) => apiCall<any>(`/employees/${id}`),
    create: (data: { employee_code: string; user_id?: string; department_id?: string; designation?: string; joining_date?: string; salary?: number }) =>
      apiCall<any>('/employees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ employee_code: string; department_id: string; designation: string; joining_date: string; salary: number; status: string }>) =>
      apiCall<any>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/employees/${id}`, { method: 'DELETE' }),
  },
  leaveTypes: {
    list: (params?: { status?: string; cursor?: string; limit?: number }) => apiCall<{ data: any[]; next_cursor?: string }>(`/leave-types${params?.status ? `?status=${params.status}` : ''}`),
    create: (data: { name: string; days_per_year: number; carry_forward?: boolean }) => apiCall<any>('/leave-types', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/leave-types/${id}`, { method: 'DELETE' }),
  },
  leaveRequests: {
    list: (params?: { employee_id?: string; status?: string; from_date?: string; to_date?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.employee_id) qs.set('employee_id', params.employee_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.from_date) qs.set('from_date', params.from_date);
      if (params?.to_date) qs.set('to_date', params.to_date);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/leave-requests?${qs.toString()}`);
    },
    create: (data: { employee_id: string; leave_type_id: string; from_date: string; to_date: string; reason?: string }) =>
      apiCall<any>('/leave-requests', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: string) => apiCall<any>(`/leave-requests/${id}/approve`, { method: 'POST' }),
    reject: (id: string) => apiCall<any>(`/leave-requests/${id}/reject`, { method: 'POST' }),
  },
  payslips: {
    list: (params?: { employee_id?: string; month?: number; year?: number; status?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.employee_id) qs.set('employee_id', params.employee_id);
      if (params?.month) qs.set('month', String(params.month));
      if (params?.year) qs.set('year', String(params.year));
      if (params?.status) qs.set('status', params.status);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/payslips?${qs.toString()}`);
    },
    create: (data: { employee_id: string; month: number; year: number; basic?: number; hra?: number; allowances?: number; deductions?: number; net_pay: number }) =>
      apiCall<any>('/payslips', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) => apiCall<any>(`/payslips/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
  tasks: {
    list: (params?: { status?: string; priority?: string; assignee_id?: string; due_before?: string; due_after?: string; search?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.priority) qs.set('priority', params.priority);
      if (params?.assignee_id) qs.set('assignee_id', params.assignee_id);
      if (params?.due_before) qs.set('due_before', params.due_before);
      if (params?.due_after) qs.set('due_after', params.due_after);
      if (params?.search) qs.set('search', params.search);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: any[]; next_cursor?: string }>(`/tasks${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<any>(`/tasks/${id}`),
    create: (data: { title: string; description?: string; status?: string; priority?: string; due_date?: string; assignee_id?: string; related_type?: string; related_id?: string }) =>
      apiCall<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ title: string; description: string; status: string; priority: string; due_date: string; assignee_id: string }>) =>
      apiCall<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/tasks/${id}`, { method: 'DELETE' }),
  },
  notes: {
    list: (params?: { search?: string; related_type?: string; related_id?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set('search', params.search);
      if (params?.related_type) qs.set('related_type', params.related_type);
      if (params?.related_id) qs.set('related_id', params.related_id);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return apiCall<{ data: any[]; next_cursor?: string }>(`/notes${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<any>(`/notes/${id}`),
    create: (data: { title: string; content?: string; related_type?: string; related_id?: string }) =>
      apiCall<any>('/notes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ title: string; content: string }>) =>
      apiCall<any>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/notes/${id}`, { method: 'DELETE' }),
  },
  productCategories: {
    list: () => apiCall<any[]>('/product-categories'),
    create: (data: { name: string; description?: string; parent_id?: string }) => apiCall<any>('/product-categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; description?: string; parent_id?: string }) => apiCall<any>(`/product-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/product-categories/${id}`, { method: 'DELETE' }),
  },
  products: {
    list: (params?: { category_id?: string; status?: string; search?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.category_id) qs.set('category_id', params.category_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/products?${qs.toString()}`);
    },
    get: (id: string) => apiCall<any>(`/products/${id}`),
    create: (data: { name: string; sku: string; description?: string; unit?: string; price?: number; category_id?: string }) =>
      apiCall<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; sku: string; description: string; unit: string; price: number; category_id: string; status: string }>) =>
      apiCall<any>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/products/${id}`, { method: 'DELETE' }),
  },
  warehouses: {
    list: () => apiCall<any[]>('/warehouses'),
    create: (data: { name: string; location?: string }) => apiCall<any>('/warehouses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; location?: string; status?: string }) => apiCall<any>(`/warehouses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/warehouses/${id}`, { method: 'DELETE' }),
  },
  stock: {
    list: (params?: { product_id?: string; warehouse_id?: string; low_stock?: boolean; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.product_id) qs.set('product_id', params.product_id);
      if (params?.warehouse_id) qs.set('warehouse_id', params.warehouse_id);
      if (params?.low_stock) qs.set('low_stock', 'true');
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/stock?${qs.toString()}`);
    },
    adjust: (data: { product_id: string; warehouse_id: string; quantity: number }) =>
      apiCall<any>('/stock/adjust', { method: 'POST', body: JSON.stringify(data) }),
  },
  stockMovements: {
    list: (params?: { product_id?: string; warehouse_id?: string; type?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.product_id) qs.set('product_id', params.product_id);
      if (params?.warehouse_id) qs.set('warehouse_id', params.warehouse_id);
      if (params?.type) qs.set('type', params.type);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/stock-movements?${qs.toString()}`);
    },
    create: (data: { product_id: string; warehouse_id: string; type: string; quantity: number; reference?: string; notes?: string }) =>
      apiCall<any>('/stock-movements', { method: 'POST', body: JSON.stringify(data) }),
  },
  assets: {
    list: (params?: { status?: string; type?: string; search?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.type) qs.set('type', params.type);
      if (params?.search) qs.set('search', params.search);
      if (params?.cursor) qs.set('cursor', params.cursor);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiCall<{ data: any[]; next_cursor?: string }>(`/assets?${qs.toString()}`);
    },
    get: (id: string) => apiCall<any>(`/assets/${id}`),
    create: (data: { name: string; asset_code: string; type?: string; status?: string; assigned_to_id?: string; purchase_date?: string; purchase_cost?: number; notes?: string }) =>
      apiCall<any>('/assets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; asset_code: string; type: string; status: string; assigned_to_id: string; purchase_date: string; purchase_cost: number; notes: string }>) =>
      apiCall<any>(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => apiCall<{ message: string }>(`/assets/${id}`, { method: 'DELETE' }),
  },
  inbox: {
    conversations: () => apiCall<any[]>('/inbox/conversations'),
  },
  templates: {
    apply: (industry: string) =>
      apiCall<{ success: boolean }>('/templates/apply', { method: 'POST', body: JSON.stringify({ industry }) }),
  },
};
