import * as bcrypt from 'bcrypt';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return createId();
}

/**
 * Derives a 32-byte key for AES-256-GCM authenticated encryption
 */
function getVaultKey(): Buffer {
  const secret = process.env.VAULT_SECRET || process.env.JWT_SECRET || 'meta-crm-vault-master-key-fallback-32chars!';
  return createHash('sha256').update(secret).digest();
}

export interface EncryptedVaultPayload {
  cipherText: string;
  iv: string;
  tag: string;
}

/**
 * Encrypts arbitrary data (string or object) using AES-256-GCM authenticated cipher
 */
export function encryptVaultData(data: unknown): EncryptedVaultPayload {
  const key = getVaultKey();
  const iv = randomBytes(12); // 12-byte IV standard for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  let encrypted = cipher.update(serialized, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    cipherText: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypts AES-256-GCM ciphertext verifying authentication tag
 */
export function decryptVaultData<T = any>(cipherText: string, iv: string, tag: string): T {
  const key = getVaultKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(cipherText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return decrypted as unknown as T;
  }
}
