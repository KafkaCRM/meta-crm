import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { ConnectionService, INTEGRATION_MANIFESTS } from './connection.service';

export type IntegrationErrorCode =
  | 'TENANT_NOT_FOUND'
  | 'PROVIDER_NOT_FOUND'
  | 'NOT_CONNECTED'
  | 'INTERNAL';

export interface IntegrationError {
  code: IntegrationErrorCode;
  message?: string;
}

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

export interface IntegrationTestResult {
  provider: string;
  status: 'healthy' | 'error';
  message: string;
  last_checked_at: string;
  checked_fields: string[];
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly connectionService: ConnectionService,
  ) {}

  private getScope(): RequestScope | null {
    return this.cls.get<RequestScope>('scope') ?? null;
  }

  async listIntegrations(): Promise<Result<IntegrationDto[], IntegrationError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const connections = await this.db.getClient().integrationConnection.findMany({
      where: { tenant_id: scope.tenant_id },
    });

    const result: IntegrationDto[] = INTEGRATION_MANIFESTS.map((manifest) => {
      const connection = connections.find((c) => c.provider === manifest.provider);
      return {
        id: manifest.id,
        provider: manifest.provider,
        name: manifest.name,
        description: manifest.description,
        icon: manifest.icon,
        credential_fields: manifest.credential_fields,
        status: connection?.status === 'connected' ? 'connected' : 'disconnected',
        has_credentials: !!(connection?.credentials_cipher_text),
        configured_at: connection?.updated_at?.toISOString(),
        config_json: (connection?.config_json as Record<string, unknown>) ?? {},
      };
    });

    return ok(result);
  }

  async configure(
    provider: string,
    credentials: Record<string, string>,
    configJson: Record<string, unknown> = {},
  ): Promise<Result<IntegrationDto, IntegrationError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const result = await this.connectionService.connect(provider, credentials, configJson);

    if (result.isErr()) {
      return err({ code: 'PROVIDER_NOT_FOUND', message: result.error.message });
    }

    const dto = result.value;
    return ok({
      id: `integration/${dto.provider}`,
      provider: dto.provider,
      name: dto.name,
      description: '',
      icon: 'Link',
      credential_fields: [],
      status: dto.status === 'connected' ? 'connected' : 'disconnected',
      has_credentials: dto.has_credentials,
      configured_at: dto.updated_at,
      config_json: dto.config_json,
    });
  }

  async disconnect(provider: string): Promise<Result<{ message: string }, IntegrationError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const connectionResult = await this.connectionService.getConnectionByProvider(provider);
    if (connectionResult.isErr()) {
      return err({ code: 'PROVIDER_NOT_FOUND', message: connectionResult.error.message });
    }

    const disconnectResult = await this.connectionService.disconnect(connectionResult.value.id);
    if (disconnectResult.isErr()) {
      return err({ code: 'INTERNAL', message: disconnectResult.error.message });
    }

    return ok(disconnectResult.value);
  }

  async testConnection(provider: string): Promise<Result<IntegrationTestResult, IntegrationError>> {
    const scope = this.getScope();
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const connectionResult = await this.connectionService.getConnectionByProvider(provider);
    if (connectionResult.isErr()) {
      return err({ code: 'PROVIDER_NOT_FOUND', message: connectionResult.error.message });
    }

    const testResult = await this.connectionService.testConnection(connectionResult.value.id);
    if (testResult.isErr()) {
      return err({ code: 'NOT_CONNECTED', message: testResult.error.message });
    }

    const t = testResult.value;
    return ok({
      provider,
      status: t.status === 'healthy' ? 'healthy' : 'error',
      message: t.message,
      last_checked_at: t.last_tested_at,
      checked_fields: [],
    });
  }
}
