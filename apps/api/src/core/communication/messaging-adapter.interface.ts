import type { Result } from 'neverthrow';

export type AdapterErrorCode = 'ADAPTER_SEND_FAILED' | 'ADAPTER_CREDENTIALS_MISSING' | 'ADAPTER_INVALID_PHONE';

export interface AdapterError {
  code: AdapterErrorCode;
  provider: string;
  detail?: string;
}

export interface MessagingAdapter {
  send(params: {
    to: string;
    message: string;
    tenant_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<Result<{ message_id: string }, AdapterError>>;
}
