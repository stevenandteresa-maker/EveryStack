/**
 * Mock Clerk Session Utilities
 *
 * Provides mock auth context for unit and integration tests without
 * hitting Clerk's API. Uses a module-level state pattern compatible
 * with Vitest's vi.mock() hoisting.
 *
 * Usage in test files:
 * ```ts
 * import { mockClerkSession, getMockAuthContext, clearClerkMocks } from '@everystack/testing';
 *
 * vi.mock('@/lib/auth-context', () => ({
 *   getAuthContext: vi.fn(() => Promise.resolve(getMockAuthContext())),
 * }));
 *
 * describe('my feature', () => {
 *   afterEach(() => clearClerkMocks());
 *
 *   it('works as admin', async () => {
 *     mockClerkSession('tenant-1', 'user-1', 'admin');
 *     // ... test code that calls getAuthContext() internally
 *   });
 * });
 * ```
 */

import type { EffectiveRole } from '../auth/roles';
import { createTestTenant, createTestUser } from './factories';

// ---------------------------------------------------------------------------
// Module-level mock state
// ---------------------------------------------------------------------------

interface MockSessionState {
  tenantId: string;
  userId: string;
  clerkUserId: string;
  role: EffectiveRole;
}

let _state: MockSessionState | null = null;

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Set mock auth session values. Call this before any code that reads
 * auth context. Maps to the Phase 1C auth implementation:
 *
 * - `tenantId` → `getAuthContext().tenantId`
 * - `userId` → `getAuthContext().userId`
 * - `role` → `resolveEffectiveRole()` return value
 *
 * @param tenantId - Internal EveryStack tenant UUID
 * @param userId - Internal EveryStack user UUID
 * @param role - Effective role (default: 'manager')
 */
export function mockClerkSession(
  tenantId: string,
  userId: string,
  role: EffectiveRole = 'manager',
): void {
  _state = {
    tenantId,
    userId,
    clerkUserId: `clerk_${userId}`,
    role,
  };
}

/**
 * Returns the mock auth context matching the ResolvedAuthContext shape
 * from `@/lib/auth-context`. Wire this into vi.mock() factories.
 *
 * Throws if `mockClerkSession()` has not been called.
 */
export function getMockAuthContext(): {
  userId: string;
  tenantId: string;
  clerkUserId: string;
} {
  if (!_state) {
    throw new Error(
      'mockClerkSession() must be called before getMockAuthContext(). ' +
        'Set up your mock session in beforeEach or at the start of your test.',
    );
  }

  return {
    userId: _state.userId,
    tenantId: _state.tenantId,
    clerkUserId: _state.clerkUserId,
  };
}

/**
 * Returns the mock effective role. Wire this into vi.mock() factories
 * for `resolveEffectiveRole` from `@everystack/shared/auth`.
 *
 * Returns null if `mockClerkSession()` has not been called.
 */
export function getMockRole(): EffectiveRole | null {
  if (!_state) return null;
  return _state.role;
}

/**
 * Convenience wrapper: auto-creates a test tenant and user via factories,
 * then calls `mockClerkSession()` with the generated IDs.
 *
 * Returns the created entities so tests can reference them.
 */
export async function mockClerkSessionWithUser(
  overrides?: { tenantId?: string; role?: EffectiveRole },
): Promise<{
  tenant: { id: string; name: string };
  user: { id: string; email: string };
  role: EffectiveRole;
}> {
  const role = overrides?.role ?? 'manager';

  let tenant: { id: string; name: string };
  if (overrides?.tenantId) {
    tenant = { id: overrides.tenantId, name: 'Mock Tenant' };
  } else {
    const created = await createTestTenant({ name: 'Mock Session Tenant' });
    tenant = { id: created.id, name: created.name };
  }

  const user = await createTestUser();

  mockClerkSession(tenant.id, user.id, role);

  return { tenant, user: { id: user.id, email: user.email }, role };
}

/**
 * Clear all mock auth state. Call in `afterEach` blocks.
 */
export function clearClerkMocks(): void {
  _state = null;
}

/**
 * Returns true if a mock session is currently active.
 */
export function hasMockSession(): boolean {
  return _state !== null;
}
