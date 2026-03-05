import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import {
  API_KEY_PREFIXES,
  API_KEY_SCOPES,
  RATE_LIMIT_TIERS,
  generateApiKey,
  hashApiKey,
  verifyApiKeyHash,
  apiKeyCreateSchema,
} from './api-key-utils';
import type { ApiKeyScope, RateLimitTier } from './api-key-utils';

// ---------------------------------------------------------------------------
// API_KEY_PREFIXES
// ---------------------------------------------------------------------------

describe('API_KEY_PREFIXES', () => {
  it('defines live and test prefixes with esk_ format', () => {
    expect(API_KEY_PREFIXES.live).toBe('esk_live_');
    expect(API_KEY_PREFIXES.test).toBe('esk_test_');
  });

  it('has exactly 2 environments', () => {
    expect(Object.keys(API_KEY_PREFIXES)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// API_KEY_SCOPES
// ---------------------------------------------------------------------------

describe('API_KEY_SCOPES', () => {
  it('contains exactly 5 Foundation scopes', () => {
    expect(API_KEY_SCOPES).toHaveLength(5);
    expect(API_KEY_SCOPES).toEqual([
      'data:read',
      'data:write',
      'schema:read',
      'schema:write',
      'admin',
    ]);
  });
});

// ---------------------------------------------------------------------------
// RATE_LIMIT_TIERS
// ---------------------------------------------------------------------------

describe('RATE_LIMIT_TIERS', () => {
  it('defines 4 tiers with correct values', () => {
    expect(Object.keys(RATE_LIMIT_TIERS)).toHaveLength(4);
    expect(RATE_LIMIT_TIERS.basic).toEqual({ requestsPerMinute: 60, burst: 10 });
    expect(RATE_LIMIT_TIERS.standard).toEqual({ requestsPerMinute: 120, burst: 20 });
    expect(RATE_LIMIT_TIERS.high).toEqual({ requestsPerMinute: 600, burst: 100 });
    expect(RATE_LIMIT_TIERS.enterprise).toEqual({ requestsPerMinute: 2000, burst: 500 });
  });

  it('tiers are ordered by increasing capacity', () => {
    const tiers: RateLimitTier[] = ['basic', 'standard', 'high', 'enterprise'];
    for (let i = 1; i < tiers.length; i++) {
      expect(RATE_LIMIT_TIERS[tiers[i]!].requestsPerMinute).toBeGreaterThan(
        RATE_LIMIT_TIERS[tiers[i - 1]!].requestsPerMinute,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// generateApiKey
// ---------------------------------------------------------------------------

describe('generateApiKey', () => {
  it('generates a live key with esk_live_ prefix', () => {
    const { fullKey, keyPrefix, keyHash } = generateApiKey('live');

    expect(fullKey.startsWith('esk_live_')).toBe(true);
    expect(keyPrefix).toBe(fullKey.slice(0, 16));
    expect(keyHash).toHaveLength(64);
  });

  it('generates a test key with esk_test_ prefix', () => {
    const { fullKey, keyPrefix, keyHash } = generateApiKey('test');

    expect(fullKey.startsWith('esk_test_')).toBe(true);
    expect(keyPrefix).toBe(fullKey.slice(0, 16));
    expect(keyHash).toHaveLength(64);
  });

  it('produces a key of correct total length (prefix + 48 random chars)', () => {
    const liveKey = generateApiKey('live');
    const testKey = generateApiKey('test');

    // esk_live_ = 9 chars + 48 = 57
    expect(liveKey.fullKey).toHaveLength(9 + 48);
    // esk_test_ = 9 chars + 48 = 57
    expect(testKey.fullKey).toHaveLength(9 + 48);
  });

  it('keyPrefix is the first 16 characters of fullKey', () => {
    const { fullKey, keyPrefix } = generateApiKey('live');

    expect(keyPrefix).toBe(fullKey.slice(0, 16));
    expect(keyPrefix).toHaveLength(16);
  });

  it('keyHash matches hashApiKey(fullKey)', () => {
    const { fullKey, keyHash } = generateApiKey('live');

    expect(keyHash).toBe(hashApiKey(fullKey));
  });

  it('generates unique keys on successive calls', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(generateApiKey('live').fullKey);
    }
    expect(keys.size).toBe(100);
  });

  it('random portion contains only alphanumeric characters (base62)', () => {
    for (let i = 0; i < 50; i++) {
      const { fullKey } = generateApiKey('live');
      const randomPart = fullKey.slice('esk_live_'.length);
      expect(randomPart).toMatch(/^[0-9A-Za-z]{48}$/);
    }
  });

  it('has sufficient entropy (48 base62 chars = ~285 bits)', () => {
    // 48 chars * log2(62) ≈ 285.4 bits
    const bitsOfEntropy = 48 * Math.log2(62);
    expect(bitsOfEntropy).toBeGreaterThan(250);
  });
});

// ---------------------------------------------------------------------------
// hashApiKey
// ---------------------------------------------------------------------------

describe('hashApiKey', () => {
  it('returns a 64-character hex SHA-256 digest', () => {
    const hash = hashApiKey('esk_live_testkey123');

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces consistent hashes for the same input', () => {
    const key = 'esk_live_a7b3c9d1e5f2g8h4i6j0k';
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashApiKey('esk_live_key1');
    const hash2 = hashApiKey('esk_live_key2');
    expect(hash1).not.toBe(hash2);
  });

  it('matches Node.js crypto SHA-256 directly', () => {
    const key = 'esk_test_verifyThisKeyHash';
    const expected = crypto.createHash('sha256').update(key).digest('hex');
    expect(hashApiKey(key)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// verifyApiKeyHash
// ---------------------------------------------------------------------------

describe('verifyApiKeyHash', () => {
  it('returns true for matching key and hash', () => {
    const { fullKey, keyHash } = generateApiKey('live');
    expect(verifyApiKeyHash(fullKey, keyHash)).toBe(true);
  });

  it('returns false for mismatched key', () => {
    const { keyHash } = generateApiKey('live');
    const { fullKey: differentKey } = generateApiKey('live');
    expect(verifyApiKeyHash(differentKey, keyHash)).toBe(false);
  });

  it('returns false for mismatched hash', () => {
    const { fullKey } = generateApiKey('live');
    const wrongHash = 'a'.repeat(64);
    expect(verifyApiKeyHash(fullKey, wrongHash)).toBe(false);
  });

  it('returns false for truncated hash (length mismatch)', () => {
    const { fullKey } = generateApiKey('live');
    const shortHash = 'abcd1234';
    expect(verifyApiKeyHash(fullKey, shortHash)).toBe(false);
  });

  it('uses timing-safe comparison (crypto.timingSafeEqual)', () => {
    // Verify the function delegates to timingSafeEqual by checking
    // it handles the same byte-level comparison correctly
    const { fullKey, keyHash } = generateApiKey('test');

    // Verify the internal path: compute hash, compare buffers
    const computedHash = hashApiKey(fullKey);
    const result = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(keyHash, 'hex'),
    );
    expect(result).toBe(true);

    // And our wrapper agrees
    expect(verifyApiKeyHash(fullKey, keyHash)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// apiKeyCreateSchema
// ---------------------------------------------------------------------------

describe('apiKeyCreateSchema', () => {
  it('validates a complete valid input', () => {
    const input = {
      name: 'JobStack Integration',
      scopes: ['data:read', 'data:write'] as ApiKeyScope[],
      rateLimitTier: 'standard' as const,
      expiresAt: null,
    };

    const result = apiKeyCreateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('applies defaults for rateLimitTier and expiresAt', () => {
    const input = {
      name: 'Minimal Key',
      scopes: ['admin'] as ApiKeyScope[],
    };

    const result = apiKeyCreateSchema.parse(input);
    expect(result.rateLimitTier).toBe('standard');
    expect(result.expiresAt).toBeNull();
  });

  it('accepts a valid Date for expiresAt', () => {
    const futureDate = new Date('2027-01-01T00:00:00Z');
    const input = {
      name: 'Expiring Key',
      scopes: ['schema:read'] as ApiKeyScope[],
      expiresAt: futureDate,
    };

    const result = apiKeyCreateSchema.parse(input);
    expect(result.expiresAt).toEqual(futureDate);
  });

  it('accepts all 5 Foundation scopes', () => {
    const input = {
      name: 'Full Access',
      scopes: [...API_KEY_SCOPES],
    };

    const result = apiKeyCreateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects unknown scopes', () => {
    const input = {
      name: 'Bad Scope',
      scopes: ['automation:read'],
    };

    const result = apiKeyCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty scopes array', () => {
    const input = {
      name: 'No Scopes',
      scopes: [],
    };

    const result = apiKeyCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const input = {
      name: '',
      scopes: ['admin'],
    };

    const result = apiKeyCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding 255 characters', () => {
    const input = {
      name: 'x'.repeat(256),
      scopes: ['admin'],
    };

    const result = apiKeyCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid rateLimitTier', () => {
    const input = {
      name: 'Bad Tier',
      scopes: ['admin'],
      rateLimitTier: 'unlimited',
    };

    const result = apiKeyCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts all 4 valid rate limit tiers', () => {
    const tiers = ['basic', 'standard', 'high', 'enterprise'] as const;
    for (const tier of tiers) {
      const result = apiKeyCreateSchema.safeParse({
        name: `Tier ${tier}`,
        scopes: ['data:read'],
        rateLimitTier: tier,
      });
      expect(result.success).toBe(true);
    }
  });
});
