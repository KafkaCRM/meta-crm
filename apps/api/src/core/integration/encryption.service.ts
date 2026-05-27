import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';

export type EncryptionErrorCode = 'ENCRYPTION_KEY_MISSING' | 'ENCRYPTION_FAILED' | 'DECRYPTION_FAILED';

export interface EncryptionError {
  code: EncryptionErrorCode;
  message: string;
}

export interface EncryptedPayload {
  /** Base64-encoded AES-256-GCM ciphertext */
  cipher_text: string;
  /** Base64-encoded 12-byte initialization vector */
  iv: string;
  /** Base64-encoded 16-byte authentication tag */
  tag: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // recommended for GCM
const TAG_LENGTH = 16;  // GCM auth tag length in bytes

/**
 * EncryptionService wraps Node.js crypto with AES-256-GCM.
 *
 * Key source (in priority order):
 *   1. CREDENTIAL_ENCRYPTION_KEY env var — a 64-char hex string (32 bytes).
 *   2. A deterministic dev-only fallback (never use in production).
 *
 * Each call to encrypt() generates a fresh random IV, so the same plaintext
 * produces different ciphertext on every call (semantic security).
 *
 * Usage:
 *   const enc = await encryptionService.encrypt(JSON.stringify({ api_key: '...' }));
 *   const plain = await encryptionService.decrypt(enc.cipher_text, enc.iv, enc.tag);
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor() {
    const hexKey = process.env['CREDENTIAL_ENCRYPTION_KEY'];

    if (hexKey && hexKey.length === 64) {
      this.key = Buffer.from(hexKey, 'hex');
    } else {
      // Dev-only fallback — log a loud warning so devs know to set the env var
      this.logger.warn(
        'CREDENTIAL_ENCRYPTION_KEY not set or invalid. Using insecure dev fallback key. ' +
        'Set a 64-char hex string in your .env file before deploying.',
      );
      // 32 zero-bytes — predictable but safe for local dev since data is never real
      this.key = Buffer.alloc(32, 0);
    }
  }

  /**
   * Encrypt a plaintext string. Returns base64-encoded (cipher_text, iv, tag).
   */
  encrypt(plaintext: string): Result<EncryptedPayload, EncryptionError> {
    try {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, this.key, iv, {
        authTagLength: TAG_LENGTH,
      });

      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();

      return ok({
        cipher_text: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
      });
    } catch (e) {
      return err({
        code: 'ENCRYPTION_FAILED',
        message: (e as Error).message,
      });
    }
  }

  /**
   * Decrypt a payload that was produced by encrypt().
   * Returns the original plaintext string.
   */
  decrypt(
    cipherText: string,
    iv: string,
    tag: string,
  ): Result<string, EncryptionError> {
    try {
      const ivBuf = Buffer.from(iv, 'base64');
      const tagBuf = Buffer.from(tag, 'base64');
      const cipherBuf = Buffer.from(cipherText, 'base64');

      const decipher = createDecipheriv(ALGORITHM, this.key, ivBuf, {
        authTagLength: TAG_LENGTH,
      });
      decipher.setAuthTag(tagBuf);

      const decrypted = Buffer.concat([
        decipher.update(cipherBuf),
        decipher.final(),
      ]);

      return ok(decrypted.toString('utf8'));
    } catch (e) {
      return err({
        code: 'DECRYPTION_FAILED',
        message: (e as Error).message,
      });
    }
  }
}
