import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createHmac } from 'node:crypto';
import { SecretsService } from '../../core/secrets/secrets.service';
import { RoomManagerService } from '../../core/realtime/room-manager.service';
import type { WebhookDeliveryJob } from './webhook-dispatcher.service';

const RETRY_DELAYS = [30_000, 300_000, 1_800_000, 7_200_000, 28_800_000];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;

function backoffDelay(attemptsMade: number): number {
  if (attemptsMade < RETRY_DELAYS.length) {
    return RETRY_DELAYS[attemptsMade] as number;
  }
  return RETRY_DELAYS[RETRY_DELAYS.length - 1] as number;
}

@Processor('webhook-delivery', {
  settings: {
    backoffStrategy: (attemptsMade: number) => backoffDelay(attemptsMade),
  },
})
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  private readonly tenantTimestamps = new Map<string, number[]>();

  constructor(
    private readonly secrets: SecretsService,
    private readonly roomManager: RoomManagerService,
  ) {
    super();
  }

  private isWithinRateLimit(tenantId: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = this.tenantTimestamps.get(tenantId) ?? [];
    const recent = timestamps.filter((t) => t > windowStart);
    return recent.length < RATE_LIMIT_MAX;
  }

  private recordCall(tenantId: string): void {
    const now = Date.now();
    const timestamps = this.tenantTimestamps.get(tenantId) ?? [];
    timestamps.push(now);
    this.tenantTimestamps.set(tenantId, timestamps);
  }

  async process(job: Job<WebhookDeliveryJob>): Promise<void> {
    const { url, secretRef, event, payload, tenantId, timestamp } = job.data;

    if (!this.isWithinRateLimit(tenantId)) {
      await job.moveToDelayed(Date.now() + RATE_LIMIT_WINDOW_MS);
      return;
    }

    this.recordCall(tenantId);

    const deliverable = {
      event,
      payload,
      tenant_id: tenantId,
      timestamp,
    };

    const body = JSON.stringify(deliverable);

    const secretResult = await this.secrets.get(secretRef);

    if (secretResult.isErr()) {
      throw new Error(`Secret resolution failed: ${secretResult.error.code} — ${secretRef}`);
    }

    const secret = secretResult.value;
    const signature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Meta-CRM-Signature': `sha256=${signature}`,
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch (err) {
      throw new Error(`Network error delivering webhook to ${url}: ${(err as Error).message}`);
    }

    if (!response.ok) {
      throw new Error(
        `Webhook delivery to ${url} failed with status ${response.status} ${response.statusText}`,
      );
    }

    this.logger.log(`Webhook delivered to ${url} (event: ${event})`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<WebhookDeliveryJob> | undefined, error: Error): Promise<void> {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 5;

    if (job.attemptsMade < maxAttempts) return;

    const { tenantId, event, url } = job.data;

    this.logger.warn(
      `Webhook dead letter — tenant=${tenantId} event=${event} url=${url} attempts=${job.attemptsMade}`,
    );

    this.roomManager.broadcastToTenant(
      tenantId,
      'webhook:delivery_failed',
      {
        subscriptionId: job.data.subscriptionId,
        event,
        url,
        lastError: error.message,
        failedAt: new Date().toISOString(),
      },
    );
  }
}

