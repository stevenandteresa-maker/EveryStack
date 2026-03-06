/**
 * Tenant Switching — Clerk+Redis Hybrid Model
 *
 * Clerk `setActive()` is the authoritative JWT source (client-side only).
 * Redis is a fast-lookup cache for the active tenant ID.
 *
 * Server-side flow:
 *   1. Validate access via effective_memberships
 *   2. Update Redis cache
 *   3. Return TenantSwitchResult (includes clerkOrgId for client-side setActive)
 *
 * Client-side (Prompt 8-9) will call `clerk.setActive({ organization: clerkOrgId })`
 * after receiving the result. If setActive fails, the client calls
 * `invalidateTenantCacheAction()` to revert.
 *
 * @see docs/reference/navigation.md § Tenant Switching
 */

import { eq, dbRead, tenants } from '@everystack/shared/db';
import { getEffectiveMembershipForTenant } from '@everystack/shared/db';
import { createRedisClient } from '@everystack/shared/redis';
import { webLogger } from '@everystack/shared/logging';
import { NotFoundError } from '@/lib/errors';
import { auth } from '@/lib/auth';
import { resolveUser, resolveTenant } from '@/lib/tenant-resolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantSwitchResult {
  tenantId: string;
  tenantName: string;
  role: string;
  source: 'direct' | 'agency';
  accentColor: string;
  agencyTenantId?: string;
  /** Clerk organization ID for client-side setActive(). Null for personal tenants. */
  clerkOrgId: string | null;
}

// ---------------------------------------------------------------------------
// Redis — lazy singleton
// ---------------------------------------------------------------------------

const REDIS_KEY_PREFIX = 'active_tenant:';
const REDIS_TTL_SECONDS = 86_400; // 24 hours

const logger = webLogger;

let redisClient: ReturnType<typeof createRedisClient> | null = null;

function getRedis(): ReturnType<typeof createRedisClient> {
  if (!redisClient) {
    redisClient = createRedisClient('tenant-cache');
  }
  return redisClient;
}

// ---------------------------------------------------------------------------
// switchTenant
// ---------------------------------------------------------------------------

/**
 * Switch the active tenant for a user.
 *
 * 1. Verify access via effective_memberships view
 * 2. Fetch tenant details (name, branding, clerkOrgId)
 * 3. Update Redis cache
 * 4. Return TenantSwitchResult for client-side setActive()
 *
 * Throws NotFoundError (404) if the user has no access — prevents tenant enumeration.
 */
export async function switchTenant(
  userId: string,
  targetTenantId: string,
): Promise<TenantSwitchResult> {
  // 1. Verify access
  const membership = await getEffectiveMembershipForTenant(userId, targetTenantId);

  if (!membership) {
    throw new NotFoundError('Tenant not found');
  }

  // 2. Fetch tenant details
  const [tenant] = await dbRead
    .select({
      id: tenants.id,
      name: tenants.name,
      settings: tenants.settings,
      clerkOrgId: tenants.clerkOrgId,
    })
    .from(tenants)
    .where(eq(tenants.id, targetTenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  // 3. Update Redis cache (non-fatal on failure)
  try {
    const redis = getRedis();
    await redis.set(
      `${REDIS_KEY_PREFIX}${userId}`,
      targetTenantId,
      'EX',
      REDIS_TTL_SECONDS,
    );
  } catch (error) {
    logger.warn(
      { error, userId, targetTenantId },
      'Redis cache update failed during tenant switch — degraded mode',
    );
  }

  // 4. Build result
  const settings = tenant.settings as {
    branding_accent_color?: string;
  } | null;

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    role: membership.role,
    source: membership.source as 'direct' | 'agency',
    accentColor: settings?.branding_accent_color ?? '#0D9488',
    ...(membership.agencyTenantId
      ? { agencyTenantId: membership.agencyTenantId }
      : {}),
    clerkOrgId: tenant.clerkOrgId ?? null,
  };
}

// ---------------------------------------------------------------------------
// getActiveTenant
// ---------------------------------------------------------------------------

/**
 * Get the currently active tenant ID for a user.
 *
 * 1. Try Redis cache
 * 2. On miss → resolve from Clerk session, populate cache
 * 3. On Redis error → fall back to Clerk-only path
 */
export async function getActiveTenant(userId: string): Promise<string> {
  // 1. Try Redis
  try {
    const redis = getRedis();
    const cached = await redis.get(`${REDIS_KEY_PREFIX}${userId}`);

    if (cached) {
      return cached;
    }
  } catch (error) {
    logger.warn(
      { error, userId },
      'Redis cache read failed — falling back to Clerk session',
    );
  }

  // 2. Cache miss or Redis error — resolve from Clerk session
  const session = await auth();

  if (!session) {
    throw new NotFoundError('No active session');
  }

  const user = await resolveUser(session.userId);
  const resolved = await resolveTenant(user.id, session.clerkOrgId);

  // Populate cache (non-fatal on failure)
  try {
    const redis = getRedis();
    await redis.set(
      `${REDIS_KEY_PREFIX}${userId}`,
      resolved.tenantId,
      'EX',
      REDIS_TTL_SECONDS,
    );
  } catch (error) {
    logger.warn(
      { error, userId },
      'Redis cache populate failed — continuing without cache',
    );
  }

  return resolved.tenantId;
}

// ---------------------------------------------------------------------------
// invalidateTenantCache
// ---------------------------------------------------------------------------

/**
 * Delete the active tenant cache entry for a user.
 * Used by the client as a revert path when Clerk setActive() fails.
 * Redis failure is non-fatal.
 */
export async function invalidateTenantCache(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(`${REDIS_KEY_PREFIX}${userId}`);
  } catch (error) {
    logger.warn(
      { error, userId },
      'Redis cache invalidation failed — non-fatal',
    );
  }
}
