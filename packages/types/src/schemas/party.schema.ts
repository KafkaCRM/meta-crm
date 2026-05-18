import { z } from 'zod';
import { PartyType, PartySource, MergeStatus } from '../enums';

export const CreatePartySchema = z.object({
  type: z.nativeEnum(PartyType),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required'),
  source: z.nativeEnum(PartySource),
  attributes: z.record(z.string(), z.unknown()).optional(),
  branch_brand_assignment_id: z.string(),
});

export const UpdatePartySchema = CreatePartySchema.partial();

export const PartyResponseSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  branch_brand_assignment_id: z.string(),
  type: z.nativeEnum(PartyType),
  name: z.string(),
  email: z.string().nullable(),
  phone_raw: z.string(),
  phone_normalized: z.string(),
  source: z.nativeEnum(PartySource),
  attributes: z.record(z.string(), z.unknown()),
  merge_status: z.nativeEnum(MergeStatus),
  merged_into_id: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CheckDuplicateResponseSchema = z.object({
  found: z.boolean(),
  confidence: z.number().min(0).max(1),
  match: z
    .object({
      id: z.string(),
      name: z.string(),
      phone_normalized: z.string(),
      source: z.nativeEnum(PartySource),
      created_at: z.string().datetime(),
    })
    .optional(),
});

export type CreateParty = z.infer<typeof CreatePartySchema>;
export type UpdateParty = z.infer<typeof UpdatePartySchema>;
export type PartyResponse = z.infer<typeof PartyResponseSchema>;
export type CheckDuplicateResponse = z.infer<typeof CheckDuplicateResponseSchema>;
