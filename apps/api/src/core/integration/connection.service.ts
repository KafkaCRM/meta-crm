import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { EncryptionService } from './encryption.service';

export type ConnectionErrorCode =
  | 'TENANT_NOT_FOUND'
  | 'PROVIDER_NOT_FOUND'
  | 'CONNECTION_NOT_FOUND'
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'NOT_CONNECTED'
  | 'INTERNAL';

export interface ConnectionError {
  code: ConnectionErrorCode;
  message?: string;
}

export interface ConnectionDto {
  id: string;
  tenant_id: string;
  provider: string;
  name: string;
  status: string;
  config_json: Record<string, unknown>;
  has_credentials: boolean;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionTestResult {
  connection_id: string;
  status: 'healthy' | 'error' | 'untested';
  message: string;
  last_tested_at: string;
}

export const INTEGRATION_MANIFESTS = [
  {
    id: 'integration/whatsapp',
    provider: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'WhatsApp Business API — send and receive messages, trigger automated follow-ups.',
    icon: 'MessageSquare',
    credential_fields: ['access_token', 'phone_number_id', 'whatsapp_business_account_id'],
  },
  {
    id: 'integration/facebook',
    provider: 'facebook',
    name: 'Facebook Lead Ads',
    description: 'Facebook Lead Ads webhook — auto-capture leads from Facebook ad campaigns.',
    icon: 'Share2',
    credential_fields: ['page_id'],
    oauth_supported: true,
  },
  {
    id: 'integration/justdial',
    provider: 'justdial',
    name: 'JustDial',
    description: 'JustDial API — automatically ingest leads from JustDial business listings.',
    icon: 'PhoneCall',
    credential_fields: ['api_key', 'client_id'],
  },
  {
    id: 'integration/email',
    provider: 'email',
    name: 'Email (SMTP)',
    description: 'SMTP integration — send transactional emails and system notifications.',
    icon: 'Mail',
    credential_fields: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass'],
  },
  {
    id: 'integration/zapier',
    provider: 'zapier',
    name: 'Zapier',
    description: 'Zapier Integration — sync cases, leads, and events with 5,000+ apps.',
    icon: 'Zap',
    credential_fields: [],
    url_generator: true,
  },
  {
    id: 'integration/google-calendar',
    provider: 'google-calendar',
    name: 'Google Calendar',
    description: 'Google Calendar Sync — automatically synchronize appointments with your Google Calendar.',
    icon: 'Calendar',
    credential_fields: ['client_id', 'client_secret', 'refresh_token'],
  },
  {
    id: 'integration/email-to-case',
    provider: 'email-to-case',
    name: 'Email-to-Case Router',
    description: 'Email-to-Case Router — monitor an IMAP mailbox and automatically convert incoming emails to cases.',
    icon: 'Inbox',
    credential_fields: ['imap_host', 'imap_port', 'imap_user', 'imap_pass'],
  },
  {
    id: 'integration/web-to-lead',
    provider: 'web-to-lead',
    name: 'Web-to-Lead',
    description: 'Web-to-Lead — accept leads from public web forms with source-key authentication.',
    icon: 'Link',
    credential_fields: [],
    url_generator: true,
  },
];

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly platformDb: PlatformPrismaService,
    private readonly cls: ClsService,
    private readonly encryption: EncryptionService,
  ) {}

  private getScope(): RequestScope | null {
    return this.cls.get<RequestScope>('scope') ?? null;
  }

  private getManifest(provider: string) {
    return INTEGRATION_MANIFESTS.find((m) => m.provider === provider);
  }

  // ═══════════════════════════════════════════════════════════════════
  // List
  // ═══════════════════════════════════════════════════════════════════

  async listConnections(): Promise<Result<ConnectionDto[], ConnectionError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const rows = await this.db.getClient().integrationConnection.findMany({
      where: { tenant_id: scope.tenant_id },
    });

    return ok(rows.map((r) => this.toDto(r)));
  }

  async getConnection(id: string): Promise<Result<ConnectionDto, ConnectionError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const row = await this.db.getClient().integrationConnection.findFirst({
      where: { id, tenant_id: scope.tenant_id },
    });

    if (!row) {
      return err({ code: 'CONNECTION_NOT_FOUND', message: `Connection ${id} not found` });
    }

    return ok(this.toDto(row));
  }

  async getConnectionByProvider(provider: string): Promise<Result<ConnectionDto, ConnectionError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const row = await this.db.getClient().integrationConnection.findFirst({
      where: { tenant_id: scope.tenant_id, provider },
      orderBy: { created_at: 'desc' },
    });

    if (!row) {
      return err({ code: 'CONNECTION_NOT_FOUND', message: `No connection for ${provider}` });
    }

    return ok(this.toDto(row));
  }

  // ═══════════════════════════════════════════════════════════════════
  // Connect
  // ═══════════════════════════════════════════════════════════════════

  async connect(
    provider: string,
    credentials: Record<string, string>,
    configJson: Record<string, unknown> = {},
  ): Promise<Result<ConnectionDto, ConnectionError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const manifest = this.getManifest(provider);
    if (!manifest) {
      return err({ code: 'PROVIDER_NOT_FOUND', message: `Unknown provider: ${provider}` });
    }

    const tenantId = scope.tenant_id;

    // Auto-generate URL token for URL generator providers (web-to-lead, zapier)
    if ((manifest as any).url_generator) {
      const urlToken = crypto.randomUUID();
      const mergedConfig = {
        ...configJson,
        url_token: urlToken,
      };

      const connection = await this.db.getClient().integrationConnection.create({
        data: {
          tenant_id: tenantId,
          provider,
          name: manifest.name,
          status: 'connected',
          config_json: mergedConfig as Prisma.InputJsonValue,
        },
      });

      // Auto-create default intake route with field mappings
      await this.db.getClient().integrationIntakeRoute.create({
        data: {
          connection_id: connection.id,
          priority: 1,
          conditions: Prisma.JsonNull,
          mode: 'create_lead',
          assignment_rule: { type: 'fixed' } as Prisma.InputJsonValue,
          duplicate_strategy: 'skip',
          duplicate_match_fields: ['email', 'phone'] as Prisma.InputJsonValue,
          owner_id: null,
          campaign_id: null,
          fieldMappings: {
            createMany: {
              data: [
                { source_field: 'name', target_entity: 'lead', target_field: 'name', transform: 'direct', is_required: true },
                { source_field: 'email', target_entity: 'lead', target_field: 'email', transform: 'direct', is_required: false },
                { source_field: 'phone', target_entity: 'lead', target_field: 'phone', transform: 'direct', is_required: false },
              ],
            },
          },
        },
      });

      this.logger.log(`Tenant ${tenantId} connected ${provider} (url_token generated, default route created)`);
      return ok(this.toDto(connection));
    }

    let cipherText: string | null = null;
    let iv: string | null = null;
    let tag: string | null = null;

    if (credentials && Object.keys(credentials).length > 0) {
      const credPayload = JSON.stringify(credentials);
      const encResult = this.encryption.encrypt(credPayload);
      if (encResult.isErr()) {
        return err({ code: 'ENCRYPTION_FAILED', message: encResult.error.message });
      }
      cipherText = encResult.value.cipher_text;
      iv = encResult.value.iv;
      tag = encResult.value.tag;
    }

    const connection = await this.db.getClient().integrationConnection.create({
      data: {
        tenant_id: tenantId,
        provider,
        name: manifest.name,
        status: 'connected',
        config_json: configJson as Prisma.InputJsonValue,
        credentials_cipher_text: cipherText,
        credentials_iv: iv,
        credentials_tag: tag,
      },
    });

    this.logger.log(`Tenant ${tenantId} connected ${provider}`);

    return ok(this.toDto(connection));
  }

  /**
   * Find a connection by its URL token (used by URL generator providers).
   */
  async findByUrlToken(provider: string, token: string): Promise<ConnectionDto | null> {
    const connections = await this.platformDb.client.integrationConnection.findMany({
      where: { provider, status: 'connected' },
    });

    for (const conn of connections) {
      const config = (conn.config_json as Record<string, unknown>) ?? {};
      if (config['url_token'] === token) {
        return this.toDto(conn);
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Disconnect
  // ═══════════════════════════════════════════════════════════════════

  async disconnect(id: string): Promise<Result<{ message: string }, ConnectionError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const connection = await this.db.getClient().integrationConnection.findFirst({
      where: { id, tenant_id: scope.tenant_id },
    });

    if (!connection) {
      return err({ code: 'CONNECTION_NOT_FOUND', message: `Connection ${id} not found` });
    }

    await this.db.getClient().integrationConnection.deleteMany({
      where: { id, provider: connection.provider },
    });

    this.logger.log(`Tenant ${scope.tenant_id} deleted connection ${connection.provider} (${id})`);

    return ok({ message: `${connection.name} deleted` });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Credentials
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  // Credentials (scope-free — for adapters that run outside request context)
  // ═══════════════════════════════════════════════════════════════════

  async getDecryptedCredentialsByProvider(
    tenantId: string,
    provider: string,
  ): Promise<Result<Record<string, string>, ConnectionError>> {
    const connection = await this.platformDb.client.integrationConnection.findFirst({
      where: { tenant_id: tenantId, provider },
    });

    if (!connection) {
      return err({ code: 'CONNECTION_NOT_FOUND', message: `No connection for ${provider} in tenant ${tenantId}` });
    }

    if (!connection.credentials_cipher_text || !connection.credentials_iv || !connection.credentials_tag) {
      return err({ code: 'NOT_CONNECTED', message: 'No credentials stored' });
    }

    const decryptResult = this.encryption.decrypt(
      connection.credentials_cipher_text,
      connection.credentials_iv,
      connection.credentials_tag,
    );

    if (decryptResult.isErr()) {
      return err({ code: 'DECRYPTION_FAILED', message: decryptResult.error.message });
    }

    try {
      return ok(JSON.parse(decryptResult.value) as Record<string, string>);
    } catch {
      return err({ code: 'DECRYPTION_FAILED', message: 'Credential payload is not valid JSON' });
    }
  }

  async getDecryptedCredentials(
    connectionId: string,
  ): Promise<Result<Record<string, string>, ConnectionError>> {
    const connection = await this.db.getClient().integrationConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return err({ code: 'CONNECTION_NOT_FOUND', message: `Connection ${connectionId} not found` });
    }

    if (!connection.credentials_cipher_text || !connection.credentials_iv || !connection.credentials_tag) {
      return err({ code: 'NOT_CONNECTED', message: 'No credentials stored' });
    }

    const decryptResult = this.encryption.decrypt(
      connection.credentials_cipher_text,
      connection.credentials_iv,
      connection.credentials_tag,
    );

    if (decryptResult.isErr()) {
      return err({ code: 'DECRYPTION_FAILED', message: decryptResult.error.message });
    }

    try {
      return ok(JSON.parse(decryptResult.value) as Record<string, string>);
    } catch {
      return err({ code: 'DECRYPTION_FAILED', message: 'Credential payload is not valid JSON' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Tenant Resolution (for webhooks)
  // ═══════════════════════════════════════════════════════════════════

  async resolveTenantForProvider(
    provider: string,
    matchConfig: Record<string, unknown>,
  ): Promise<string | null> {
    const connections = await this.platformDb.client.integrationConnection.findMany({
      where: { provider, status: 'connected' },
    });

    for (const conn of connections) {
      const config = conn.config_json as Record<string, unknown>;
      let isMatch = true;
      for (const [key, value] of Object.entries(matchConfig)) {
        if (config[key] !== value) {
          isMatch = false;
          break;
        }
      }
      if (isMatch) return conn.tenant_id;
    }

    return null;
  }

  async resolveTenantFromSlug(slug: string): Promise<string | null> {
    const tenant = await this.platformDb.client.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    return tenant?.id ?? null;
  }

  async findConnectionId(tenantId: string, provider: string): Promise<string | null> {
    const connection = await this.platformDb.client.integrationConnection.findFirst({
      where: { tenant_id: tenantId, provider },
      select: { id: true },
    });
    return connection?.id ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Test Connection
  // ═══════════════════════════════════════════════════════════════════

  async testConnection(id: string): Promise<Result<ConnectionTestResult, ConnectionError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const connection = await this.db.getClient().integrationConnection.findFirst({
      where: { id, tenant_id: scope.tenant_id },
    });

    if (!connection) {
      return err({ code: 'CONNECTION_NOT_FOUND', message: `Connection ${id} not found` });
    }

    if (connection.status !== 'connected') {
      return err({ code: 'NOT_CONNECTED', message: `${connection.name} is disconnected` });
    }

    const checkedAt = new Date().toISOString();

    const manifest = this.getManifest(connection.provider);
    if (!manifest) {
      return err({ code: 'PROVIDER_NOT_FOUND', message: `Unknown provider: ${connection.provider}` });
    }

    // Validate required credential fields are present
    const credsResult = await this.getDecryptedCredentials(id);
    if (credsResult.isErr()) {
      return ok({
        connection_id: id,
        status: 'error',
        message: `Cannot test: ${credsResult.error.message}`,
        last_tested_at: checkedAt,
      });
    }

    const creds = credsResult.value;

    if (!(manifest as any).oauth_supported) {
      const missingFields = manifest.credential_fields.filter((f) => !creds[f]?.trim());
      if (missingFields.length > 0) {
        const result: ConnectionTestResult = {
          connection_id: id,
          status: 'error',
          message: `Missing required credentials: ${missingFields.join(', ')}`,
          last_tested_at: checkedAt,
        };
        await this.saveTestResult(id, result);
        return ok(result);
      }
    }

    // Provider-specific real connectivity test
    let testResult: ConnectionTestResult;

    try {
      switch (connection.provider) {
        case 'facebook':
          testResult = await this.testFacebook(creds, id);
          break;
        case 'whatsapp':
          testResult = await this.testWhatsApp(creds, id);
          break;
        case 'email':
          testResult = this.testSmtp(creds, id);
          break;
        case 'zapier':
          testResult = await this.testZapier(creds, id);
          break;
        default:
          testResult = {
            connection_id: id,
            status: 'healthy',
            message: `${manifest.name} has the required credentials. Provider connectivity not verified.`,
            last_tested_at: checkedAt,
          };
      }
    } catch (e) {
      testResult = {
        connection_id: id,
        status: 'error',
        message: `Connection test failed: ${(e as Error).message}`,
        last_tested_at: checkedAt,
      };
    }

    await this.saveTestResult(id, testResult);
    return ok(testResult);
  }

  private async testFacebook(
    creds: Record<string, string>,
    connectionId: string,
  ): Promise<ConnectionTestResult> {
    const checkedAt = new Date().toISOString();
    const response = await fetch(
      `https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(creds.access_token ?? '')}`,
      { signal: AbortSignal.timeout(10000) },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        connection_id: connectionId,
        status: 'error',
        message: `Facebook API error (${response.status}): ${body.substring(0, 200)}`,
        last_tested_at: checkedAt,
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const pageId = creds.page_id;

    if (pageId && data.id !== pageId) {
      return {
        connection_id: connectionId,
        status: 'error',
        message: `Access token belongs to page ${data.id}, but configured page is ${pageId}`,
        last_tested_at: checkedAt,
      };
    }

    return {
      connection_id: connectionId,
      status: 'healthy',
      message: `Successfully connected to Facebook page "${data.name || 'Unknown'}"`,
      last_tested_at: checkedAt,
    };
  }

  private async testWhatsApp(
    creds: Record<string, string>,
    connectionId: string,
  ): Promise<ConnectionTestResult> {
    const checkedAt = new Date().toISOString();
    const token = creds.api_key ?? creds.access_token ?? '';
    const phoneNumberId = creds.phone_number_id ?? '';

    if (!token) {
      return {
        connection_id: connectionId,
        status: 'error',
        message: 'No API token configured for WhatsApp',
        last_tested_at: checkedAt,
      };
    }

    if (!phoneNumberId) {
      return {
        connection_id: connectionId,
        status: 'error',
        message: 'No phone number ID configured for WhatsApp',
        last_tested_at: checkedAt,
      };
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=id,name,display_phone_number&access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(10000) },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return {
          connection_id: connectionId,
          status: 'error',
          message: `WhatsApp API error (${response.status}): ${body.substring(0, 200)}`,
          last_tested_at: checkedAt,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        connection_id: connectionId,
        status: 'healthy',
        message: `Connected to WhatsApp Business number: ${data['display_phone_number'] || data['name'] || 'Unknown'}`,
        last_tested_at: checkedAt,
      };
    } catch (e) {
      return {
        connection_id: connectionId,
        status: 'error',
        message: `WhatsApp connection test failed: ${(e as Error).message}`,
        last_tested_at: checkedAt,
      };
    }
  }

  private testSmtp(
    _creds: Record<string, string>,
    connectionId: string,
  ): ConnectionTestResult {
    const checkedAt = new Date().toISOString();
    return {
      connection_id: connectionId,
      status: 'healthy',
      message: 'SMTP credentials are configured. Inline connectivity tested on first send.',
      last_tested_at: checkedAt,
    };
  }

  private async testZapier(
    _creds: Record<string, string>,
    connectionId: string,
  ): Promise<ConnectionTestResult> {
    const checkedAt = new Date().toISOString();
    return {
      connection_id: connectionId,
      status: 'healthy',
      message: 'Zapier webhook URL is configured. Events will be dispatched on next trigger.',
      last_tested_at: checkedAt,
    };
  }

  private async saveTestResult(id: string, result: ConnectionTestResult) {
    const connection = await this.db.getClient().integrationConnection.findUnique({ where: { id } });
    if (!connection) return;

    const existingConfig = (connection.config_json as Record<string, unknown>) ?? {};
    await this.db.getClient().integrationConnection.update({
      where: { id },
      data: {
        last_tested_at: new Date(),
        config_json: {
          ...existingConfig,
          health: result,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════

  private toDto(row: any): ConnectionDto {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      provider: row.provider,
      name: row.name,
      status: row.status,
      config_json: (row.config_json as Record<string, unknown>) ?? {},
      has_credentials: !!(row.credentials_cipher_text && row.credentials_iv && row.credentials_tag),
      last_tested_at: row.last_tested_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
