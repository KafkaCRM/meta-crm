import { PartialType } from '@nestjs/common';
import { CreatePartyDto } from './create-party.dto';

export class UpdatePartyDto extends PartialType(CreatePartyDto) {}
