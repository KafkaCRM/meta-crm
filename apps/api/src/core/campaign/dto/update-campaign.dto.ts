import { IsString, IsOptional, IsInt, IsObject, IsIn, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  brand_id?: string;

  @IsOptional()
  @IsString()
  vertical_id?: string;

  @IsOptional()
  @IsString()
  pipeline_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'active', 'paused', 'completed'])
  status?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start_date?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  end_date?: Date;

  @IsOptional()
  @IsInt()
  target_leads?: number;

  @IsOptional()
  @IsString()
  utm_source?: string;

  @IsOptional()
  @IsString()
  utm_medium?: string;

  @IsOptional()
  @IsString()
  utm_campaign?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
