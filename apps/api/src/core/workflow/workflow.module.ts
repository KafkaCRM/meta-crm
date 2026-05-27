import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { AutomationFlowController } from './automation-flow.controller';
import { AutomationFlowService } from './automation-flow.service';
import { AutomationFlowListener } from './automation-flow.listener';
import { AutomationFlowProcessor } from './automation-flow.processor';
import { WhatsAppModule } from '../../integrations/whatsapp/whatsapp.module';

@Module({
  imports: [
    WhatsAppModule,
    BullModule.registerQueue({
      name: 'workflow',
    }),
  ],
  controllers: [WorkflowController, AutomationFlowController],
  providers: [
    WorkflowService,
    AutomationFlowService,
    AutomationFlowListener,
    AutomationFlowProcessor,
  ],
  exports: [
    WorkflowService,
    AutomationFlowService,
  ],
})
export class WorkflowModule {}
