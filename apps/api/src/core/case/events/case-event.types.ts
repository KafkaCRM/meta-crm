export enum CaseEventType {
  StageChanged = 'stage_changed',
  AttributeUpdated = 'attribute_updated',
  NoteAdded = 'note_added',
  AssignmentChanged = 'assignment_changed',
  CriteriaRejected = 'criteria_rejected',
  TriggerFailed = 'trigger_failed',
  CaseCreated = 'case_created',
  CaseMerged = 'case_merged',
}

export interface CaseEventPayload {
  case_id: string;
  tenant_id: string;
  event_type: string;
  from_stage?: string;
  to_stage?: string;
  actor_id: string;
  actor_type: string;
  payload?: Record<string, unknown>;
}
