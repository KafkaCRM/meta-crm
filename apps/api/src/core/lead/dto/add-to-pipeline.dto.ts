import { IsString } from 'class-validator';

export class AddToPipelineDto {
  @IsString()
  pipeline_definition_id!: string;
}
