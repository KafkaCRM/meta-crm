import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import type { SecretsBackend, SecretError } from './secrets-backend.interface';

function envVarName(ref: string): string {
  return ref.replace(/\//g, '__').toUpperCase();
}

export class EnvSecretsBackend implements SecretsBackend {
  async get(ref: string): Promise<Result<string, SecretError>> {
    const key = envVarName(ref);
    const value = process.env[key];

    if (value === undefined || value === '') {
      return err({ code: 'SECRET_NOT_FOUND', ref });
    }

    return ok(value);
  }

  async set(ref: string, value: string): Promise<Result<void, SecretError>> {
    process.env[envVarName(ref)] = value;
    return ok(undefined);
  }

  async delete(ref: string): Promise<Result<void, SecretError>> {
    delete process.env[envVarName(ref)];
    return ok(undefined);
  }
}
