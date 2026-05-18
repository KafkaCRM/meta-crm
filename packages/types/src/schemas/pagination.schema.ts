import { z } from 'zod';

export function CursorPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  });
}

export const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CursorQuery = z.infer<typeof CursorQuerySchema>;
