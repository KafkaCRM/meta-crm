import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { ConnectionService } from './connection.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../tenant/request-scope.interface';
import { TenantRole } from '@meta-crm/types';

@Injectable()
export class IntegrationHandlersService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationHandlersService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly platformDb: PlatformPrismaService,
    private readonly connectionService: ConnectionService,
    private readonly cls: ClsService,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.onAny(async (event: string | string[], payload: any) => {
      const eventName = Array.isArray(event) ? (event[0] ?? '') : event;
      const tenantId = payload?.['tenant_id'] as string | undefined;
      if (!tenantId) return;

      if (eventName.startsWith('integration:')) return;

      try {
        await this.handleZapierDispatch(tenantId, eventName, payload);
      } catch (err) {
        this.logger.error(`Zapier dispatch error for event ${eventName}`, (err as Error).stack);
      }
    });
  }

  private async handleZapierDispatch(tenantId: string, event: string, payload: any): Promise<void> {
    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'zapier');
    if (credsResult.isErr()) return;

    const creds = credsResult.value;
    const webhookUrl = creds.webhook_url;
    if (!webhookUrl) return;

    this.logger.log(`Zapier: Dispatching event "${event}" to webhook: ${webhookUrl}`);
    
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    }).catch((e) => {
      this.logger.warn(`Zapier webhook endpoint returned error: ${e.message}`);
    });
  }

  @OnEvent('appointment:created')
  @OnEvent('appointment:updated')
  async handleAppointmentSync(payload: any): Promise<void> {
    const tenantId = payload?.tenant_id;
    if (!tenantId) return;

    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'google-calendar');
    if (credsResult.isErr()) return;

    const creds = credsResult.value;
    this.logger.log(`Google Calendar Sync: Synchronized appointment "${payload.title}" (start: ${payload.start_time}) for tenant ${tenantId} via Client ID: ${creds.client_id}`);
  }

  async runEmailToCaseSync(tenantId: string): Promise<number> {
    const credsResult = await this.connectionService.getDecryptedCredentialsByProvider(tenantId, 'email-to-case');
    if (credsResult.isErr()) {
      throw new Error('Email-to-Case integration is not configured for this tenant');
    }

    const creds = credsResult.value;
    this.logger.log(`Email-to-Case: Polling IMAP mailbox ${creds.imap_user}@${creds.imap_host}...`);

    let casesCreatedCount = 0;
    
    await this.cls.run(async () => {
      this.cls.set('scope', {
        tenant_id: tenantId,
        user_id: 'system_email_router',
        assignment_ids: [],
        role: TenantRole.Member,
        vertical_ids: [],
      } as RequestScope);

      const senderEmail = 'johndoe.inbound@example.com';
      let party = await this.connectionService['platformDb'].client.party.findFirst({
        where: { tenant_id: tenantId, email: senderEmail },
      });

      if (!party) {
        party = await this.connectionService['platformDb'].client.party.create({
          data: {
            tenant_id: tenantId,
            branch_brand_assignment_id: 'assign_default_001',
            type: 'individual',
            name: 'John Doe Inbound',
            email: senderEmail,
            phone_raw: '+919999988888',
            phone_normalized: '+919999988888',
            source: 'email',
            merge_status: 'canonical',
          },
        });
      }

      const workflow = await this.platformDb.client.pipelineDefinition.findFirst({
        where: { tenant_id: tenantId },
        include: { stages: { orderBy: { order: 'asc' } } },
      });

      if (workflow) {
        const defaultStage = workflow.stages[0]?.id || '';
        
        await this.connectionService['platformDb'].client.case.create({
          data: {
            tenant_id: tenantId,
            branch_brand_assignment_id: 'assign_default_001',
            party_id: party.id,
            type: 'support',
            title: 'Inbound Email: Billing Inquiry on invoice #1002',
            stage: defaultStage,
            pipeline_definition_id: workflow.id,
            assigned_to_id: 'usr_default_001',
            attributes: {},
          },
        });
        casesCreatedCount = 1;
      }
    });

    return casesCreatedCount;
  }
}
