import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestApiKey,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { hashApiKey } from '@everystack/shared/db';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  getApiKeyByHash,
} from '@/data/api-keys';
import { NotFoundError } from '@/lib/errors';

describe('API Key Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('listApiKeys — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const user = await createTestUser();

      await testTenantIsolation({
        setup: async (tenantId) => {
          await createTestApiKey({ tenantId, createdBy: user.id });
        },
        query: async (tenantId) => {
          return listApiKeys(tenantId);
        },
      });
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // createApiKey
  // -------------------------------------------------------------------------

  describe('createApiKey', () => {
    it('returns fullKey that hashes to stored keyHash', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const result = await createApiKey(tenant.id, user.id, {
        name: 'Test Key',
        scopes: ['data:read'],
        rateLimitTier: 'standard',
        expiresAt: null,
      });

      // fullKey is returned on creation
      expect(result.fullKey).toBeDefined();
      expect(result.fullKey.startsWith('esk_test_')).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Key');
      expect(result.scopes).toEqual(['data:read']);
      expect(result.rateLimitTier).toBe('standard');
      expect(result.expiresAt).toBeNull();
      expect(result.createdAt).toBeInstanceOf(Date);

      // Hash of fullKey should match what getApiKeyByHash finds
      const computedHash = hashApiKey(result.fullKey);
      const looked = await getApiKeyByHash(computedHash);
      expect(looked).not.toBeNull();
      expect(looked!.id).toBe(result.id);
      expect(looked!.keyHash).toBe(computedHash);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // revokeApiKey
  // -------------------------------------------------------------------------

  describe('revokeApiKey', () => {
    it('sets status to revoked and records revokedAt', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const created = await createApiKey(tenant.id, user.id, {
        name: 'Revoke Me',
        scopes: ['data:read'],
        rateLimitTier: 'standard',
        expiresAt: null,
      });

      await revokeApiKey(tenant.id, user.id, created.id);

      // Verify via list
      const keys = await listApiKeys(tenant.id);
      const revoked = keys.find((k) => k.id === created.id);
      expect(revoked).toBeDefined();
      expect(revoked!.status).toBe('revoked');

      // Verify via hash lookup — revokedAt should be set
      const hashResult = await getApiKeyByHash(hashApiKey(created.fullKey));
      expect(hashResult).not.toBeNull();
      expect(hashResult!.status).toBe('revoked');
      expect(hashResult!.revokedAt).toBeInstanceOf(Date);
    }, 30_000);

    it('throws NotFoundError for non-existent key', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await expect(
        revokeApiKey(tenant.id, user.id, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getApiKeyByHash
  // -------------------------------------------------------------------------

  describe('getApiKeyByHash', () => {
    it('returns correct key record', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const created = await createApiKey(tenant.id, user.id, {
        name: 'Hash Lookup Key',
        scopes: ['data:read', 'data:write'],
        rateLimitTier: 'high',
        expiresAt: null,
      });

      const hash = hashApiKey(created.fullKey);
      const result = await getApiKeyByHash(hash);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
      expect(result!.tenantId).toBe(tenant.id);
      expect(result!.name).toBe('Hash Lookup Key');
      expect(result!.scopes).toEqual(['data:read', 'data:write']);
      expect(result!.rateLimitTier).toBe('high');
      expect(result!.status).toBe('active');
      expect(result!.createdBy).toBe(user.id);
    }, 30_000);

    it('returns null for non-existent hash', async () => {
      const result = await getApiKeyByHash(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result).toBeNull();
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // listApiKeys — security
  // -------------------------------------------------------------------------

  describe('listApiKeys — keyHash exclusion', () => {
    it('never includes keyHash in response', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createApiKey(tenant.id, user.id, {
        name: 'Security Check Key',
        scopes: ['data:read'],
        rateLimitTier: 'standard',
        expiresAt: null,
      });

      const keys = await listApiKeys(tenant.id);
      expect(keys.length).toBeGreaterThan(0);

      for (const key of keys) {
        // Verify keyHash is not present on any returned object
        expect(Object.keys(key)).not.toContain('keyHash');
        // Verify fullKey is not present either
        expect(Object.keys(key)).not.toContain('fullKey');
      }
    }, 30_000);
  });
});
