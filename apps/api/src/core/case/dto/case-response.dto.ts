export interface CaseResponse {
  id: string;
  branch_brand_assignment_id: string;
  party_id: string;
  type: string;
  title: string;
  stage: string;
  workflow_definition_id: string;
  assigned_to_id?: string | null;
  attributes: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  vertical_id: string | null;
  campaign_id: string | null;
  campaign?: {
    id: string;
    name: string;
    channel: string;
  };
}

export interface CaseEventResponse {
  id: string;
  case_id: string;
  event_type: string;
  from_stage?: string | null;
  to_stage?: string | null;
  actor_id: string;
  actor_type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

export interface CursorPaginatedCases {
  data: CaseResponse[];
  next_cursor?: string;
}
