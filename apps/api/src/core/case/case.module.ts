import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CaseController } from './case.controller';
import { CaseService } from './case.service';
import { StageTransitionService } from './stage-transition.service';
import { CriteriaEvaluatorService } from './criteria-evaluator.service';
import { CaseEventService } from './events/case-event.service';
import { SlaEscalationService } from './sla-escalation.service';
import { HooksModule } from '../hooks/hooks.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CampaignModule } from '../campaign/campaign.module';
import { MetadataModule } from '../metadata/metadata.module';

import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TenantModule,
    HooksModule,
    RealtimeModule,
    CampaignModule,
    MetadataModule,
    BullModule.registerQueue({ name: 'case-triggers' }),
  ],
  controllers: [CaseController],
  providers: [
    CaseService,
    StageTransitionService,
    CriteriaEvaluatorService,
    CaseEventService,
    SlaEscalationService,
  ],
})
export class CaseModule {}
