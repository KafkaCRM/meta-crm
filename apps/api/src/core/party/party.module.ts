import { Module } from '@nestjs/common';
import { PartyController } from './party.controller';
import { PartyService } from './party.service';
import { PartyUpsertService } from './party-upsert.service';
import { PartyMergeService } from './party-merge.service';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
  imports: [MetadataModule],
  controllers: [PartyController],
  providers: [PartyService, PartyUpsertService, PartyMergeService],
  exports: [PartyService, PartyUpsertService, PartyMergeService],
})
export class PartyModule {}
