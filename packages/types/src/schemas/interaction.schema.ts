import { z } from 'zod';
import { Channel, Direction } from '../enums';

export const CreateInteractionSchema = z.object({
  party_id: z.string(),
  case_id: z.string().optional(),
  channel: z.nativeEnum(Channel),
  direction: z.nativeEnum(Direction),
  content: z.string().min(1, 'Content is required'),
  thread_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateInteractionSchema = z.object({
  content: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const InteractionResponseSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  party_id: z.string(),
  case_id: z.string().nullable(),
  channel: z.nativeEnum(Channel),
  direction: z.nativeEnum(Direction),
  content: z.string(),
  thread_id: z.string().nullable(),
  is_pinned: z.boolean(),
  pinned_by: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
});

export const ThreadResponseSchema = z.object({
  thread_id: z.string(),
  channel: z.nativeEnum(Channel),
  last_message_preview: z.string(),
  message_count: z.number().int(),
  last_at: z.string().datetime(),
  messages: z.array(InteractionResponseSchema),
});

export const TimelineItemSchema = z.union([
  z.object({ kind: z.literal('interaction'), data: InteractionResponseSchema }),
  z.object({ kind: z.literal('system_event'), data: z.record(z.string(), z.unknown()) }),
  z.object({ kind: z.literal('thread'), data: ThreadResponseSchema }),
]);

export const InteractionListResponseSchema = z.object({
  items: z.array(TimelineItemSchema),
  next_cursor: z.string().nullable(),
});

export type CreateInteraction = z.infer<typeof CreateInteractionSchema>;
export type UpdateInteraction = z.infer<typeof UpdateInteractionSchema>;
export type InteractionResponse = z.infer<typeof InteractionResponseSchema>;
export type ThreadResponse = z.infer<typeof ThreadResponseSchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;
export type InteractionListResponse = z.infer<typeof InteractionListResponseSchema>;
