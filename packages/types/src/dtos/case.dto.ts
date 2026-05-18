import type {
  CreateCase,
  UpdateCase,
  CaseResponse,
  CaseEventResponse,
  TransitionStage,
  TransitionError,
  WorkflowStage,
} from '../schemas';

export type CreateCaseDto = CreateCase;
export type UpdateCaseDto = UpdateCase;
export type CaseDto = CaseResponse;
export type CaseEventDto = CaseEventResponse;
export type TransitionStageDto = TransitionStage;
export type TransitionErrorDto = TransitionError;
export type WorkflowStageDto = WorkflowStage;
