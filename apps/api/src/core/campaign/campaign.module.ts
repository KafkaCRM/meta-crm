import { Module } from '@nestjs/common';
import { HooksModule } from '../hooks/hooks.module';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignAutoTagService } from './campaign-auto-tag.service';

@Module({
  imports: [HooksModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignAutoTagService],
  exports: [CampaignService, CampaignAutoTagService],
})
export class CampaignModule {}
