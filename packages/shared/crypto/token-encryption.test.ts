import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  encryptTokens,
  decryptTokens,
  EncryptedPayloadSchema,
} from './token-encryption';
import type { EncryptedPayload } from './token-encryption';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a valid 64-char hex key (32 bytes). */
function generateTestKey(): string {
  return randomBytes(32).toString('hex');
}

const TEST_KEY = generateTestKey();

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

describe('token-encryption', () => {
  const originalEnv = process.env['TOKEN_ENCRYPTION_KEY'];

  beforeEach(() => {
    process.env['TOKEN_ENCRYPTION_KEY'] = TEST_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['TOKEN_ENCRYPTION_KEY'] = originalEnv;
    } else {
      delete process.env['TOKEN_ENCRYPTION_KEY'];
    }
  });

  // -------------------------------------------------------------------------
  // Round-trip
  // -------------------------------------------------------------------------

  describe('round-trip', () => {
    it('encrypts and decrypts simple tokens', () => {
      const tokens = {
        access_token: 'pat1234.abc.def',
        refresh_token: 'ref5678.ghi.jkl',
        expires_at: 1700000000,
      };

      const encrypted = encryptTokens(tokens);
      const decrypted = decryptTokens<typeof tokens>(encrypted);

      expect(decrypted).toEqual(tokens);
    });

    it('handles unicode values', () => {
      const tokens = {
        access_token: 'tok_with_emoji_\u{1F680}_and_kanji_\u6F22\u5B57',
        scope: 'data:read',
      };

      const encrypted = encryptTokens(tokens);
      const decrypted = decryptTokens<typeof tokens>(encrypted);

      expect(decrypted).toEqual(tokens);
    });

    it('handles nested objects', () => {
      const tokens = {
        access_token: 'atok123',
        metadata: { scopes: ['read', 'write'], user: { id: 'u1' } },
      };

      const encrypted = encryptTokens(tokens);
      const decrypted = decryptTokens<typeof tokens>(encrypted);

      expect(decrypted).toEqual(tokens);
    });

    it('produces different ciphertext for each encryption (random IV)', () => {
      const tokens = { access_token: 'same_token' };

      const a = encryptTokens(tokens);
      const b = encryptTokens(tokens);

      expect(a.iv).not.toBe(b.iv);
      expect(a.ciphertext).not.toBe(b.ciphertext);
    });
  });

  // -------------------------------------------------------------------------
  // Payload shape
  // -------------------------------------------------------------------------

  describe('payload shape', () => {
    it('matches EncryptedPayloadSchema', () => {
      const encrypted = encryptTokens({ access_token: 'test' });

      expect(() => EncryptedPayloadSchema.parse(encrypted)).not.toThrow();
      expect(encrypted.version).toBe(1);
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.tag).toBe('string');
      expect(typeof encrypted.ciphertext).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  // Tamper detection
  // -------------------------------------------------------------------------

  describe('tamper detection', () => {
    it('throws on tampered ciphertext', () => {
      const encrypted = encryptTokens({ access_token: 'secret' });

      // Flip a byte in the ciphertext
      const buf = Buffer.from(encrypted.ciphertext, 'base64');
      buf[0] = (buf[0]! ^ 0xff) as number;
      const tampered: EncryptedPayload = {
        ...encrypted,
        ciphertext: buf.toString('base64'),
      };

      expect(() => decryptTokens(tampered)).toThrow();
    });

    it('throws on tampered auth tag', () => {
      const encrypted = encryptTokens({ access_token: 'secret' });

      const buf = Buffer.from(encrypted.tag, 'base64');
      buf[0] = (buf[0]! ^ 0xff) as number;
      const tampered: EncryptedPayload = {
        ...encrypted,
        tag: buf.toString('base64'),
      };

      expect(() => decryptTokens(tampered)).toThrow();
    });

    it('throws on tampered IV', () => {
      const encrypted = encryptTokens({ access_token: 'secret' });

      const buf = Buffer.from(encrypted.iv, 'base64');
      buf[0] = (buf[0]! ^ 0xff) as number;
      const tampered: EncryptedPayload = {
        ...encrypted,
        iv: buf.toString('base64'),
      };

      expect(() => decryptTokens(tampered)).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Wrong key
  // -------------------------------------------------------------------------

  describe('wrong key', () => {
    it('throws when decrypting with a different key', () => {
      const encrypted = encryptTokens({ access_token: 'secret' });

      // Switch to a different key
      process.env['TOKEN_ENCRYPTION_KEY'] = generateTestKey();

      expect(() => decryptTokens(encrypted)).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Key validation
  // -------------------------------------------------------------------------

  describe('key validation', () => {
    it('throws when TOKEN_ENCRYPTION_KEY is not set', () => {
      delete process.env['TOKEN_ENCRYPTION_KEY'];

      expect(() => encryptTokens({ access_token: 'test' })).toThrow(
        'TOKEN_ENCRYPTION_KEY environment variable is not set',
      );
    });

    it('throws when key is too short', () => {
      process.env['TOKEN_ENCRYPTION_KEY'] = 'abcd1234';

      expect(() => encryptTokens({ access_token: 'test' })).toThrow(
        'TOKEN_ENCRYPTION_KEY must be a 64-character hex string',
      );
    });

    it('throws when key contains non-hex characters', () => {
      process.env['TOKEN_ENCRYPTION_KEY'] = 'g'.repeat(64);

      expect(() => encryptTokens({ access_token: 'test' })).toThrow(
        'TOKEN_ENCRYPTION_KEY must be a 64-character hex string',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Invalid payload
  // -------------------------------------------------------------------------

  describe('invalid payload', () => {
    it('throws on null input', () => {
      expect(() => decryptTokens(null)).toThrow();
    });

    it('throws on missing fields', () => {
      expect(() => decryptTokens({ iv: 'abc' })).toThrow();
    });

    it('throws on wrong version', () => {
      const encrypted = encryptTokens({ access_token: 'test' });
      expect(() =>
        decryptTokens({ ...encrypted, version: 2 }),
      ).toThrow();
    });
  });
});
