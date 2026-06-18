import { IsString, IsOptional } from 'class-validator';

export class ConvertLeadDto {
  @IsString()
  vertical_id!: string;

  @IsOptional()
  @IsString()
  assigned_to_id?: string;
}
