import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export interface WebhookDeliveryJob {
  subscriptionId: string;
  url: string;
  secretRef: string;
  event: string;
  payload: Record<string, unknown>;
  tenantId: string;
  timestamp: string;
}

@Injectable()
export class WebhookDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly cls: ClsService,
    private readonly db: TenantScopedPrismaService,
    @InjectQueue('webhook-delivery') private readonly webhookQueue: Queue,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.onAny(async (event: string | string[], payload: any) => {
      const eventName = Array.isArray(event) ? (event[0] ?? '') : event;
      const tenantId = payload?.['tenant_id'] as string | undefined;
      if (!tenantId) return;

      try {
        await this.cls.run(async () => {
          this.cls.set('scope', {
            tenant_id: tenantId,
            user_id: '',
            assignment_ids: [],
            role: 'branch_user',
          } as RequestScope);

          await this.handleEvent(eventName, payload as Record<string, unknown>);
        });
      } catch (err) {
        this.logger.error(`Failed to dispatch webhooks for event ${eventName}`, (err as Error).stack);
      }
    });
  }

  private async handleEvent(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const subscriptions = await this.db.getClient().webhookSubscription.findMany({
      where: { event, enabled: true },
    });

    if (subscriptions.length === 0) return;

    const tenantId = payload['tenant_id'] as string;
    const timestamp = new Date().toISOString();

    const jobs = subscriptions.map((sub) => ({
      name: 'deliver',
      data: {
        subscriptionId: sub.id,
        url: sub.url,
        secretRef: sub.secret_ref,
        event,
        payload,
        tenantId,
        timestamp,
      } satisfies WebhookDeliveryJob,
      opts: { attempts: 5 },
    }));

    await this.webhookQueue.addBulk(jobs);
  }
}
