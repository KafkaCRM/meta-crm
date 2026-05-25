export interface CampaignStageStats {
  stage_name: string;
  count: number;
  percentage: number;
}

export interface CampaignStats {
  total_leads: number;
  contacted: number;
  converted: number;
  lost: number;
  conversion_rate: number;
  avg_days_to_convert: number;
  by_stage: CampaignStageStats[];
}

export interface CampaignResponse {
  id: string;
  tenant_id: string;
  branch_id: string;
  brand_id: string;
  vertical_id: string;
  pipeline_id: string;
  name: string;
  status: string;
  channel: string;
  start_date: Date;
  end_date?: Date | null;
  target_leads?: number | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  attributes: Record<string, any>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  stats?: CampaignStats;
}

export interface CampaignSummaryStats {
  id: string;
  name: string;
  channel: string;
  status: string;
  total_leads: number;
  converted: number;
  conversion_rate: number;
}

export interface CampaignAggregateStatsResponse {
  campaigns: CampaignSummaryStats[];
  top_channel: string | null;
  total_leads: number;
  total_converted: number;
  overall_conversion_rate: number;
}
