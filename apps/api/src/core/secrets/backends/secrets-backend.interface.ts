import type { Result } from 'neverthrow';

export type SecretErrorCode = 'SECRET_NOT_FOUND' | 'SECRET_BACKEND_ERROR' | 'SECRET_BACKEND_UNAVAILABLE';

export interface SecretError {
  code: SecretErrorCode;
  ref: string;
  message?: string;
  status?: number;
}

export interface SecretsBackend {
  get(ref: string): Promise<Result<string, SecretError>>;
  set(ref: string, value: string): Promise<Result<void, SecretError>>;
  delete(ref: string): Promise<Result<void, SecretError>>;
}
