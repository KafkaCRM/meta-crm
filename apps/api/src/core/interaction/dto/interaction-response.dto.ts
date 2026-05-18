export interface InteractionDto {
  id: string;
  party_id: string;
  case_id?: string | null;
  channel: string;
  direction: string;
  content: string;
  thread_id?: string | null;
  is_pinned: boolean;
  pinned_by?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ThreadObject {
  thread_id: string;
  channel: string;
  last_message_preview: string;
  message_count: number;
  last_at: string;
  messages: InteractionDto[];
}

export interface CaseEventDto {
  id: string;
  case_id: string;
  event_type: string;
  from_stage?: string | null;
  to_stage?: string | null;
  actor_id: string;
  actor_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export type TimelineItem =
  | { kind: 'interaction'; data: InteractionDto }
  | { kind: 'thread'; data: ThreadObject }
  | { kind: 'system_event'; data: CaseEventDto };

export interface InteractionListResponse {
  items: TimelineItem[];
  next_cursor: string | null;
}
