export interface PartyResponse {
  id: string;
  type: string;
  name: string;
  email?: string | null;
  phone_raw: string;
  phone_normalized: string;
  source: string;
  vertical_id: string;
  attributes: Record<string, unknown>;
  merge_status: string;
  merged_into_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CursorPaginatedParties {
  data: PartyResponse[];
  next_cursor?: string;
}
