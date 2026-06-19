import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { MessagingAdapter } from '../../core/communication/messaging-adapter.interface';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

const ENROLLMENT_CAPABILITY_KEY = 'capability/academics';

@Injectable()
export class EnrollmentTriggersService implements OnModuleInit {
  private readonly logger = new Logger(EnrollmentTriggersService.name);
  private capabilityCache = new Map<string, boolean>();

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    @Inject('MESSAGING_ADAPTER') private readonly messagingAdapter: MessagingAdapter,
  ) {}

  onModuleInit() {
    this.logger.log('Enrollment triggers loaded');
  }

  @OnEvent('lead:stage_changed')
  async handleStageChanged(payload: {
    lead_id: string;
    from_stage: string;
    to_stage: string;
    tenant_id?: string;
    actor_id?: string;
  }): Promise<void> {
    const scope = this.cls.get<RequestScope>('scope');
    const tenantId = payload.tenant_id ?? scope?.tenant_id;
    if (!tenantId) return;

    const hasCapability = await this.checkCapability(tenantId);
    if (!hasCapability) return;

    const leadRecord = await this.db.getClient().lead.findUnique({
      where: { id: payload.lead_id },
      include: { party: true },
    });

    if (!leadRecord || !leadRecord.party_id) return;

    const toStageName = await this.getStageName(payload.to_stage);
    if (toStageName !== 'Fee Paid') return;

    const confirmationMessage = this.buildConfirmationMessage(leadRecord);

    const phone = leadRecord.party?.phone_normalized;
    if (!phone) {
      this.logger.warn(`No phone for enrollment lead ${leadRecord.id}`);
      return;
    }

    await this.messagingAdapter.send({
      to: phone,
      message: confirmationMessage,
      tenant_id: tenantId,
      metadata: {
        lead_id: leadRecord.id,
        type: 'enrollment_confirmation',
      },
    });

    await this.db.getClient().interaction.create({
      data: {
        tenant_id: tenantId,
        party_id: leadRecord.party_id,
        channel: 'whatsapp',
        direction: 'outbound',
        content: confirmationMessage,
      },
    });

    this.logger.log(`Enrollment confirmation sent for lead ${leadRecord.id}`);
  }

  private async checkCapability(tenantId: string): Promise<boolean> {
    if (this.capabilityCache.has(tenantId)) {
      return this.capabilityCache.get(tenantId)!;
    }

    const tenant = await this.db.getClient().tenant.findFirst({
      where: { id: tenantId },
    });

    if (!tenant) {
      this.capabilityCache.set(tenantId, false);
      return false;
    }

    const config = (tenant.config_json ?? {}) as Record<string, any>;
    const enabledCapabilities = Array.isArray(config.enabled_capabilities)
      ? (config.enabled_capabilities as string[])
      : [];

    const enabled = enabledCapabilities.includes(ENROLLMENT_CAPABILITY_KEY);
    this.capabilityCache.set(tenantId, enabled);
    return enabled;
  }

  private async getStageName(stageId: string): Promise<string | null> {
    const stage = await this.db.getClient().pipelineStage.findUnique({
      where: { id: stageId },
    });
    return stage?.name ?? null;
  }

  private buildConfirmationMessage(leadRecord: any): string {
    const attrs = leadRecord.attributes ?? {};
    const courseName = (attrs as Record<string, unknown>)['course_name'] as string ?? 'your course';
    return `Your enrollment for ${courseName} has been confirmed. Fee payment received. We will contact you with further details.`;
  }
}
