import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { EncryptionService } from './encryption.service';

// ─── Error Types ─────────────────────────────────────────────────────────────

export type IntegrationErrorCode =
  | 'TENANT_NOT_FOUND'
  | 'PROVIDER_NOT_FOUND'
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'NOT_CONNECTED'
  | 'INTERNAL';

export interface IntegrationError {
  code: IntegrationErrorCode;
  message?: string;
}

// ─── Provider Manifest ────────────────────────────────────────────────────────

/**
 * Static manifest describing every integration the platform supports.
 * These are the source of truth for what fields the frontend should render
 * and how credentials are keyed in SecureCredential.
 */
export interface IntegrationManifest {
  id: string;          // e.g. 'integration/whatsapp'
  provider: string;    // e.g. 'whatsapp'
  name: string;
  description: string;
  icon: string;        // lucide icon name hint
  credential_fields: string[];  // field keys to collect from the user
}

export const INTEGRATION_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'integration/whatsapp',
    provider: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'WhatsApp Business API — send and receive messages, trigger automated follow-ups.',
    icon: 'MessageSquare',
    credential_fields: ['api_key', 'phone_number_id'],
  },
  {
    id: 'integration/facebook',
    provider: 'facebook',
    name: 'Facebook Lead Ads',
    description: 'Facebook Lead Ads webhook — auto-capture leads from Facebook ad campaigns.',
    icon: 'Share2',
    credential_fields: ['access_token', 'page_id'],
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
];

// ─── Response Shapes ──────────────────────────────────────────────────────────

export interface IntegrationDto {
  id: string;
  provider: string;
  name: string;
  description: string;
  icon: string;
  credential_fields: string[];
  status: 'connected' | 'disconnected' | 'error';
  has_credentials: boolean;
  configured_at?: string;
  config_json: Record<string, unknown>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly encryption: EncryptionService,
  ) {}

  private getScope(): RequestScope | null {
    return this.cls.get<RequestScope>('scope') ?? null;
  }

  // ── List all integrations with their per-tenant connection status ────────

  async listIntegrations(): Promise<Result<IntegrationDto[], IntegrationError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    // Load per-tenant IntegrationConfig rows
    const configs = await this.db.getClient().integrationConfig.findMany({
      where: { tenant_id: scope.tenant_id },
    });

    // Load per-tenant TenantExtension rows for integrations
    const extensions = await this.db.getClient().tenantExtension.findMany({
      where: { tenant_id: scope.tenant_id },
      include: { extension: true },
    });

    // Load SecureCredential presence (don't decrypt, just check existence)
    const credentials = await this.db.getClient().secureCredential.findMany({
      where: { tenant_id: scope.tenant_id },
      select: { extension_id: true, updated_at: true },
    });

    const result: IntegrationDto[] = INTEGRATION_MANIFESTS.map((manifest) => {
      const config = configs.find((c) => c.provider === manifest.provider);
      const extension = extensions.find((e) => e.extension?.package_name === manifest.id);
      const credential = credentials.find((c) => c.extension_id === extension?.extension_id);

      return {
        id: manifest.id,
        provider: manifest.provider,
        name: manifest.name,
        description: manifest.description,
        icon: manifest.icon,
        credential_fields: manifest.credential_fields,
        status: config?.enabled ? 'connected' : 'disconnected',
        has_credentials: !!credential,
        configured_at: credential?.updated_at?.toISOString(),
        config_json: (config?.config_json as Record<string, unknown>) ?? {},
      };
    });

    return ok(result);
  }

  // ── Configure (connect) an integration ────────────────────────────────────

  async configure(
    provider: string,
    credentials: Record<string, string>,
    configJson: Record<string, unknown> = {},
  ): Promise<Result<IntegrationDto, IntegrationError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const manifest = INTEGRATION_MANIFESTS.find((m) => m.provider === provider);
    if (!manifest) {
      return err({ code: 'PROVIDER_NOT_FOUND', message: `Unknown integration provider: ${provider}` });
    }

    const tenantId = scope.tenant_id;

    // 1. Encrypt credentials payload as a single JSON blob
    const credPayload = JSON.stringify(credentials);
    const encResult = this.encryption.encrypt(credPayload);
    if (encResult.isErr()) {
      return err({ code: 'ENCRYPTION_FAILED', message: encResult.error.message });
    }
    const { cipher_text, iv, tag } = encResult.value;

    // 2. Ensure ExtensionRegistry entry exists for this integration
    const extensionRegistry = await this.db.getClient().extensionRegistry.upsert({
      where: { package_name: manifest.id },
      create: {
        type: 'integration',
        package_name: manifest.id,
        version: '1.0.0',
        manifest: {
          name: manifest.name,
          description: manifest.description,
          provider: manifest.provider,
          credential_fields: manifest.credential_fields,
        },
        status: 'active',
      },
      update: {}, // don't overwrite if exists
    });

    // 3. Upsert TenantExtension row (marks integration as enabled)
    await this.db.getClient().tenantExtension.upsert({
      where: { tenant_id_extension_id: { tenant_id: tenantId, extension_id: extensionRegistry.id } },
      create: {
        tenant_id: tenantId,
        extension_id: extensionRegistry.id,
        enabled: true,
        config_json: configJson as Prisma.InputJsonValue,
      },
      update: {
        enabled: true,
        config_json: configJson as Prisma.InputJsonValue,
      },
    });

    // 4. Upsert SecureCredential (encrypted API keys)
    await this.db.getClient().secureCredential.upsert({
      where: { tenant_id_extension_id: { tenant_id: tenantId, extension_id: extensionRegistry.id } },
      create: {
        tenant_id: tenantId,
        extension_id: extensionRegistry.id,
        cipher_text,
        iv,
        tag,
      },
      update: {
        cipher_text,
        iv,
        tag,
      },
    });

    // 5. Upsert IntegrationConfig (legacy table — kept for backward compat)
    await this.db.getClient().integrationConfig.upsert({
      where: { tenant_id_provider: { tenant_id: tenantId, provider } },
      create: {
        tenant_id: tenantId,
        provider,
        config_json: configJson as Prisma.InputJsonValue,
        credentials_ref: { extension_id: extensionRegistry.id } as Prisma.InputJsonValue,
        enabled: true,
      },
      update: {
        config_json: configJson as Prisma.InputJsonValue,
        credentials_ref: { extension_id: extensionRegistry.id } as Prisma.InputJsonValue,
        enabled: true,
      },
    });

    this.logger.log(`Tenant ${tenantId} configured integration: ${manifest.id}`);

    return ok({
      id: manifest.id,
      provider: manifest.provider,
      name: manifest.name,
      description: manifest.description,
      icon: manifest.icon,
      credential_fields: manifest.credential_fields,
      status: 'connected',
      has_credentials: true,
      configured_at: new Date().toISOString(),
      config_json: configJson,
    });
  }

  // ── Disconnect an integration ─────────────────────────────────────────────

  async disconnect(provider: string): Promise<Result<{ message: string }, IntegrationError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const manifest = INTEGRATION_MANIFESTS.find((m) => m.provider === provider);
    if (!manifest) {
      return err({ code: 'PROVIDER_NOT_FOUND', message: `Unknown integration provider: ${provider}` });
    }

    const tenantId = scope.tenant_id;

    // Find the ExtensionRegistry entry
    const extensionRegistry = await this.db.getClient().extensionRegistry.findFirst({
      where: { package_name: manifest.id },
    });

    if (extensionRegistry) {
      // Delete SecureCredential (wipe encrypted keys)
      await this.db.getClient().secureCredential.deleteMany({
        where: { tenant_id: tenantId, extension_id: extensionRegistry.id },
      });

      // Disable (not delete) TenantExtension so history is preserved
      await this.db.getClient().tenantExtension.updateMany({
        where: { tenant_id: tenantId, extension_id: extensionRegistry.id },
        data: { enabled: false },
      });
    }

    // Mark IntegrationConfig as disabled
    await this.db.getClient().integrationConfig.updateMany({
      where: { tenant_id: tenantId, provider },
      data: { enabled: false },
    });

    this.logger.log(`Tenant ${tenantId} disconnected integration: ${manifest.id}`);

    return ok({ message: `${manifest.name} disconnected successfully` });
  }

  // ── Retrieve decrypted credentials (used internally by adapters) ──────────

  async getDecryptedCredentials(
    provider: string,
  ): Promise<Result<Record<string, string>, IntegrationError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const manifest = INTEGRATION_MANIFESTS.find((m) => m.provider === provider);
    if (!manifest) {
      return err({ code: 'PROVIDER_NOT_FOUND', message: `Unknown provider: ${provider}` });
    }

    const extensionRegistry = await this.db.getClient().extensionRegistry.findFirst({
      where: { package_name: manifest.id },
    });
    if (!extensionRegistry) {
      return err({ code: 'NOT_CONNECTED', message: `${manifest.name} is not connected` });
    }

    const credential = await this.db.getClient().secureCredential.findFirst({
      where: { tenant_id: scope.tenant_id, extension_id: extensionRegistry.id },
    });
    if (!credential) {
      return err({ code: 'NOT_CONNECTED', message: `No credentials found for ${manifest.name}` });
    }

    const decryptResult = this.encryption.decrypt(
      credential.cipher_text,
      credential.iv,
      credential.tag,
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
}
