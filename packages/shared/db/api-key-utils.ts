/**
 * API Key Utilities — Generation, Hashing, Validation
 *
 * Provides cryptographically secure API key generation with SHA-256 hashing,
 * timing-safe verification, Zod validation schema, and rate limit tier
 * configuration for the Platform API.
 *
 * Full keys are shown once at creation and never stored or logged.
 * Only the SHA-256 hash is persisted in the `api_keys` table.
 *
 * @see docs/reference/platform-api.md § Authentication
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants — Key Prefixes
// ---------------------------------------------------------------------------

export const API_KEY_PREFIXES = {
  live: 'esk_live_',
  test: 'esk_test_',
} as const;

export type ApiKeyEnvironment = keyof typeof API_KEY_PREFIXES;

// ---------------------------------------------------------------------------
// Scopes — Foundation (5 scopes for MVP — API phase)
// ---------------------------------------------------------------------------

export const API_KEY_SCOPES = [
  'data:read',
  'data:write',
  'schema:read',
  'schema:write',
  'admin',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

// ---------------------------------------------------------------------------
// Rate Limit Tiers
// ---------------------------------------------------------------------------

export const RATE_LIMIT_TIERS = {
  basic: { requestsPerMinute: 60, burst: 10 },
  standard: { requestsPerMinute: 120, burst: 20 },
  high: { requestsPerMinute: 600, burst: 100 },
  enterprise: { requestsPerMinute: 2000, burst: 500 },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------

/** Base62 alphabet — alphanumeric only, no special chars */
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Generate a cryptographically secure base62 string of the given length.
 *
 * Uses rejection sampling on crypto.randomBytes to avoid modulo bias.
 * Each character carries ~5.95 bits of entropy (log2(62)).
 * 48 characters = ~285 bits of entropy.
 */
function generateSecureBase62(length: number): string {
  const result: string[] = [];
  // 256 % 62 = 8, so values >= 248 are rejected to avoid modulo bias
  const limit = 256 - (256 % BASE62.length); // 248

  while (result.length < length) {
    const bytes = randomBytes(length - result.length + 16); // over-request to reduce iterations
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      if (bytes[i]! < limit) {
        result.push(BASE62[bytes[i]! % BASE62.length]!);
      }
    }
  }

  return result.join('');
}

export interface GeneratedApiKey {
  /** Full key including prefix — shown once to the user, never stored */
  fullKey: string;
  /** First 16 characters of fullKey — stored for display/identification */
  keyPrefix: string;
  /** SHA-256 hex digest of fullKey — stored in api_keys.key_hash */
  keyHash: string;
}

/**
 * Generate a new API key with cryptographically secure random bytes.
 *
 * Format: `esk_{live|test}_` + 48 base62 characters
 * The full key is returned for one-time display. Only the hash is stored.
 */
export function generateApiKey(environment: ApiKeyEnvironment): GeneratedApiKey {
  const prefix = API_KEY_PREFIXES[environment];
  const randomPart = generateSecureBase62(48);
  const fullKey = `${prefix}${randomPart}`;

  return {
    fullKey,
    keyPrefix: fullKey.slice(0, 16),
    keyHash: hashApiKey(fullKey),
  };
}

// ---------------------------------------------------------------------------
// Hashing & Verification
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 hex digest of an API key.
 * Returns a 64-character lowercase hex string.
 */
export function hashApiKey(fullKey: string): string {
  return createHash('sha256').update(fullKey).digest('hex');
}

/**
 * Verify an API key against a stored hash using constant-time comparison.
 *
 * Uses crypto.timingSafeEqual to prevent timing side-channel attacks.
 * Returns false (not throws) on mismatch.
 */
export function verifyApiKeyHash(fullKey: string, storedHash: string): boolean {
  const computed = hashApiKey(fullKey);
  const computedBuf = Buffer.from(computed, 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');

  if (computedBuf.length !== storedBuf.length) {
    return false;
  }

  return timingSafeEqual(computedBuf, storedBuf);
}

// ---------------------------------------------------------------------------
// Zod Validation Schema — API Key Creation Input
// ---------------------------------------------------------------------------

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
  rateLimitTier: z
    .enum(['basic', 'standard', 'high', 'enterprise'])
    .default('standard'),
  expiresAt: z.date().nullable().default(null),
});

export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
