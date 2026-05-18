import { z } from 'zod';
import { EventType } from '../enums';

export const CreateCaseSchema = z.object({
  party_id: z.string(),
  type: z.string().min(1),
  title: z.string().min(1, 'Title is required'),
  workflow_definition_id: z.string(),
  assigned_to_id: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  branch_brand_assignment_id: z.string(),
});

export const UpdateCaseSchema = CreateCaseSchema.partial();

export const CaseResponseSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  branch_brand_assignment_id: z.string(),
  party_id: z.string(),
  type: z.string(),
  title: z.string(),
  stage: z.string(),
  workflow_definition_id: z.string(),
  assigned_to_id: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CaseEventResponseSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  tenant_id: z.string(),
  event_type: z.nativeEnum(EventType),
  from_stage: z.string().nullable(),
  to_stage: z.string().nullable(),
  actor_id: z.string(),
  actor_type: z.enum(['user', 'system', 'trigger']),
  payload: z.record(z.string(), z.unknown()),
  occurred_at: z.string().datetime(),
});

export const TransitionStageSchema = z.object({
  to_stage_id: z.string(),
});

export const TransitionErrorSchema = z.union([
  z.object({ code: z.literal('CASE_NOT_FOUND') }),
  z.object({ code: z.literal('UNAUTHORIZED') }),
  z.object({ code: z.literal('INVALID_TRANSITION') }),
  z.object({ code: z.literal('CRITERIA_UNMET'), unmet: z.array(z.string()) }),
]);

export type CreateCase = z.infer<typeof CreateCaseSchema>;
export type UpdateCase = z.infer<typeof UpdateCaseSchema>;
export type CaseResponse = z.infer<typeof CaseResponseSchema>;
export type CaseEventResponse = z.infer<typeof CaseEventResponseSchema>;
export type TransitionStage = z.infer<typeof TransitionStageSchema>;
export type TransitionError = z.infer<typeof TransitionErrorSchema>;
