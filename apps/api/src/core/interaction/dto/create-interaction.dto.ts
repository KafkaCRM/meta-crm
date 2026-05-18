import { IsString, IsOptional, IsIn, IsBoolean, IsObject } from 'class-validator';

export class CreateInteractionDto {
  @IsString()
  party_id!: string;

  @IsOptional()
  @IsString()
  case_id?: string;

  @IsString()
  @IsIn(['whatsapp', 'email', 'call', 'note', 'sms', 'facebook'])
  channel!: string;

  @IsString()
  @IsIn(['inbound', 'outbound'])
  direction!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  thread_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
