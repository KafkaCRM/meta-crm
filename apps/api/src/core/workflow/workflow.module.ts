import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { AutomationWorkflowController } from './automation-flow.controller';
import { AutomationWorkflowService } from './automation-flow.service';
import { AutomationWorkflowListener } from './automation-flow.listener';
import { AutomationWorkflowProcessor } from './automation-flow.processor';
import { WhatsAppModule } from '../../integrations/whatsapp/whatsapp.module';

@Module({
  imports: [
    WhatsAppModule,
    BullModule.registerQueue({
      name: 'workflow',
    }),
  ],
  controllers: [WorkflowController, AutomationWorkflowController],
  providers: [
    WorkflowService,
    AutomationWorkflowService,
    AutomationWorkflowListener,
    AutomationWorkflowProcessor,
  ],
  exports: [
    WorkflowService,
    AutomationWorkflowService,
  ],
})
export class WorkflowModule {}
