// Enums
export { PartyType, PartySource, MergeStatus, CaseStage, EventType, Channel, Direction, TenantRole, PlatformRole } from './enums';

// Schemas + Inferred Types
export {
  VisibilityRuleOperatorSchema,
  VisibilityRuleSchema,
  VisibilityRuleGroupSchema,
  VisibilityRuleEntrySchema,
  FieldTypeSchema,
  CreateFieldDefinitionSchema,
  UpdateFieldDefinitionSchema,
  FieldDefinitionResponseSchema,
  CreatePartySchema,
  UpdatePartySchema,
  PartyResponseSchema,
  CheckDuplicateResponseSchema,
  CreateCaseSchema,
  UpdateCaseSchema,
  CaseResponseSchema,
  CaseEventResponseSchema,
  TransitionStageSchema,
  TransitionErrorSchema,
  CreateInteractionSchema,
  UpdateInteractionSchema,
  InteractionResponseSchema,
  ThreadResponseSchema,
  TimelineItemSchema,
  InteractionListResponseSchema,
  CursorPaginatedResponseSchema,
  CursorQuerySchema,
} from './schemas';

export type {
  VisibilityRuleOperator,
  VisibilityRule,
  VisibilityRuleGroup,
  VisibilityRuleEntry,
  FieldType,
  CreateFieldDefinition,
  UpdateFieldDefinition,
  FieldDefinitionResponse,
  CreateParty,
  UpdateParty,
  PartyResponse,
  CheckDuplicateResponse,
  CreateCase,
  UpdateCase,
  CaseResponse,
  CaseEventResponse,
  TransitionStage,
  TransitionError,
  CreateInteraction,
  UpdateInteraction,
  InteractionResponse,
  ThreadResponse,
  TimelineItem,
  InteractionListResponse,
  CursorQuery,
} from './schemas';

// DTOs
export type {
  CreatePartyDto,
  UpdatePartyDto,
  PartyDto,
  CheckDuplicateDto,
  CreateCaseDto,
  UpdateCaseDto,
  CaseDto,
  CaseEventDto,
  TransitionStageDto,
  TransitionErrorDto,
  CreateInteractionDto,
  UpdateInteractionDto,
  InteractionDto,
  ThreadDto,
} from './dtos';

// Errors
export { AppError, ErrorCodes } from './errors';
export type { ErrorCode } from './errors';

// Field Evaluator
export { evaluateVisibilityRules } from './field-evaluator';
