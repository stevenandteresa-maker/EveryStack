import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestSection,
  testTenantIsolation,
} from '@everystack/shared/testing';
import {
  getSectionsByContext,
  getSectionById,
} from '../../data/sections';
import { NotFoundError } from '../../lib/errors';

describe('Section Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('getSectionsByContext — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let userId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          userId = user.id;
          await createTestSection({
            tenantId,
            createdBy: user.id,
            context: 'view_switcher',
          });
        },
        query: async (tenantId) => {
          return getSectionsByContext(tenantId, 'view_switcher', null, userId);
        },
      });
    }, 30_000);
  });

  describe('getSectionById — tenant isolation', () => {
    it('enforces tenant isolation via NotFoundError', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const user = await createTestUser();
      const section = await createTestSection({
        tenantId: tenantA.id,
        createdBy: user.id,
      });

      await expect(
        getSectionById(tenantB.id, section.id),
      ).rejects.toThrow(NotFoundError);

      const result = await getSectionById(tenantA.id, section.id);
      expect(result.id).toBe(section.id);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getSectionsByContext
  // -------------------------------------------------------------------------

  describe('getSectionsByContext', () => {
    it('returns shared sections (userId = null)', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        userId: null,
        context: 'view_switcher',
        name: 'Shared Section',
      });

      const result = await getSectionsByContext(
        tenant.id,
        'view_switcher',
        null,
        user.id,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Shared Section');
      expect(result[0]?.userId).toBeNull();
    }, 30_000);

    it('returns personal sections visible only to creator', async () => {
      const tenant = await createTestTenant();
      const userA = await createTestUser();
      const userB = await createTestUser();

      await createTestSection({
        tenantId: tenant.id,
        createdBy: userA.id,
        userId: userA.id,
        context: 'view_switcher',
        name: 'A Personal',
      });

      await createTestSection({
        tenantId: tenant.id,
        createdBy: userB.id,
        userId: userB.id,
        context: 'view_switcher',
        name: 'B Personal',
      });

      // User A should see their own personal + shared (none), not B's personal
      const resultA = await getSectionsByContext(
        tenant.id,
        'view_switcher',
        null,
        userA.id,
      );
      expect(resultA).toHaveLength(1);
      expect(resultA[0]?.name).toBe('A Personal');

      // User B should see their own personal + shared (none), not A's personal
      const resultB = await getSectionsByContext(
        tenant.id,
        'view_switcher',
        null,
        userB.id,
      );
      expect(resultB).toHaveLength(1);
      expect(resultB[0]?.name).toBe('B Personal');
    }, 30_000);

    it('returns both shared and personal sections for requesting user', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        userId: null,
        context: 'view_switcher',
        name: 'Shared',
        sortOrder: 0,
      });

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        userId: user.id,
        context: 'view_switcher',
        name: 'Personal',
        sortOrder: 1,
      });

      const result = await getSectionsByContext(
        tenant.id,
        'view_switcher',
        null,
        user.id,
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Shared');
      expect(result[1]?.name).toBe('Personal');
    }, 30_000);

    it('filters by context', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        context: 'view_switcher',
        name: 'View Section',
      });

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        context: 'sidebar_tables',
        name: 'Sidebar Section',
      });

      const result = await getSectionsByContext(
        tenant.id,
        'view_switcher',
        null,
        user.id,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('View Section');
    }, 30_000);

    it('filters by contextParentId', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const parentA = '01900000-0000-7000-8000-000000000001';
      const parentB = '01900000-0000-7000-8000-000000000002';

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        context: 'view_switcher',
        contextParentId: parentA,
        name: 'Parent A Section',
      });

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        context: 'view_switcher',
        contextParentId: parentB,
        name: 'Parent B Section',
      });

      const result = await getSectionsByContext(
        tenant.id,
        'view_switcher',
        parentA,
        user.id,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Parent A Section');
    }, 30_000);

    it('returns sections ordered by sortOrder', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        context: 'view_switcher',
        name: 'Third',
        sortOrder: 3,
      });

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        context: 'view_switcher',
        name: 'First',
        sortOrder: 1,
      });

      await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        context: 'view_switcher',
        name: 'Second',
        sortOrder: 2,
      });

      const result = await getSectionsByContext(
        tenant.id,
        'view_switcher',
        null,
        user.id,
      );

      expect(result).toHaveLength(3);
      expect(result[0]?.name).toBe('First');
      expect(result[1]?.name).toBe('Second');
      expect(result[2]?.name).toBe('Third');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getSectionById
  // -------------------------------------------------------------------------

  describe('getSectionById', () => {
    it('returns a section by ID', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const section = await createTestSection({
        tenantId: tenant.id,
        createdBy: user.id,
        name: 'My Section',
      });

      const result = await getSectionById(tenant.id, section.id);

      expect(result.id).toBe(section.id);
      expect(result.name).toBe('My Section');
    }, 30_000);

    it('throws NotFoundError for nonexistent section', async () => {
      const tenant = await createTestTenant();

      await expect(
        getSectionById(tenant.id, '01900000-0000-7000-8000-000000000099'),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });
});
