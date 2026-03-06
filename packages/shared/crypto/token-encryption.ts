/**
 * Token Encryption — AES-256-GCM encrypt/decrypt for OAuth tokens.
 *
 * Encrypted tokens are stored in `base_connections.oauth_tokens` (JSONB).
 * The encryption key is read from `TOKEN_ENCRYPTION_KEY` env var (64 hex chars = 32 bytes).
 *
 * Payload shape: { iv, tag, ciphertext, version } — all base64 strings.
 * Version field enables future algorithm migration without breaking existing data.
 *
 * @see docs/reference/sync-engine.md § Token Storage
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12; // 96-bit IV (NIST recommended for GCM)
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const CURRENT_VERSION = 1;

// ---------------------------------------------------------------------------
// Encrypted payload schema
// ---------------------------------------------------------------------------

export const EncryptedPayloadSchema = z.object({
  iv: z.string().min(1),
  tag: z.string().min(1),
  ciphertext: z.string().min(1),
  version: z.literal(CURRENT_VERSION),
});

export type EncryptedPayload = z.infer<typeof EncryptedPayloadSchema>;

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const hex = process.env['TOKEN_ENCRYPTION_KEY'];
  if (!hex) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set');
  }
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    );
  }
  return Buffer.from(hex, 'hex');
}

// ---------------------------------------------------------------------------
// Encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt an object (typically OAuth tokens) with AES-256-GCM.
 *
 * Returns a JSON-serialisable payload that can be stored directly in JSONB.
 */
export function encryptTokens<T extends Record<string, unknown>>(
  tokens: T,
): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const plaintext = JSON.stringify(tokens);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    version: CURRENT_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypt an encrypted payload back to the original token object.
 *
 * Validates the payload shape with Zod before attempting decryption.
 * Throws on tampered ciphertext, wrong key, or invalid payload.
 */
export function decryptTokens<T extends Record<string, unknown>>(
  encrypted: unknown,
): T {
  const parsed = EncryptedPayloadSchema.parse(encrypted);
  const key = getEncryptionKey();

  const iv = Buffer.from(parsed.iv, 'base64');
  const tag = Buffer.from(parsed.tag, 'base64');
  const ciphertext = Buffer.from(parsed.ciphertext, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}
