import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestBase,
  testTenantIsolation,
} from '@everystack/shared/testing';
import {
  getConnectionsForTenant,
  getConnectionById,
  getConnectionWithTokens,
  createConnection,
  updateConnectionBase,
  updateConnectionTokens,
} from '@/data/sync-connections';
import { NotFoundError } from '@/lib/errors';

describe('Sync Connection Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('getConnectionsForTenant — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const user = await createTestUser();

      await testTenantIsolation({
        setup: async (tenantId) => {
          await createTestBase({ tenantId, createdBy: user.id });
        },
        query: async (tenantId) => {
          return getConnectionsForTenant(tenantId);
        },
      });
    }, 30_000);
  });

  // getConnectionById tenant isolation is covered by the "throws NotFoundError
  // for cross-tenant access" test in the getConnectionById describe block below.
  // testTenantIsolation() requires array-returning queries; single-item lookups
  // use explicit cross-tenant assertions instead.

  // -------------------------------------------------------------------------
  // getConnectionsForTenant
  // -------------------------------------------------------------------------

  describe('getConnectionsForTenant', () => {
    it('returns connections ordered by createdAt DESC', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestBase({ tenantId: tenant.id, createdBy: user.id, platform: 'airtable' });
      await createTestBase({ tenantId: tenant.id, createdBy: user.id, platform: 'notion' });

      const connections = await getConnectionsForTenant(tenant.id);

      expect(connections.length).toBe(2);
      // Newest first
      expect(connections[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(
        connections[1]!.createdAt.getTime(),
      );
    }, 30_000);

    it('never includes oauthTokens in response', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestBase({
        tenantId: tenant.id,
        createdBy: user.id,
        oauthTokens: { secret: 'should_not_appear' },
      });

      const connections = await getConnectionsForTenant(tenant.id);
      expect(connections.length).toBeGreaterThan(0);

      for (const conn of connections) {
        expect(Object.keys(conn)).not.toContain('oauthTokens');
      }
    }, 30_000);

    it('returns empty array for tenant with no connections', async () => {
      const tenant = await createTestTenant();
      const connections = await getConnectionsForTenant(tenant.id);
      expect(connections).toEqual([]);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getConnectionById
  // -------------------------------------------------------------------------

  describe('getConnectionById', () => {
    it('returns connection detail without tokens', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const base = await createTestBase({
        tenantId: tenant.id,
        createdBy: user.id,
        platform: 'airtable',
        oauthTokens: { secret: 'hidden' },
      });

      const result = await getConnectionById(tenant.id, base.id);

      expect(result.id).toBe(base.id);
      expect(result.platform).toBe('airtable');
      expect(Object.keys(result)).not.toContain('oauthTokens');
    }, 30_000);

    it('throws NotFoundError for non-existent ID', async () => {
      const tenant = await createTestTenant();

      await expect(
        getConnectionById(tenant.id, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);

    it('throws NotFoundError for cross-tenant access', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const user = await createTestUser();

      const base = await createTestBase({
        tenantId: tenantA.id,
        createdBy: user.id,
      });

      await expect(
        getConnectionById(tenantB.id, base.id),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getConnectionWithTokens
  // -------------------------------------------------------------------------

  describe('getConnectionWithTokens', () => {
    it('includes oauthTokens in response', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const encryptedData = { iv: 'test_iv', tag: 'test_tag', ciphertext: 'test_ct', version: 1 };
      const base = await createTestBase({
        tenantId: tenant.id,
        createdBy: user.id,
        oauthTokens: encryptedData,
      });

      const result = await getConnectionWithTokens(tenant.id, base.id);

      expect(result.oauthTokens).toEqual(encryptedData);
    }, 30_000);

    it('throws NotFoundError for wrong tenant', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const user = await createTestUser();

      const base = await createTestBase({
        tenantId: tenantA.id,
        createdBy: user.id,
      });

      await expect(
        getConnectionWithTokens(tenantB.id, base.id),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // createConnection
  // -------------------------------------------------------------------------

  describe('createConnection', () => {
    it('creates a connection and returns the ID', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const encryptedTokens = { iv: 'abc', tag: 'def', ciphertext: 'ghi', version: 1 };
      const id = await createConnection(tenant.id, user.id, 'airtable', encryptedTokens);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      // Verify it was actually saved
      const result = await getConnectionWithTokens(tenant.id, id);
      expect(result.platform).toBe('airtable');
      expect(result.oauthTokens).toEqual(encryptedTokens);
      expect(result.createdBy).toBe(user.id);
      expect(result.syncStatus).toBe('active');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // updateConnectionBase
  // -------------------------------------------------------------------------

  describe('updateConnectionBase', () => {
    it('updates external base ID and name', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const base = await createTestBase({
        tenantId: tenant.id,
        createdBy: user.id,
      });

      await updateConnectionBase(
        tenant.id,
        user.id,
        base.id,
        'appXYZ789',
        'Production Base',
      );

      const updated = await getConnectionById(tenant.id, base.id);
      expect(updated.externalBaseId).toBe('appXYZ789');
      expect(updated.externalBaseName).toBe('Production Base');
    }, 30_000);

    it('throws NotFoundError for non-existent connection', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await expect(
        updateConnectionBase(
          tenant.id,
          user.id,
          '00000000-0000-0000-0000-000000000000',
          'appXYZ',
          'Test',
        ),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);

    it('throws NotFoundError for cross-tenant update', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const user = await createTestUser();

      const base = await createTestBase({
        tenantId: tenantA.id,
        createdBy: user.id,
      });

      await expect(
        updateConnectionBase(tenantB.id, user.id, base.id, 'appXYZ', 'Test'),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // updateConnectionTokens
  // -------------------------------------------------------------------------

  describe('updateConnectionTokens', () => {
    it('updates encrypted tokens', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const base = await createTestBase({
        tenantId: tenant.id,
        createdBy: user.id,
        oauthTokens: { iv: 'old', tag: 'old', ciphertext: 'old', version: 1 },
      });

      const newTokens = { iv: 'new', tag: 'new', ciphertext: 'new', version: 1 };
      await updateConnectionTokens(tenant.id, base.id, newTokens);

      const updated = await getConnectionWithTokens(tenant.id, base.id);
      expect(updated.oauthTokens).toEqual(newTokens);
    }, 30_000);

    it('throws NotFoundError for non-existent connection', async () => {
      const tenant = await createTestTenant();

      await expect(
        updateConnectionTokens(
          tenant.id,
          '00000000-0000-0000-0000-000000000000',
          { iv: 'x', tag: 'x', ciphertext: 'x', version: 1 },
        ),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });
});
