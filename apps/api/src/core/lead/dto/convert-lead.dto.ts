import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class ConvertLeadDto {
  @IsString()
  branch_brand_assignment_id!: string;

  @IsOptional()
  @IsBoolean()
  create_case?: boolean;

  @IsOptional()
  @IsString()
  case_title?: string;

  @IsOptional()
  @IsString()
  case_type?: string;

  @IsOptional()
  @IsString()
  case_stage?: string;

  @IsOptional()
  @IsString()
  workflow_definition_id?: string;

  @IsOptional()
  @IsString()
  assigned_to_id?: string;

  @IsOptional()
  @IsString()
  vertical_id?: string;

  @IsOptional()
  @IsString()
  campaign_id?: string;
}
