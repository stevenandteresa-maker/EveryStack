import { eq, and } from 'drizzle-orm';
import { dbRead } from '../client';
import type { DrizzleClient } from '../client';
import { effectiveMemberships } from '../schema/effective-memberships';
import type { EffectiveMembership } from '../schema/effective-memberships';

/**
 * Returns all effective memberships for a user (direct + agency).
 *
 * This is a cross-tenant query by design — it answers "what tenants
 * can this user access?" Used by auth middleware to resolve access.
 */
export async function getEffectiveMemberships(
  userId: string,
  client: DrizzleClient = dbRead,
): Promise<EffectiveMembership[]> {
  return client
    .select()
    .from(effectiveMemberships)
    .where(eq(effectiveMemberships.userId, userId));
}

/**
 * Returns the user's effective membership in a specific tenant, or null.
 *
 * Checks both direct membership and agency access paths.
 * Returns the first matching row (direct memberships appear before agency).
 */
export async function getEffectiveMembershipForTenant(
  userId: string,
  tenantId: string,
  client: DrizzleClient = dbRead,
): Promise<EffectiveMembership | null> {
  const rows = await client
    .select()
    .from(effectiveMemberships)
    .where(
      and(
        eq(effectiveMemberships.userId, userId),
        eq(effectiveMemberships.tenantId, tenantId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
