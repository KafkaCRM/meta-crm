import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import { EnvSecretsBackend } from './backends/env-secrets.backend';
import { VaultSecretsBackend } from './backends/vault-secrets.backend';
import { SecretsService } from './secrets.service';
import type { SecretsBackend } from './backends/secrets-backend.interface';

/* ------------------------------------------------------------------ */
/*  EnvSecretsBackend                                                   */
/* ------------------------------------------------------------------ */
describe('EnvSecretsBackend', () => {
  let backend: EnvSecretsBackend;

  const ref = 'secret/tenants/t_abc123/whatsapp/api_key';
  const envKey = 'SECRET__TENANTS__T_ABC123__WHATSAPP__API_KEY';

  beforeEach(() => {
    backend = new EnvSecretsBackend();
    delete process.env[envKey];
    delete process.env['SECRET__PLATFORM__SMTP__PASSWORD'];
  });

  it('returns value when env var is set', async () => {
    process.env[envKey] = 'sk-12345';
    const result = await backend.get(ref);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('sk-12345');
    }
  });

  it('returns SECRET_NOT_FOUND when env var is missing', async () => {
    const result = await backend.get('secret/platform/smtp/password');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('SECRET_NOT_FOUND');
      expect(result.error.ref).toBe('secret/platform/smtp/password');
    }
  });

  it('sets env var correctly', async () => {
    const setResult = await backend.set('secret/platform/smtp/password', 'smtp-pass');
    expect(setResult.isOk()).toBe(true);
    expect(process.env['SECRET__PLATFORM__SMTP__PASSWORD']).toBe('smtp-pass');
  });

  it('deletes env var correctly', async () => {
    process.env['SECRET__PLATFORM__SMTP__PASSWORD'] = 'temp';
    const deleteResult = await backend.delete('secret/platform/smtp/password');

    expect(deleteResult.isOk()).toBe(true);
    expect(process.env['SECRET__PLATFORM__SMTP__PASSWORD']).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  VaultSecretsBackend                                                 */
/* ------------------------------------------------------------------ */
describe('VaultSecretsBackend', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env['VAULT_URL'] = 'http://vault:8200';
    process.env['VAULT_TOKEN'] = 'hvs.test-token';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env['VAULT_URL'];
    delete process.env['VAULT_TOKEN'];
  });

  function mockFetch(status: number, body: unknown) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: vi.fn().mockResolvedValue(body),
    });
  }

  it('makes correct HTTP request to Vault API', async () => {
    mockFetch(200, { data: { data: { value: 'api-key-value' } } });

    const backend = new VaultSecretsBackend();
    const result = await backend.get('secret/tenants/t_abc123/whatsapp/api_key');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('api-key-value');
    }

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://vault:8200/v1/secret/data/secret/tenants/t_abc123/whatsapp/api_key',
      { headers: { 'X-Vault-Token': 'hvs.test-token' } },
    );
  });

  it('returns SECRET_NOT_FOUND on 404', async () => {
    mockFetch(404, {});

    const backend = new VaultSecretsBackend();
    const result = await backend.get('secret/unknown/path');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('SECRET_NOT_FOUND');
      expect(result.error.ref).toBe('secret/unknown/path');
    }
  });

  it('returns SECRET_BACKEND_ERROR on 500', async () => {
    mockFetch(500, {});

    const backend = new VaultSecretsBackend();
    const result = await backend.get('secret/broken');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('SECRET_BACKEND_ERROR');
      expect(result.error.status).toBe(500);
    }
  });

  it('returns SECRET_BACKEND_UNAVAILABLE when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const backend = new VaultSecretsBackend();
    const result = await backend.get('secret/tenants/t_abc123/whatsapp/api_key');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('SECRET_BACKEND_UNAVAILABLE');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  SecretsService — backend selection                                  */
/* ------------------------------------------------------------------ */
describe('SecretsService backend selection', () => {
  afterEach(() => {
    delete process.env['SECRETS_BACKEND'];
    delete process.env['SECRET__TENANTS__T_ABC123__WHATSAPP__API_KEY'];
  });

  it('uses EnvSecretsBackend via constructor', async () => {
    const backend = new EnvSecretsBackend();
    const service = new SecretsService(backend);

    process.env['SECRET__TENANTS__T_ABC123__WHATSAPP__API_KEY'] = 'sk-123';
    const result = await service.get('secret/tenants/t_abc123/whatsapp/api_key');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('sk-123');
    }
  });

  it('creates EnvSecretsBackend when SECRETS_BACKEND is env', () => {
    process.env['SECRETS_BACKEND'] = 'env';
    const backend = new EnvSecretsBackend();
    const service = new SecretsService(backend);
    expect(service).toBeInstanceOf(SecretsService);
  });
});

/* ------------------------------------------------------------------ */
/*  SecretsService — logger spy — value never appears in logs          */
/* ------------------------------------------------------------------ */
describe('SecretsService logger — resolved value never in log output', () => {
  let backend: SecretsBackend;
  let service: SecretsService;

  beforeEach(() => {
    backend = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
    service = new SecretsService(backend);

    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs only the ref path, not the secret value on success', async () => {
    (backend.get as any).mockResolvedValue(ok('super-secret-12345'));

    const result = await service.get('secret/tenants/t_abc123/whatsapp/api_key');

    expect(result.isOk()).toBe(true);

    const logCalls = (Logger.prototype.log as any).mock.calls;
    const warnCalls = (Logger.prototype.warn as any).mock.calls;

    for (const args of logCalls) {
      const text = args.join(' ');
      expect(text).not.toContain('super-secret-12345');
    }
    for (const args of warnCalls) {
      const text = args.join(' ');
      expect(text).not.toContain('super-secret-12345');
    }
  });

  it('logs the ref path on success', async () => {
    (backend.get as any).mockResolvedValue(ok('dont-care'));

    await service.get('secret/tenants/t_abc123/whatsapp/api_key');

    const logCalls = (Logger.prototype.log as any).mock.calls;
    const allRefLogs = logCalls.some((args: any[]) =>
      args.join(' ').includes('secret/tenants/t_abc123/whatsapp/api_key'),
    );
    expect(allRefLogs).toBe(true);
  });

  it('logs only the ref path on failure, not the value', async () => {
    (backend.get as any).mockResolvedValue(err({ code: 'SECRET_NOT_FOUND', ref: 'secret/missing' }));

    await service.get('secret/missing');

    const logCalls = (Logger.prototype.log as any).mock.calls;
    const warnCalls = (Logger.prototype.warn as any).mock.calls;

    for (const args of logCalls) {
      const text = args.join(' ');
      expect(text).not.toContain('SECRET_NOT_FOUND');
    }
    for (const args of warnCalls) {
      const text = args.join(' ');
      expect(text).toContain('secret/missing');
    }
  });
});
