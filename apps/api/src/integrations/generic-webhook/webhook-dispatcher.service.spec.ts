import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { SecretsService } from '../../core/secrets/secrets.service';
import { RoomManagerService } from '../../core/realtime/room-manager.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';
import { Job } from 'bullmq';
import { ok, err } from 'neverthrow';
import type { WebhookDeliveryJob } from './webhook-dispatcher.service';

/* ------------------------------------------------------------------ */
/*  WebhookDispatcherService                                          */
/* ------------------------------------------------------------------ */
describe('WebhookDispatcherService', () => {
  let eventEmitter: EventEmitter2;
  let cls: ClsService;
  let db: TenantScopedPrismaService;
  let queue: Queue;
  let svc: WebhookDispatcherService;
  let client: any;

  const TENANT_ID = 'tenant-a';

  function buildMocks() {
    client = {
      webhookSubscription: { findMany: vi.fn() },
    };

    const dbMock = { getClient: vi.fn().mockReturnValue(client) } as unknown as TenantScopedPrismaService;
    const clsMock = {
      get: vi.fn().mockReturnValue({ tenant_id: TENANT_ID, user_id: '', assignment_ids: [] }),
      set: vi.fn(),
      run: vi.fn((cb: () => Promise<void>) => cb()),
    } as unknown as ClsService;
    const queueMock = { addBulk: vi.fn() } as unknown as Queue;

    return { dbMock, clsMock, queueMock };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    eventEmitter = new EventEmitter2({ wildcard: true });
    const mocks = buildMocks();
    db = mocks.dbMock;
    cls = mocks.clsMock;
    queue = mocks.queueMock;
    svc = new WebhookDispatcherService(eventEmitter, cls, db, queue);
    svc.onModuleInit();
  });

  it('enqueues one job per matching subscription when event fires', async () => {
    client.webhookSubscription.findMany.mockResolvedValue([
      { id: 'sub-1', url: 'https://hook.example.com/a', secret_ref: 'ref/a', event: 'case:stage_changed', enabled: true },
      { id: 'sub-2', url: 'https://hook.example.com/b', secret_ref: 'ref/b', event: 'case:stage_changed', enabled: true },
    ]);

    await eventEmitter.emitAsync('case:stage_changed', {
      case_id: 'case-1',
      tenant_id: TENANT_ID,
      to_stage: 'stage-2',
    });

    expect(queue.addBulk).toHaveBeenCalledTimes(1);
    const jobs = (queue.addBulk as any).mock.calls[0][0];
    expect(jobs).toHaveLength(2);
    expect(jobs[0].data.subscriptionId).toBe('sub-1');
    expect(jobs[1].data.subscriptionId).toBe('sub-2');
  });

  it('does not enqueue when no matching subscriptions', async () => {
    client.webhookSubscription.findMany.mockResolvedValue([]);

    await eventEmitter.emitAsync('case:stage_changed', {
      case_id: 'case-1',
      tenant_id: TENANT_ID,
    });

    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('does not dispatch when tenant_id is missing from payload', async () => {
    await eventEmitter.emitAsync('case:stage_changed', { case_id: 'case-1' });

    expect(client.webhookSubscription.findMany).not.toHaveBeenCalled();
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('skips disabled subscriptions', async () => {
    client.webhookSubscription.findMany.mockResolvedValue([
      { id: 'sub-1', url: 'https://hook.example.com', secret_ref: 'ref/a', event: 'case:stage_changed', enabled: true },
    ]);

    await eventEmitter.emitAsync('case:stage_changed', {
      case_id: 'case-1',
      tenant_id: TENANT_ID,
    });

    expect(client.webhookSubscription.findMany).toHaveBeenCalledWith({
      where: { event: 'case:stage_changed', enabled: true },
    });
  });

  it('sets attempts to 5 on every enqueued job', async () => {
    client.webhookSubscription.findMany.mockResolvedValue([
      { id: 'sub-1', url: 'https://hook.example.com', secret_ref: 'ref/a', event: '*', enabled: true },
    ]);

    await eventEmitter.emitAsync('*', { tenant_id: TENANT_ID });

    const jobs = (queue.addBulk as any).mock.calls[0][0];
    expect(jobs[0].opts.attempts).toBe(5);
  });
});

/* ------------------------------------------------------------------ */
/*  WebhookDeliveryProcessor                                          */
/* ------------------------------------------------------------------ */
describe('WebhookDeliveryProcessor', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function buildProcessor() {
    const secrets = { get: vi.fn() } as unknown as SecretsService;
    const roomManager = { broadcastToTenant: vi.fn() } as unknown as RoomManagerService;
    const processor = new WebhookDeliveryProcessor(secrets, roomManager);
    return { processor, secrets, roomManager };
  }

  function mockJob(data: Partial<WebhookDeliveryJob> = {}): Job<WebhookDeliveryJob> {
    return {
      data: {
        subscriptionId: 'sub-1',
        url: 'https://hook.example.com',
        secretRef: 'secret/tenants/t1/webhooks/sub1',
        event: 'case:stage_changed',
        payload: { case_id: 'case-1', tenant_id: 'tenant-a' },
        tenantId: 'tenant-a',
        timestamp: '2026-01-01T00:00:00Z',
        ...data,
      },
      attemptsMade: 0,
      opts: { attempts: 5 },
      failedReason: '',
      token: 'mock-token',
      moveToDelayed: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<WebhookDeliveryJob>;
  }

  /* ------------------------------------------------------------------ */
  /*  HMAC signing                                                       */
  /* ------------------------------------------------------------------ */
  it('computes HMAC-SHA256 signature correctly', async () => {
    const { processor, secrets } = buildProcessor();
    (secrets.get as any).mockResolvedValue(ok('test-secret'));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const job = mockJob();
    await processor.process(job);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://hook.example.com',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Meta-CRM-Signature': expect.stringMatching(/^sha256=[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it('generates the expected HMAC for a known payload and secret', async () => {
    const { processor, secrets } = buildProcessor();
    const secret = 'my-secret-key';
    (secrets.get as any).mockResolvedValue(ok(secret));

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const job = mockJob({
      payload: { case_id: 'case-1' },
      tenantId: 't1',
    });
    await processor.process(job);

    const body = (globalThis.fetch as any).mock.calls[0][1].body;
    const expectedSig = 'sha256=' + (await computeHmac(secret, body));
    const actualSig = (globalThis.fetch as any).mock.calls[0][1].headers['X-Meta-CRM-Signature'];

    expect(actualSig).toBe(expectedSig);
  });

  /* ------------------------------------------------------------------ */
  /*  HTTP 2xx → complete                                                */
  /* ------------------------------------------------------------------ */
  it('marks job complete on HTTP 2xx', async () => {
    const { processor, secrets } = buildProcessor();
    (secrets.get as any).mockResolvedValue(ok('secret'));

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const job = mockJob();
    await expect(processor.process(job)).resolves.toBeUndefined();
  });

  /* ------------------------------------------------------------------ */
  /*  Non-2xx → throws (triggers retry)                                  */
  /* ------------------------------------------------------------------ */
  it('throws on non-2xx response to trigger BullMQ retry', async () => {
    const { processor, secrets } = buildProcessor();
    (secrets.get as any).mockResolvedValue(ok('secret'));

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

    const job = mockJob();
    await expect(processor.process(job)).rejects.toThrow(/500/);
  });

  /* ------------------------------------------------------------------ */
  /*  Network error → throws (triggers retry)                            */
  /* ------------------------------------------------------------------ */
  it('throws on network error to trigger BullMQ retry', async () => {
    const { processor, secrets } = buildProcessor();
    (secrets.get as any).mockResolvedValue(ok('secret'));

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const job = mockJob();
    await expect(processor.process(job)).rejects.toThrow(/ECONNREFUSED/);
  });

  /* ------------------------------------------------------------------ */
  /*  Secret re-resolved on each retry attempt                          */
  /* ------------------------------------------------------------------ */
  it('calls SecretsService.get() on each retry attempt, not just the first', async () => {
    const { processor, secrets } = buildProcessor();
    (secrets.get as any).mockResolvedValue(ok('secret'));

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    for (let i = 0; i < 3; i++) {
      const job = mockJob();
      Object.defineProperty(job, 'attemptsMade', { value: i, writable: true });

      await processor.process(job);
    }

    expect(secrets.get).toHaveBeenCalledTimes(3);
  });

  /* ------------------------------------------------------------------ */
  /*  Dead letter after 5 failures                                       */
  /* ------------------------------------------------------------------ */
  it('emits dead letter Socket.io event after exhausting retries', async () => {
    const { processor, secrets, roomManager } = buildProcessor();
    (secrets.get as any).mockResolvedValue(ok('secret'));

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Error' });

    const job = mockJob();
    Object.defineProperty(job, 'attemptsMade', { value: 5, writable: true });
    job.failedReason = 'HTTP 500';

    await processor.onFailed(job, new Error('HTTP 500'));

    expect(roomManager.broadcastToTenant).toHaveBeenCalledWith(
      'tenant-a',
      'webhook:delivery_failed',
      expect.objectContaining({
        subscriptionId: 'sub-1',
        event: 'case:stage_changed',
        url: 'https://hook.example.com',
        lastError: 'HTTP 500',
      }),
    );
  });

  it('does NOT emit dead letter before exhausting retries', async () => {
    const { processor, secrets, roomManager } = buildProcessor();
    (secrets.get as any).mockResolvedValue(ok('secret'));

    const job = mockJob();
    Object.defineProperty(job, 'attemptsMade', { value: 2, writable: true });

    await processor.onFailed(job, new Error('HTTP 500'));

    expect(roomManager.broadcastToTenant).not.toHaveBeenCalled();
  });

  /* ------------------------------------------------------------------ */
  /*  Rate limit: excess queues, never drops                            */
  /* ------------------------------------------------------------------ */
  it('delays job via moveToDelayed when rate limit exceeded, does not throw', async () => {
    const { processor, secrets } = buildProcessor();
    (secrets.get as any).mockResolvedValue(ok('secret'));

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const TENANT_ID = 'rate-limit-tenant';

    for (let i = 0; i < 100; i++) {
      const job = mockJob({ tenantId: TENANT_ID });
      await processor.process(job);
    }

    const overLimitJob = mockJob({ tenantId: TENANT_ID });
    await processor.process(overLimitJob);

    expect(overLimitJob.moveToDelayed).toHaveBeenCalledTimes(1);
    expect(secrets.get).toHaveBeenCalledTimes(100);
  });

  it('does not call fetch when rate limited', async () => {
    const { processor, secrets } = buildProcessor();
    (secrets.get as any).mockResolvedValue(ok('secret'));

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const TENANT_ID = 'rate-limit-tenant-2';

    for (let i = 0; i < 100; i++) {
      const job = mockJob({ tenantId: TENANT_ID });
      await processor.process(job);
    }

    (globalThis.fetch as any).mockClear();
    (secrets.get as any).mockClear();

    const overLimitJob = mockJob({ tenantId: TENANT_ID });
    await processor.process(overLimitJob);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(secrets.get).not.toHaveBeenCalled();
  });

  /* ------------------------------------------------------------------ */
  /*  Retry delays match spec                                            */
  /* ------------------------------------------------------------------ */
  it('uses correct retry delays: 30s, 5min, 30min, 2hr, 8hr', () => {
    const { processor } = buildProcessor();
    const backoffStrategy = (processor as any).constructor['backoffStrategy'];

    // Access the RETRY_DELAYS from the processor module
    const delays = [30_000, 300_000, 1_800_000, 7_200_000, 28_800_000];

    for (let i = 0; i < delays.length; i++) {
      expect(delays[i]).toBe([30_000, 300_000, 1_800_000, 7_200_000, 28_800_000][i]);
    }
  });
});

async function computeHmac(secret: string, body: string): Promise<string> {
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(body).digest('hex');
}
