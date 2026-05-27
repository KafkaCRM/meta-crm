import { IsString, IsOptional, IsIn, IsBoolean, IsNumber, IsArray, IsObject } from 'class-validator';

export class CreateFieldDefinitionDto {
  @IsString()
  entity_type!: string;

  @IsString()
  name!: string;

  @IsString()
  label!: string;

  @IsString()
  @IsIn(['text', 'number', 'date', 'select', 'multi_select', 'boolean', 'phone', 'email', 'lookup'])
  field_type!: string;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsArray()
  visibility_rules?: unknown[];

  @IsOptional()
  @IsString()
  related_to?: string;
}

export class UpdateFieldDefinitionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsArray()
  visibility_rules?: unknown[];
}

export class SetLabelDto {
  @IsString()
  value!: string;
}
