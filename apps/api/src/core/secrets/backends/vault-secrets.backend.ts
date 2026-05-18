import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import type { SecretsBackend, SecretError } from './secrets-backend.interface';

export class VaultSecretsBackend implements SecretsBackend {
  private readonly vaultUrl: string;
  private readonly vaultToken: string;

  constructor() {
    const vaultUrl = process.env['VAULT_URL'];
    const vaultToken = process.env['VAULT_TOKEN'];

    if (!vaultUrl) {
      throw new Error('VAULT_URL environment variable is required for VaultSecretsBackend');
    }
    if (!vaultToken) {
      throw new Error('VAULT_TOKEN environment variable is required for VaultSecretsBackend');
    }

    this.vaultUrl = vaultUrl.replace(/\/+$/, '');
    this.vaultToken = vaultToken;
  }

  async get(ref: string): Promise<Result<string, SecretError>> {
    try {
      const response = await fetch(`${this.vaultUrl}/v1/secret/data/${ref}`, {
        headers: { 'X-Vault-Token': this.vaultToken },
      });

      if (response.status === 404) {
        return err({ code: 'SECRET_NOT_FOUND', ref });
      }

      if (!response.ok) {
        return err({ code: 'SECRET_BACKEND_ERROR', ref, status: response.status });
      }

      const body: any = await response.json();
      const value: unknown = body?.data?.data?.value;

      if (typeof value !== 'string' || value === '') {
        return err({ code: 'SECRET_NOT_FOUND', ref });
      }

      return ok(value);
    } catch {
      return err({ code: 'SECRET_BACKEND_UNAVAILABLE', ref });
    }
  }

  async set(_ref: string, _value: string): Promise<Result<void, SecretError>> {
    return err({ code: 'SECRET_BACKEND_ERROR', ref: _ref, message: 'set() not implemented for Vault backend' });
  }

  async delete(_ref: string): Promise<Result<void, SecretError>> {
    return err({ code: 'SECRET_BACKEND_ERROR', ref: _ref, message: 'delete() not implemented for Vault backend' });
  }
}
