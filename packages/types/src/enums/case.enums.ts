export enum CaseStage {
  New = 'new',
  Contacted = 'contacted',
  Qualified = 'qualified',
  Negotiation = 'negotiation',
  Won = 'won',
  Lost = 'lost',
}

export enum EventType {
  StageChanged = 'stage_changed',
  AttributeUpdated = 'attribute_updated',
  NoteAdded = 'note_added',
  AssignmentChanged = 'assignment_changed',
  CriteriaRejected = 'criteria_rejected',
  TriggerFailed = 'trigger_failed',
  CaseCreated = 'case_created',
  CaseMerged = 'case_merged',
  SlaBreached = 'sla_breached',
}
