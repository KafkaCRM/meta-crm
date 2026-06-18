import { IsString, IsOptional, IsInt, IsObject, IsIn, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCampaignDto {
  @IsString()
  branch_id!: string;

  @IsString()
  vertical_id!: string;

  @IsString()
  pipeline_id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'active', 'paused', 'completed'])
  status?: string;

  @IsString()
  channel!: string;

  @Type(() => Date)
  @IsDate()
  start_date!: Date;

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
