import { IsString } from 'class-validator';

export class CreateVerticalDto {
  @IsString()
  branch_id!: string;

  @IsString()
  name!: string;
}
