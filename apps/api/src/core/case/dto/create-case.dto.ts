import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  party_id!: string;

  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsString()
  pipeline_definition_id!: string;

  @IsString()
  stage!: string;

  @IsString()
  branch_brand_assignment_id!: string;

  @IsOptional()
  @IsString()
  assigned_to_id?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  vertical_id?: string;

  @IsOptional()
  @IsString()
  campaign_id?: string;

  @IsOptional()
  @IsString()
  utm_campaign?: string;
}
