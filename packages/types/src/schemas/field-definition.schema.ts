import { z } from 'zod';

// --- TypeScript types (manual, to support recursion) ---

export type VisibilityRuleOperator = 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'lt' | 'is_empty' | 'is_not_empty';

export interface VisibilityRule {
  field: string;
  operator: VisibilityRuleOperator;
  value: unknown;
}

export interface VisibilityRuleGroup {
  all: VisibilityRuleEntry[] | undefined;
  any: VisibilityRuleEntry[] | undefined;
}

export type VisibilityRuleEntry = VisibilityRule | VisibilityRuleGroup;

// --- Zod validation schemas ---

export const VisibilityRuleOperatorSchema = z.enum([
  'eq',
  'neq',
  'in',
  'not_in',
  'gt',
  'lt',
  'is_empty',
  'is_not_empty',
]);

export const VisibilityRuleSchema: z.ZodType<VisibilityRule> = z.object({
  field: z.string(),
  operator: VisibilityRuleOperatorSchema,
  value: z.unknown(),
});

export const VisibilityRuleGroupSchema = z.object({
  all: z.array(z.lazy(() => VisibilityRuleEntrySchema)).optional(),
  any: z.array(z.lazy(() => VisibilityRuleEntrySchema)).optional(),
}) as unknown as z.ZodType<VisibilityRuleGroup>;

export const VisibilityRuleEntrySchema: z.ZodType<VisibilityRuleEntry> = z.lazy(() =>
  z.union([VisibilityRuleSchema, VisibilityRuleGroupSchema]),
);

// --- Non-recursive schemas ---

export const FieldTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'select',
  'multi_select',
  'boolean',
  'phone',
  'email',
  'lookup',
]);

export type FieldType = z.infer<typeof FieldTypeSchema>;

export const CreateFieldDefinitionSchema = z.object({
  entity_type: z.string(),
  name: z.string().min(1),
  label: z.string().min(1),
  field_type: FieldTypeSchema,
  options: z.array(z.string()).optional().nullable(),
  required: z.boolean().optional(),
  order: z.number().int().optional(),
  visibility_rules: z.array(VisibilityRuleEntrySchema).optional(),
  related_to: z.string().optional().nullable(),
});

export const UpdateFieldDefinitionSchema = CreateFieldDefinitionSchema.partial();

export const FieldDefinitionResponseSchema = CreateFieldDefinitionSchema.extend({
  id: z.string(),
  tenant_id: z.string(),
  created_at: z.string().datetime(),
});

export type CreateFieldDefinition = z.infer<typeof CreateFieldDefinitionSchema>;
export type UpdateFieldDefinition = z.infer<typeof UpdateFieldDefinitionSchema>;
export type FieldDefinitionResponse = z.infer<typeof FieldDefinitionResponseSchema>;
