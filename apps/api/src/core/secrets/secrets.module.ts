import { Module } from '@nestjs/common';
import { SecretsService } from './secrets.service';
import { EnvSecretsBackend } from './backends/env-secrets.backend';
import { VaultSecretsBackend } from './backends/vault-secrets.backend';
import type { SecretsBackend } from './backends/secrets-backend.interface';

function createBackend(): SecretsBackend {
  const backend = process.env['SECRETS_BACKEND'] || 'env';

  if (backend === 'vault') {
    return new VaultSecretsBackend();
  }

  return new EnvSecretsBackend();
}

@Module({
  providers: [
    {
      provide: 'SECRETS_BACKEND',
      useFactory: () => createBackend(),
    },
    SecretsService,
  ],
  exports: [SecretsService],
})
export class SecretsModule {}
