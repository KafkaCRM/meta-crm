import type {
  CaseDto,
  PipelineStageDto,
  TransitionStageDto,
  TransitionErrorDto,
} from '@meta-crm/types';
import { apiCall } from '@/lib/api';

export interface CaseListParams {
  cursor?: string;
  limit?: number;
  stage?: string;
  assigned_to_id?: string;
  pipeline_definition_id?: string;
}

export interface CursorPaginatedCases {
  data: CaseDto[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface CasesByStage {
  stages: PipelineStageDto[];
  cases: Record<string, CaseDto[]>;
}

const USE_MOCK = false;

function generateMockCases(count: number, stageId: string): CaseDto[] {
  const now = new Date();
  const titles = [
    'Admission Inquiry - Rahul Sharma',
    'Fee Payment Follow-up',
    'Course Selection - Priya Patel',
    'Document Verification Pending',
    'Scholarship Application',
    'Transfer Request',
    'Parent Meeting Scheduled',
    'Entrance Exam Registration',
    'Hostel Allocation Request',
    'Late Fee Waiver Request',
  ];
  const types = ['enrollment', 'appointment', 'deal'];
  const assignments = [
    'assign_abc123',
    'assign_def456',
    'assign_ghi789',
  ];

  return Array.from({ length: count }, (_, i) => {
    const hoursAgo = Math.floor(Math.random() * 500);
    const createdAt = new Date(now.getTime() - hoursAgo * 3600 * 1000);
    const stageChangedHoursAgo = Math.floor(Math.random() * hoursAgo);
    const lastStageChangedAt = new Date(
      now.getTime() - stageChangedHoursAgo * 3600 * 1000,
    );

    const assignedIdx = Math.floor(Math.random() * 4);
    const assignedToId: string | null = assignedIdx < 3 ? assignments[assignedIdx]! : null;
    const assignmentId: string = assignments[Math.floor(Math.random() * assignments.length)]!;

    return {
      id: `case_${stageId}_${i}_${Date.now()}`,
      tenant_id: 'tenant_mock_001',
      branch_brand_assignment_id: assignmentId,
      party_id: `party_${Math.floor(Math.random() * 100)}`,
      type: types[Math.floor(Math.random() * types.length)]!,
      title: titles[i % titles.length] + (i >= titles.length ? ` #${i + 1}` : ''),
      stage: stageId,
      pipeline_definition_id: 'wf_default_001',
      assigned_to_id: assignedToId,
      attributes: {
        course: ['B.Tech', 'MBA', 'B.Com', 'B.Sc', 'M.Tech'][Math.floor(Math.random() * 5)]!,
        priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)]!,
      },
      created_at: createdAt.toISOString(),
      updated_at: now.toISOString(),
      last_stage_changed_at: lastStageChangedAt.toISOString(),
    };
  });
}

function generateMockStages(): PipelineStageDto[] {
  return [
    { id: 'stage_enquiry', pipeline_definition_id: 'wf_default_001', name: 'Enquiry', order: 0, entry_criteria: [], sla_hours: 24 },
    { id: 'stage_counselling', pipeline_definition_id: 'wf_default_001', name: 'Counselling', order: 1, entry_criteria: [], sla_hours: 48 },
    { id: 'stage_application', pipeline_definition_id: 'wf_default_001', name: 'Application', order: 2, entry_criteria: [{ field: 'course', operator: 'is_not_empty' }], sla_hours: 72 },
    { id: 'stage_fee_paid', pipeline_definition_id: 'wf_default_001', name: 'Fee Paid', order: 3, entry_criteria: [{ field: 'fee_structure', operator: 'is_not_empty' }], sla_hours: 168 },
    { id: 'stage_enrolled', pipeline_definition_id: 'wf_default_001', name: 'Enrolled', order: 4, entry_criteria: [], sla_hours: null },
    { id: 'stage_dropped', pipeline_definition_id: 'wf_default_001', name: 'Dropped', order: 5, entry_criteria: [], sla_hours: null },
  ];
}

export const casesApi = {
  list: (params: CaseListParams = {}) => {
    if (USE_MOCK) {
      const stageId = params.stage ?? 'stage_enquiry';
      const limit = params.limit ?? 50;
      const mockCases = generateMockCases(limit, stageId);
      return Promise.resolve<CursorPaginatedCases>({
        data: mockCases,
        next_cursor: null,
        has_more: false,
      });
    }

    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.stage) qs.set('stage', params.stage);
    if (params.assigned_to_id) qs.set('assigned_to_id', params.assigned_to_id);
    if (params.pipeline_definition_id) qs.set('pipeline_definition_id', params.pipeline_definition_id);
    const query = qs.toString();
    return apiCall<CursorPaginatedCases>(`/cases${query ? `?${query}` : ''}`);
  },

  listByStage: (pipelineDefinitionId: string) => {
    if (USE_MOCK) {
      const stages = generateMockStages();
      const cases: Record<string, CaseDto[]> = {};
      for (const stage of stages) {
        cases[stage.id] = generateMockCases(220, stage.id);
      }
      return Promise.resolve<CasesByStage>({ stages, cases });
    }

    return apiCall<CasesByStage>(`/cases/by-stage?pipeline_definition_id=${pipelineDefinitionId}`);
  },

  get: (id: string, params?: { include?: string }) => {
    const query = params?.include ? `?include=${params.include}` : '';
    return apiCall<CaseDto>(`/cases/${id}${query}`);
  },

  update: (id: string, data: { attributes?: Record<string, unknown>; assigned_to_id?: string | null }) =>
    apiCall<CaseDto>(`/cases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  create: (data: { party_id: string; type: string; title: string; pipeline_definition_id: string; branch_brand_assignment_id: string; assigned_to_id?: string }) =>
    apiCall<CaseDto>('/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  transitionStage: (id: string, data: TransitionStageDto) =>
    apiCall<CaseDto>(`/cases/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  bulkAssign: (caseIds: string[], assignedToId: string) =>
    apiCall<{ updated: number }>(`/cases/bulk-assign`, {
      method: 'PATCH',
      body: JSON.stringify({ case_ids: caseIds, assigned_to_id: assignedToId }),
    }),

  bulkMove: (caseIds: string[], toStageId: string) => {
    if (USE_MOCK) {
      return Promise.resolve({ updated: caseIds.length });
    }
    return apiCall<{ updated: number }>(`/cases/bulk-move`, {
      method: 'PATCH',
      body: JSON.stringify({ case_ids: caseIds, to_stage_id: toStageId }),
    });
  },

  listStages: (pipelineDefinitionId: string) => {
    if (USE_MOCK) {
      return Promise.resolve<PipelineStageDto[]>(generateMockStages());
    }
    return apiCall<PipelineStageDto[]>(`/pipelines/${pipelineDefinitionId}/stages`);
  },
};
