export interface VerticalResponse {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  description?: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  pipeline_count?: number;
  active_campaign_count?: number;
}

export interface VerticalStats {
  total_leads: number;
  active_leads: number;
  converted: number;
  conversion_rate: number;
  active_campaigns: number;
  pipelines: number;
}

export interface VerticalDetailResponse {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  description?: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  stats: VerticalStats;
}
