import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestView,
  createTestUser,
  testTenantIsolation,
} from '@everystack/shared/testing';
import {
  getViewsByTable,
  getViewById,
  getDefaultView,
  getUserViewPreferences,
} from '../../data/views';
import { NotFoundError } from '../../lib/errors';

describe('View Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('getViewsByTable — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let tableId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const table = await createTestTable({ tenantId });
          tableId = table.id;
          await createTestView({ tenantId, tableId: table.id });
        },
        query: async (tenantId) => {
          const { sharedViews, myViews } = await getViewsByTable(tenantId, tableId);
          return [...sharedViews, ...myViews];
        },
      });
    }, 30_000);
  });

  describe('getViewById — tenant isolation', () => {
    it('enforces tenant isolation via NotFoundError', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const table = await createTestTable({ tenantId: tenantA.id });
      const view = await createTestView({
        tenantId: tenantA.id,
        tableId: table.id,
      });

      await expect(
        getViewById(tenantB.id, view.id),
      ).rejects.toThrow(NotFoundError);

      const result = await getViewById(tenantA.id, view.id);
      expect(result.id).toBe(view.id);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getViewsByTable — split into shared / my views
  // -------------------------------------------------------------------------

  describe('getViewsByTable', () => {
    it('returns views ordered by position', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Third',
        position: 3,
      });
      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'First',
        position: 1,
      });
      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Second',
        position: 2,
      });

      const { sharedViews } = await getViewsByTable(tenant.id, table.id);

      expect(sharedViews).toHaveLength(3);
      expect(sharedViews[0]?.name).toBe('First');
      expect(sharedViews[1]?.name).toBe('Second');
      expect(sharedViews[2]?.name).toBe('Third');
    }, 30_000);

    it('returns empty arrays for table with no views', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const result = await getViewsByTable(tenant.id, table.id);

      expect(result.sharedViews).toEqual([]);
      expect(result.myViews).toEqual([]);
    }, 30_000);

    it('splits shared and my views correctly', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const user = await createTestUser();

      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Shared Grid',
        isShared: true,
      });
      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'My Grid',
        isShared: false,
        createdBy: user.id,
      });
      // Another user's private view — should not appear in my views
      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Other Private',
        isShared: false,
      });

      const result = await getViewsByTable(tenant.id, table.id, user.id);

      expect(result.sharedViews).toHaveLength(1);
      expect(result.sharedViews[0]?.name).toBe('Shared Grid');
      expect(result.myViews).toHaveLength(1);
      expect(result.myViews[0]?.name).toBe('My Grid');
    }, 30_000);

    it('returns no my views when userId is not provided', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const user = await createTestUser();

      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Private View',
        isShared: false,
        createdBy: user.id,
      });

      const result = await getViewsByTable(tenant.id, table.id);

      expect(result.sharedViews).toEqual([]);
      expect(result.myViews).toEqual([]);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getViewById
  // -------------------------------------------------------------------------

  describe('getViewById', () => {
    it('returns the view with config', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const view = await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Custom Grid',
        viewType: 'grid',
        config: { frozenColumns: 1, density: 'compact' },
      });

      const result = await getViewById(tenant.id, view.id);

      expect(result.id).toBe(view.id);
      expect(result.name).toBe('Custom Grid');
      expect(result.viewType).toBe('grid');
      expect(result.config).toEqual({ frozenColumns: 1, density: 'compact' });
    }, 30_000);

    it('throws NotFoundError for non-existent view', async () => {
      const tenant = await createTestTenant();
      const nonExistentId = crypto.randomUUID();

      await expect(
        getViewById(tenant.id, nonExistentId),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getDefaultView — 4-step fallback chain
  // -------------------------------------------------------------------------

  describe('getDefaultView', () => {
    it('step 1: returns manager-assigned default', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const defaultView = await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Manager Default',
        isShared: true,
        config: { isDefault: true },
        position: 2,
      });

      // Another shared grid at position 1 — should be skipped
      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'First Grid',
        isShared: true,
        viewType: 'grid',
        position: 1,
      });

      const result = await getDefaultView(tenant.id, table.id);

      expect(result.id).toBe(defaultView.id);
      expect(result.name).toBe('Manager Default');
    }, 30_000);

    it('step 2: falls back to first shared grid by position', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Card View',
        isShared: true,
        viewType: 'card',
        position: 1,
      });

      const gridView = await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Grid View',
        isShared: true,
        viewType: 'grid',
        position: 2,
      });

      const result = await getDefaultView(tenant.id, table.id);

      expect(result.id).toBe(gridView.id);
      expect(result.name).toBe('Grid View');
    }, 30_000);

    it('step 3: falls back to first shared view of any type', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const cardView = await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Card Only',
        isShared: true,
        viewType: 'card',
        position: 1,
      });

      // Unshared grid — should be skipped
      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'My Grid',
        isShared: false,
        viewType: 'grid',
        position: 0,
      });

      const result = await getDefaultView(tenant.id, table.id);

      expect(result.id).toBe(cardView.id);
      expect(result.name).toBe('Card Only');
    }, 30_000);

    it('step 4: returns virtual "All Records" grid when no views exist', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const result = await getDefaultView(tenant.id, table.id);

      expect(result.name).toBe('All Records');
      expect(result.viewType).toBe('grid');
      expect(result.isShared).toBe(true);
      expect(result.tableId).toBe(table.id);
      expect(result.tenantId).toBe(tenant.id);
      expect(result.id).toBeDefined();
    }, 30_000);

    it('step 4: returns virtual grid when only unshared views exist', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      await createTestView({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Private View',
        isShared: false,
        viewType: 'grid',
      });

      const result = await getDefaultView(tenant.id, table.id);

      expect(result.name).toBe('All Records');
      expect(result.viewType).toBe('grid');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getUserViewPreferences
  // -------------------------------------------------------------------------

  describe('getUserViewPreferences', () => {
    it('returns null when no preferences exist', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const view = await createTestView({ tenantId: tenant.id, tableId: table.id });
      const user = await createTestUser();

      const result = await getUserViewPreferences(tenant.id, user.id, view.id);

      expect(result).toBeNull();
    }, 30_000);
  });
});
