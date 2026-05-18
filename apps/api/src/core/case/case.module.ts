import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CaseController } from './case.controller';
import { CaseService } from './case.service';
import { StageTransitionService } from './stage-transition.service';
import { CriteriaEvaluatorService } from './criteria-evaluator.service';
import { CaseEventService } from './events/case-event.service';
import { HooksModule } from '../hooks/hooks.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    HooksModule,
    RealtimeModule,
    BullModule.registerQueue({ name: 'case-triggers' }),
  ],
  controllers: [CaseController],
  providers: [
    CaseService,
    StageTransitionService,
    CriteriaEvaluatorService,
    CaseEventService,
  ],
})
export class CaseModule {}
