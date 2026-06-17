import { IsString, IsOptional } from 'class-validator';

export class ConvertLeadDto {
  @IsString()
  branch_brand_assignment_id!: string;

  @IsOptional()
  @IsString()
  assigned_to_id?: string;
}
