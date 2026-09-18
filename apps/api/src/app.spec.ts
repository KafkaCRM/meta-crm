import { describe, it, expect } from 'vitest';
import { app } from './app';
import { signJwt, verifyJwt } from './lib/jwt';
import { hashPassword, verifyPassword, encryptVaultData, decryptVaultData } from './lib/crypto';

describe('Hono + Drizzle API Core', () => {
  it('GET /health returns 200 and healthy status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('healthy');
  });

  it('SEC-01 & SEC-02: Responses include CORS and Secure Headers', async () => {
    const res = await app.request('/health', {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('GET /api/v1/leads requires authentication (401)', async () => {
    const res = await app.request('/api/v1/leads');
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/auth/login rejects invalid JSON body (400)', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }), // missing password
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_FAILED');
  });

  it('JWT sign and verify works with complete tenant payload', () => {
    const token = signJwt({
      sub: 'user_123',
      tenant_id: 'tenant_456',
      role: 'admin',
      vertical_ids: ['vert_1'],
      assignment_ids: ['asgn_1'],
    });

    const verified = verifyJwt(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe('user_123');
    expect(verified?.tenant_id).toBe('tenant_456');
    expect(verified?.role).toBe('admin');
    expect(verified?.vertical_ids).toEqual(['vert_1']);
  });

  it('Crypto hashes and verifies passwords safely', async () => {
    const raw = 'SuperSecret123!';
    const hash = await hashPassword(raw);
    expect(hash).not.toBe(raw);
    const valid = await verifyPassword(raw, hash);
    expect(valid).toBe(true);
    const invalid = await verifyPassword('WrongPassword', hash);
    expect(invalid).toBe(false);
  });

  it('AES-256-GCM Vault encrypts and decrypts sensitive integration credentials', () => {
    const credentials = {
      api_key: 'sk_live_938472918472918',
      webhook_secret: 'whsec_abcdef123456789',
    };
    const encrypted = encryptVaultData(credentials);
    expect(encrypted.cipherText).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes hex
    expect(encrypted.tag).toHaveLength(32); // 16 bytes hex

    const decrypted = decryptVaultData<typeof credentials>(
      encrypted.cipherText,
      encrypted.iv,
      encrypted.tag
    );
    expect(decrypted).toEqual(credentials);
  });

  it('Franchise API enforces authentication on /api/v1/franchise/status (401)', async () => {
    const res = await app.request('/api/v1/franchise/status');
    expect(res.status).toBe(401);
  });
});
