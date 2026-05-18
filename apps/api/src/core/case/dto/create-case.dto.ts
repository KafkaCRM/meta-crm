import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  party_id!: string;

  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsString()
  workflow_definition_id!: string;

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
}
