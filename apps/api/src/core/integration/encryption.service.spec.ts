import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    // Use a valid 64-char hex key for tests
    process.env['CREDENTIAL_ENCRYPTION_KEY'] = 'a'.repeat(64);
    service = new EncryptionService();
  });

  afterEach(() => {
    delete process.env['CREDENTIAL_ENCRYPTION_KEY'];
  });

  describe('encrypt', () => {
    it('should return cipher_text, iv, and tag', () => {
      const result = service.encrypt('hello world');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.cipher_text).toBeTruthy();
        expect(result.value.iv).toBeTruthy();
        expect(result.value.tag).toBeTruthy();
      }
    });

    it('should produce different cipher_text for the same plaintext on each call (IV randomness)', () => {
      const r1 = service.encrypt('same input');
      const r2 = service.encrypt('same input');
      expect(r1.isOk()).toBe(true);
      expect(r2.isOk()).toBe(true);
      if (r1.isOk() && r2.isOk()) {
        expect(r1.value.iv).not.toBe(r2.value.iv);
        expect(r1.value.cipher_text).not.toBe(r2.value.cipher_text);
      }
    });

    it('should handle empty string', () => {
      const result = service.encrypt('');
      expect(result.isOk()).toBe(true);
    });

    it('should handle JSON payloads', () => {
      const payload = JSON.stringify({ api_key: 'sk-test-12345', phone_number_id: '1234567890' });
      const result = service.encrypt(payload);
      expect(result.isOk()).toBe(true);
    });
  });

  describe('decrypt', () => {
    it('should decrypt to the original plaintext', () => {
      const plaintext = 'hello from EncryptionService';
      const encResult = service.encrypt(plaintext);
      expect(encResult.isOk()).toBe(true);
      if (encResult.isOk()) {
        const decResult = service.decrypt(
          encResult.value.cipher_text,
          encResult.value.iv,
          encResult.value.tag,
        );
        expect(decResult.isOk()).toBe(true);
        if (decResult.isOk()) {
          expect(decResult.value).toBe(plaintext);
        }
      }
    });

    it('should decrypt JSON credential payloads', () => {
      const creds = { api_key: 'EAABwzLixnjYBO123', phone_number_id: '123456789012345' };
      const payload = JSON.stringify(creds);
      const encResult = service.encrypt(payload);
      expect(encResult.isOk()).toBe(true);
      if (encResult.isOk()) {
        const decResult = service.decrypt(
          encResult.value.cipher_text,
          encResult.value.iv,
          encResult.value.tag,
        );
        expect(decResult.isOk()).toBe(true);
        if (decResult.isOk()) {
          const parsed = JSON.parse(decResult.value) as Record<string, string>;
          expect(parsed['api_key']).toBe(creds.api_key);
          expect(parsed['phone_number_id']).toBe(creds.phone_number_id);
        }
      }
    });

    it('should fail with DECRYPTION_FAILED when tag is tampered', () => {
      const encResult = service.encrypt('tamper me');
      expect(encResult.isOk()).toBe(true);
      if (encResult.isOk()) {
        const badTag = Buffer.from(encResult.value.tag, 'base64');
        badTag[badTag.length - 1]! ^= 0xff;
        const decResult = service.decrypt(
          encResult.value.cipher_text,
          encResult.value.iv,
          badTag.toString('base64'),
        );
        expect(decResult.isErr()).toBe(true);
        if (decResult.isErr()) {
          expect(decResult.error.code).toBe('DECRYPTION_FAILED');
        }
      }
    });

    it('should fail with DECRYPTION_FAILED when ciphertext is tampered', () => {
      const encResult = service.encrypt('tamper the cipher');
      expect(encResult.isOk()).toBe(true);
      if (encResult.isOk()) {
        const badCipher = Buffer.from(encResult.value.cipher_text, 'base64');
        if (badCipher.length > 0) {
          badCipher[0]! ^= 0xff;
        }
        const decResult = service.decrypt(
          badCipher.toString('base64'),
          encResult.value.iv,
          encResult.value.tag,
        );
        expect(decResult.isErr()).toBe(true);
        if (decResult.isErr()) {
          expect(decResult.error.code).toBe('DECRYPTION_FAILED');
        }
      }
    });
  });

  describe('key fallback', () => {
    it('should use dev fallback key when CREDENTIAL_ENCRYPTION_KEY is not set', () => {
      delete process.env['CREDENTIAL_ENCRYPTION_KEY'];
      const devService = new EncryptionService();
      const encResult = devService.encrypt('test with dev key');
      expect(encResult.isOk()).toBe(true);
      if (encResult.isOk()) {
        const decResult = devService.decrypt(
          encResult.value.cipher_text,
          encResult.value.iv,
          encResult.value.tag,
        );
        expect(decResult.isOk()).toBe(true);
        if (decResult.isOk()) {
          expect(decResult.value).toBe('test with dev key');
        }
      }
    });
  });
});
