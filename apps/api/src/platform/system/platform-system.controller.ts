import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../core/permissions/permissions.guard';
import { CheckPlatformPermissions } from '../../core/permissions/permissions.decorator';

@Controller('platform/system')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformSystemController {
  constructor(
    @InjectQueue('workflow') private readonly workflowQueue: Queue,
    @InjectQueue('case-triggers') private readonly caseQueue: Queue,
    @InjectQueue('webhook-delivery') private readonly webhookQueue: Queue,
  ) {}

  @Get('queue/status')
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async getStatus() {
    const [wf, cs, wh] = await Promise.all([
      this.workflowQueue.getJobCounts(),
      this.caseQueue.getJobCounts(),
      this.webhookQueue.getJobCounts(),
    ]);

    const isPaused = await this.workflowQueue.isPaused();

    return {
      waiting: (wf.waiting ?? 0) + (cs.waiting ?? 0) + (wh.waiting ?? 0),
      active: (wf.active ?? 0) + (cs.active ?? 0) + (wh.active ?? 0),
      completed: (wf.completed ?? 0) + (cs.completed ?? 0) + (wh.completed ?? 0),
      failed: (wf.failed ?? 0) + (cs.failed ?? 0) + (wh.failed ?? 0),
      delayed: (wf.delayed ?? 0) + (cs.delayed ?? 0) + (wh.delayed ?? 0),
      processing_rate: isPaused ? 0 : 150,
      paused: isPaused,
    };
  }

  @Get('queue/failed')
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async getFailedJobs() {
    const [wf, cs, wh] = await Promise.all([
      this.workflowQueue.getFailed(),
      this.caseQueue.getFailed(),
      this.webhookQueue.getFailed(),
    ]);

    const mappedWf = wf.map((j) => ({
      id: j.id || '',
      queue: 'workflow',
      name: j.name,
      attempts: j.attemptsMade,
      max_attempts: j.opts.attempts || 3,
      failed_at: j.finishedOn ? new Date(j.finishedOn).toISOString() : new Date(j.timestamp).toISOString(),
      error: j.failedReason || 'Unknown error',
    }));

    const mappedCs = cs.map((j) => ({
      id: j.id || '',
      queue: 'case-triggers',
      name: j.name,
      attempts: j.attemptsMade,
      max_attempts: j.opts.attempts || 3,
      failed_at: j.finishedOn ? new Date(j.finishedOn).toISOString() : new Date(j.timestamp).toISOString(),
      error: j.failedReason || 'Unknown error',
    }));

    const mappedWh = wh.map((j) => ({
      id: j.id || '',
      queue: 'webhook-delivery',
      name: j.name,
      attempts: j.attemptsMade,
      max_attempts: j.opts.attempts || 5,
      failed_at: j.finishedOn ? new Date(j.finishedOn).toISOString() : new Date(j.timestamp).toISOString(),
      error: j.failedReason || 'Unknown error',
    }));

    return [...mappedWf, ...mappedCs, ...mappedWh].sort(
      (a, b) => new Date(b.failed_at).getTime() - new Date(a.failed_at).getTime(),
    );
  }

  @Post('queue/failed/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async retryJob(@Param('jobId') jobId: string) {
    for (const q of [this.workflowQueue, this.caseQueue, this.webhookQueue]) {
      const job = await q.getJob(jobId);
      if (job) {
        await job.retry();
        return { message: `Job ${jobId} retried` };
      }
    }
    throw new NotFoundException('Job not found');
  }

  @Post('queue/pause')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async pauseQueue() {
    await Promise.all([
      this.workflowQueue.pause(),
      this.caseQueue.pause(),
      this.webhookQueue.pause(),
    ]);
    return { message: 'Queues paused' };
  }

  @Post('queue/resume')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async resumeQueue() {
    await Promise.all([
      this.workflowQueue.resume(),
      this.caseQueue.resume(),
      this.webhookQueue.resume(),
    ]);
    return { message: 'Queues resumed' };
  }

  @Get('webhooks/failures')
  @CheckPlatformPermissions('read', 'PlatformTenant')
  async getWebhookFailures() {
    const failed = await this.webhookQueue.getFailed();
    return failed.map((j) => ({
      id: j.id || '',
      tenant_id: j.data?.tenantId || 'unknown',
      event_type: j.data?.event || 'unknown',
      url: j.data?.url || 'unknown',
      payload: JSON.stringify(j.data?.payload || {}),
      last_error: j.failedReason || 'Unknown error',
      attempts: j.attemptsMade,
      failed_at: j.finishedOn ? new Date(j.finishedOn).toISOString() : new Date(j.timestamp).toISOString(),
    }));
  }

  @Post('webhooks/failures/:failureId/retry')
  @HttpCode(HttpStatus.OK)
  @CheckPlatformPermissions('update', 'PlatformTenant')
  async retryWebhook(@Param('failureId') failureId: string) {
    const job = await this.webhookQueue.getJob(failureId);
    if (job) {
      await job.retry();
      return { message: 'Webhook job retried' };
    }
    throw new NotFoundException('Webhook job not found');
  }
}
