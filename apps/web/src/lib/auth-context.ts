import { requireAuth } from '@/lib/auth';
import { resolveUser, resolveTenant } from '@/lib/tenant-resolver';

/**
 * Fully resolved auth context with internal EveryStack UUIDs.
 * Guaranteed: userId is internal (not Clerk), tenantId is resolved
 * server-side (never from client input), and the user has effective
 * access to this tenant (direct membership or agency relationship).
 */
export interface ResolvedAuthContext {
  /** Internal EveryStack user UUID */
  userId: string;
  /** Internal EveryStack tenant UUID */
  tenantId: string;
  /** Original Clerk user ID (for Clerk API calls only) */
  clerkUserId: string;
  /** Non-null when the user accesses this tenant via agency relationship */
  agencyTenantId: string | null;
}

/**
 * Compose Clerk session validation with tenant resolution to produce
 * a fully resolved auth context.
 *
 * Use this in Server Components, Server Actions, and data access functions
 * that need both identity and tenant scope.
 *
 * - Redirects to /sign-in if unauthenticated (via requireAuth)
 * - Throws NotFoundError (404) if user or tenant cannot be resolved
 * - tenantId is never derived from URL params, query strings, or headers
 * - agencyTenantId is set when user accesses tenant via agency relationship
 */
export async function getAuthContext(): Promise<ResolvedAuthContext> {
  const clerkSession = await requireAuth();

  const user = await resolveUser(clerkSession.userId);
  const resolved = await resolveTenant(user.id, clerkSession.clerkOrgId);

  return {
    userId: user.id,
    tenantId: resolved.tenantId,
    clerkUserId: clerkSession.userId,
    agencyTenantId: resolved.agencyTenantId,
  };
}
