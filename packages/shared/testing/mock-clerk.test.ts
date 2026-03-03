import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  mockClerkSession,
  mockClerkSessionWithUser,
  clearClerkMocks,
  getMockAuthContext,
  getMockRole,
  hasMockSession,
} from './mock-clerk';

// Mock factories to avoid needing a real database
vi.mock('./factories', () => {
  let tenantCount = 0;
  let userCount = 0;
  return {
    createTestTenant: vi.fn((overrides?: { name?: string }) => {
      tenantCount++;
      return Promise.resolve({
        id: `tenant-${tenantCount}`,
        name: overrides?.name ?? `Test Tenant ${tenantCount}`,
        plan: 'professional',
      });
    }),
    createTestUser: vi.fn((overrides?: { tenantId?: string }) => {
      userCount++;
      return Promise.resolve({
        id: `user-${userCount}`,
        email: `user-${userCount}@test.com`,
        tenantId: overrides?.tenantId ?? 'tenant-default',
      });
    }),
  };
});

describe('mock-clerk', { timeout: 10_000 }, () => {
  afterEach(() => {
    clearClerkMocks();
  });

  describe('mockClerkSession', () => {
    it('sets mock auth context with provided values', () => {
      mockClerkSession('tenant-abc', 'user-xyz', 'admin');

      const ctx = getMockAuthContext();
      expect(ctx.tenantId).toBe('tenant-abc');
      expect(ctx.userId).toBe('user-xyz');
      expect(ctx.clerkUserId).toBe('clerk_user-xyz');
    });

    it('defaults role to manager when not specified', () => {
      mockClerkSession('tenant-1', 'user-1');

      expect(getMockRole()).toBe('manager');
    });

    it('supports all five effective roles', () => {
      const roles = ['owner', 'admin', 'manager', 'team_member', 'viewer'] as const;

      for (const role of roles) {
        mockClerkSession('tenant-1', 'user-1', role);
        expect(getMockRole()).toBe(role);
      }
    });

    it('overwrites previous session when called again', () => {
      mockClerkSession('tenant-1', 'user-1', 'viewer');
      mockClerkSession('tenant-2', 'user-2', 'owner');

      const ctx = getMockAuthContext();
      expect(ctx.tenantId).toBe('tenant-2');
      expect(ctx.userId).toBe('user-2');
      expect(getMockRole()).toBe('owner');
    });
  });

  describe('getMockAuthContext', () => {
    it('throws when no session is set', () => {
      expect(() => getMockAuthContext()).toThrow(
        'mockClerkSession() must be called before getMockAuthContext()',
      );
    });

    it('returns the correct ResolvedAuthContext shape', () => {
      mockClerkSession('t-1', 'u-1', 'admin');

      const ctx = getMockAuthContext();
      expect(ctx).toEqual({
        userId: 'u-1',
        tenantId: 't-1',
        clerkUserId: 'clerk_u-1',
      });
    });
  });

  describe('getMockRole', () => {
    it('returns null when no session is set', () => {
      expect(getMockRole()).toBeNull();
    });

    it('returns the configured role', () => {
      mockClerkSession('t-1', 'u-1', 'team_member');
      expect(getMockRole()).toBe('team_member');
    });
  });

  describe('clearClerkMocks', () => {
    it('resets session state so getMockAuthContext throws', () => {
      mockClerkSession('t-1', 'u-1');
      clearClerkMocks();

      expect(() => getMockAuthContext()).toThrow();
    });

    it('resets session state so getMockRole returns null', () => {
      mockClerkSession('t-1', 'u-1', 'admin');
      clearClerkMocks();

      expect(getMockRole()).toBeNull();
    });

    it('resets hasMockSession to false', () => {
      mockClerkSession('t-1', 'u-1');
      expect(hasMockSession()).toBe(true);

      clearClerkMocks();
      expect(hasMockSession()).toBe(false);
    });
  });

  describe('mockClerkSessionWithUser', () => {
    it('auto-creates a tenant and user, sets session', async () => {
      const result = await mockClerkSessionWithUser();

      expect(result.tenant.id).toBeTruthy();
      expect(result.user.id).toBeTruthy();
      expect(result.user.email).toBeTruthy();
      expect(result.role).toBe('manager');

      // Session should be active
      const ctx = getMockAuthContext();
      expect(ctx.tenantId).toBe(result.tenant.id);
      expect(ctx.userId).toBe(result.user.id);
    });

    it('uses provided tenantId instead of creating one', async () => {
      const result = await mockClerkSessionWithUser({ tenantId: 'existing-tenant' });

      expect(result.tenant.id).toBe('existing-tenant');

      const ctx = getMockAuthContext();
      expect(ctx.tenantId).toBe('existing-tenant');
    });

    it('uses provided role override', async () => {
      const result = await mockClerkSessionWithUser({ role: 'owner' });

      expect(result.role).toBe('owner');
      expect(getMockRole()).toBe('owner');
    });

    it('returns entities that match the mock session', async () => {
      const result = await mockClerkSessionWithUser({ role: 'viewer' });

      const ctx = getMockAuthContext();
      expect(ctx.userId).toBe(result.user.id);
      expect(ctx.tenantId).toBe(result.tenant.id);
      expect(getMockRole()).toBe('viewer');
    });
  });

  describe('hasMockSession', () => {
    it('returns false when no session is set', () => {
      expect(hasMockSession()).toBe(false);
    });

    it('returns true after mockClerkSession', () => {
      mockClerkSession('t-1', 'u-1');
      expect(hasMockSession()).toBe(true);
    });
  });
});
