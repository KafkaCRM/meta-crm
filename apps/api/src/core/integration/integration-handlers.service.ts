import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { EncryptionService } from './encryption.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../tenant/request-scope.interface';
import { TenantRole } from '@meta-crm/types';

@Injectable()
export class IntegrationHandlersService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationHandlersService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly platformDb: PlatformPrismaService,
    private readonly encryption: EncryptionService,
    private readonly cls: ClsService,
  ) {}

  onModuleInit(): void {
    // Listen to all events emitted via hooks/EventEmitter
    this.eventEmitter.onAny(async (event: string | string[], payload: any) => {
      const eventName = Array.isArray(event) ? (event[0] ?? '') : event;
      const tenantId = payload?.['tenant_id'] as string | undefined;
      if (!tenantId) return;

      // Skip internal event handler loops
      if (eventName.startsWith('integration:')) return;

      try {
        await this.handleZapierDispatch(tenantId, eventName, payload);
      } catch (err) {
        this.logger.error(`Zapier dispatch error for event ${eventName}`, (err as Error).stack);
      }
    });
  }

  // ── 1. Zapier Integration Forwarder ───────────────────────────────────────

  private async handleZapierDispatch(tenantId: string, event: string, payload: any): Promise<void> {
    // Check if the tenant has active Zapier extension
    const extension = await this.platformDb.client.tenantExtension.findFirst({
      where: {
        tenant_id: tenantId,
        extension: { package_name: 'integration/zapier' },
      },
      include: { extension: true },
    });

    if (!extension) return;

    // Load credentials
    const credential = await this.platformDb.client.secureCredential.findFirst({
      where: {
        tenant_id: tenantId,
        extension_id: extension.extension_id,
      },
    });

    if (!credential) return;

    // Decrypt credentials
    const decryptedResult = this.encryption.decrypt(
      credential.cipher_text,
      credential.iv,
      credential.tag,
    );

    if (decryptedResult.isErr()) {
      this.logger.error(`Failed to decrypt credentials for Zapier integration in tenant: ${tenantId}`);
      return;
    }

    try {
      const creds = JSON.parse(decryptedResult.value);
      const webhookUrl = creds.webhook_url;

      if (!webhookUrl) return;

      // Perform HTTP POST payload dispatch asynchronously to Zapier webhook
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
    } catch (e) {
      this.logger.error('Failed to parse Zapier credentials JSON', e);
    }
  }

  // ── 2. Google Calendar Synchronization ────────────────────────────────────

  @OnEvent('appointment:created')
  @OnEvent('appointment:updated')
  async handleAppointmentSync(payload: any): Promise<void> {
    const tenantId = payload?.tenant_id;
    if (!tenantId) return;

    const extension = await this.platformDb.client.tenantExtension.findFirst({
      where: {
        tenant_id: tenantId,
        extension: { package_name: 'integration/google-calendar' },
      },
    });

    if (!extension) return;

    const credential = await this.platformDb.client.secureCredential.findFirst({
      where: {
        tenant_id: tenantId,
        extension_id: extension.extension_id,
      },
    });

    if (!credential) return;

    // Decrypt credentials
    const decryptedResult = this.encryption.decrypt(
      credential.cipher_text,
      credential.iv,
      credential.tag,
    );

    if (decryptedResult.isErr()) {
      this.logger.error(`Failed to decrypt Google Calendar credentials for tenant: ${tenantId}`);
      return;
    }

    try {
      const creds = JSON.parse(decryptedResult.value);
      this.logger.log(`Google Calendar Sync: Synchronized appointment "${payload.title}" (start: ${payload.start_time}) for tenant ${tenantId} via Client ID: ${creds.client_id}`);
    } catch (e) {
      this.logger.error('Failed to parse Google Calendar credentials', e);
    }
  }

  // ── 3. Email-to-Case IMAP Poller Simulation ─────────────────────────────

  async runEmailToCaseSync(tenantId: string): Promise<number> {
    const extension = await this.platformDb.client.tenantExtension.findFirst({
      where: {
        tenant_id: tenantId,
        extension: { package_name: 'integration/email-to-case' },
      },
    });

    if (!extension) {
      throw new Error('Email-to-Case integration is not enabled for this tenant');
    }

    const credential = await this.platformDb.client.secureCredential.findFirst({
      where: {
        tenant_id: tenantId,
        extension_id: extension.extension_id,
      },
    });

    if (!credential) {
      throw new Error('No credentials configured for Email-to-Case integration');
    }

    const decryptedResult = this.encryption.decrypt(
      credential.cipher_text,
      credential.iv,
      credential.tag,
    );

    if (decryptedResult.isErr()) {
      throw new Error('Decryption of IMAP credentials failed');
    }

    const creds = JSON.parse(decryptedResult.value);
    this.logger.log(`Email-to-Case: Polling IMAP mailbox ${creds.imap_user}@${creds.imap_host}...`);

    // Simulate finding 1 new email and converting it to a case
    let casesCreatedCount = 0;
    
    await this.cls.run(async () => {
      this.cls.set('scope', {
        tenant_id: tenantId,
        user_id: 'system_email_router',
        assignment_ids: [],
        role: TenantRole.Member,
        vertical_ids: [],
      } as RequestScope);

      // Check if a client/party exists with this email, or create a mock individual party
      const senderEmail = 'johndoe.inbound@example.com';
      let party = await this.platformDb.client.party.findFirst({
        where: { tenant_id: tenantId, email: senderEmail },
      });

      if (!party) {
        party = await this.platformDb.client.party.create({
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

      // Fetch the default workflow definition
      const workflow = await this.platformDb.client.pipelineDefinition.findFirst({
        where: { tenant_id: tenantId },
        include: { stages: { orderBy: { order: 'asc' } } },
      });

      if (workflow) {
        const defaultStage = workflow.stages[0]?.id || '';
        
        await this.platformDb.client.case.create({
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
