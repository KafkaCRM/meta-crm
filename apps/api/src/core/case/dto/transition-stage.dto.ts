import { IsString } from 'class-validator';

export class TransitionStageDto {
  @IsString()
  to_stage_id!: string;
}
