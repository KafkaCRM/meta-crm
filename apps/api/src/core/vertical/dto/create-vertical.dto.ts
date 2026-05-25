import { IsString, IsOptional } from 'class-validator';

export class CreateVerticalDto {
  @IsString()
  branch_id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
