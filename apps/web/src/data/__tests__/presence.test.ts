/**
 * Integration tests for custom status data functions.
 *
 * Covers: custom status CRUD, auto-clear expiry cleanup,
 * and tenant isolation.
 */

import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestWorkspace,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getDbForTenant, workspaceMemberships, eq, and } from '@everystack/shared/db';

import {
  updateCustomStatus,
  getCustomStatus,
  clearExpiredStatuses,
} from '../presence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupMembership(tenantId?: string) {
  const tenant = tenantId ? { id: tenantId } : await createTestTenant();
  const user = await createTestUser();
  const workspace = await createTestWorkspace({ tenantId: tenant.id });

  // Create workspace membership
  const db = getDbForTenant(tenant.id, 'write');
  await db.insert(workspaceMemberships).values({
    userId: user.id,
    tenantId: tenant.id,
    workspaceId: workspace.id,
    role: 'manager',
  });

  return { tenantId: tenant.id, userId: user.id, workspaceId: workspace.id };
}

// ---------------------------------------------------------------------------
// Custom Status CRUD
// ---------------------------------------------------------------------------

describe('Custom Status Data Functions', () => {
  describe('updateCustomStatus', () => {
    it('sets emoji and text on workspace membership', async () => {
      const { tenantId, userId } = await setupMembership();

      await updateCustomStatus(tenantId, userId, '🏖', 'On vacation');

      const result = await getCustomStatus(tenantId, userId);
      expect(result).toEqual({
        emoji: '🏖',
        text: 'On vacation',
        clearAt: null,
      });
    }, 30_000);

    it('sets auto-clear timestamp', async () => {
      const { tenantId, userId } = await setupMembership();
      const clearAt = new Date(Date.now() + 3_600_000); // 1 hour from now

      await updateCustomStatus(tenantId, userId, '🍕', 'Lunch break', clearAt);

      const result = await getCustomStatus(tenantId, userId);
      expect(result).not.toBeNull();
      expect(result!.emoji).toBe('🍕');
      expect(result!.text).toBe('Lunch break');
      expect(result!.clearAt).toBeInstanceOf(Date);
      expect(result!.clearAt!.getTime()).toBeCloseTo(clearAt.getTime(), -3);
    }, 30_000);

    it('overwrites existing status', async () => {
      const { tenantId, userId } = await setupMembership();

      await updateCustomStatus(tenantId, userId, '🏖', 'On vacation');
      await updateCustomStatus(tenantId, userId, '💻', 'Working from home');

      const result = await getCustomStatus(tenantId, userId);
      expect(result).toEqual({
        emoji: '💻',
        text: 'Working from home',
        clearAt: null,
      });
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getCustomStatus
  // -------------------------------------------------------------------------

  describe('getCustomStatus', () => {
    it('returns null when no status is set', async () => {
      const { tenantId, userId } = await setupMembership();

      const result = await getCustomStatus(tenantId, userId);
      expect(result).toBeNull();
    }, 30_000);

    it('returns null when user has no membership', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const result = await getCustomStatus(tenant.id, user.id);
      expect(result).toBeNull();
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // clearExpiredStatuses
  // -------------------------------------------------------------------------

  describe('clearExpiredStatuses', () => {
    it('clears statuses past their auto-clear time', async () => {
      const { tenantId, userId } = await setupMembership();
      const pastDate = new Date(Date.now() - 60_000); // 1 minute ago

      await updateCustomStatus(tenantId, userId, '🏖', 'On vacation', pastDate);

      // Verify status is set
      let result = await getCustomStatus(tenantId, userId);
      expect(result).not.toBeNull();

      await clearExpiredStatuses();

      // Status should be cleared
      result = await getCustomStatus(tenantId, userId);
      expect(result).toBeNull();
    }, 30_000);

    it('does not clear statuses with future clear time', async () => {
      const { tenantId, userId } = await setupMembership();
      const futureDate = new Date(Date.now() + 3_600_000); // 1 hour from now

      await updateCustomStatus(tenantId, userId, '💻', 'Heads down', futureDate);

      await clearExpiredStatuses();

      const result = await getCustomStatus(tenantId, userId);
      expect(result).not.toBeNull();
      expect(result!.emoji).toBe('💻');
    }, 30_000);

    it('does not clear statuses without a clear time', async () => {
      const { tenantId, userId } = await setupMembership();

      await updateCustomStatus(tenantId, userId, '🏖', 'Permanent status');

      await clearExpiredStatuses();

      const result = await getCustomStatus(tenantId, userId);
      expect(result).not.toBeNull();
      expect(result!.text).toBe('Permanent status');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('enforces tenant isolation on getCustomStatus', async () => {
      await testTenantIsolation({
        setup: async (tenantId) => {
          const { userId } = await setupMembership(tenantId);
          await updateCustomStatus(tenantId, userId, '🏖', 'On vacation');
        },
        query: async (tenantId) => {
          const db = getDbForTenant(tenantId, 'read');
          const rows = await db
            .select()
            .from(workspaceMemberships)
            .where(
              and(
                eq(workspaceMemberships.tenantId, tenantId),
              ),
            );
          return rows.filter((r) => r.statusEmoji !== null);
        },
      });
    }, 30_000);
  });
});
