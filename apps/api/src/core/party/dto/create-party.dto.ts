import { IsString, IsOptional, IsEmail, IsIn } from 'class-validator';
import { PartyType, PartySource } from '@meta-crm/types';

export class CreatePartyDto {
  @IsString()
  @IsIn([PartyType.Individual, PartyType.Organization])
  type!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  vertical_id!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(PartySource))
  source?: string;

  @IsOptional()
  attributes?: Record<string, unknown>;
}
