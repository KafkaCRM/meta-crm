import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';

interface RecordEventPayload {
  tenantId: string;
  objectType: string;
  event: 'create' | 'update';
  record: any;
}

@Injectable()
export class AutomationFlowListener {
  constructor(
    @InjectQueue('workflow') private readonly workflowQueue: Queue,
    private readonly platformDb: PlatformPrismaService,
  ) {}

  @OnEvent('record.event', { async: true })
  async handleRecordEvent(payload: RecordEventPayload) {
    try {
      const triggerEvent = `${payload.objectType}:${payload.event}`;

      // Query active automation flows for this tenant and this specific trigger event
      const flows = await this.platformDb.client.automationFlow.findMany({
        where: {
          tenant_id: payload.tenantId,
          trigger_event: triggerEvent,
          is_active: true,
        },
      });

      for (const flow of flows) {
        await this.workflowQueue.add(
          'execute-flow',
          {
            tenantId: payload.tenantId,
            flowId: flow.id,
            record: payload.record,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        );
      }
    } catch (error) {
      console.error('Error in handleRecordEvent:', error);
    }
  }
}
