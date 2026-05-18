import { Injectable, Logger, Inject } from '@nestjs/common';
import type { SecretsBackend, SecretError } from './backends/secrets-backend.interface';
import type { Result } from 'neverthrow';

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);

  constructor(@Inject('SECRETS_BACKEND') private readonly backend: SecretsBackend) {}

  async get(ref: string): Promise<Result<string, SecretError>> {
    this.logger.log(`Resolving secret ref: ${ref}`);
    const result = await this.backend.get(ref);

    if (result.isErr()) {
      this.logger.warn(`Failed to resolve secret ref: ${ref} — ${result.error.code}`);
    }

    return result;
  }

  async set(ref: string, value: string): Promise<Result<void, SecretError>> {
    this.logger.log(`Setting secret ref: ${ref}`);
    return this.backend.set(ref, value);
  }

  async delete(ref: string): Promise<Result<void, SecretError>> {
    this.logger.log(`Deleting secret ref: ${ref}`);
    return this.backend.delete(ref);
  }
}
