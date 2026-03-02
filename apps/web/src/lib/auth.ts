import { auth as clerkAuth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Clerk-level identity extracted from the session.
 * Maps to internal EveryStack UUIDs via the tenant resolver (separate layer).
 */
export interface AuthContext {
  userId: string;
  clerkOrgId: string | null;
}

/**
 * Extract Clerk session data without enforcing authentication.
 * Returns null if no valid session exists.
 */
export async function auth(): Promise<AuthContext | null> {
  const session = await clerkAuth();

  if (!session.userId) {
    return null;
  }

  return {
    userId: session.userId,
    clerkOrgId: session.orgId ?? null,
  };
}

/**
 * Extract Clerk session data, redirecting to /sign-in if unauthenticated.
 * Use this in Server Components and Server Actions that require a logged-in user.
 */
export async function requireAuth(): Promise<AuthContext> {
  const context = await auth();

  if (!context) {
    redirect('/sign-in');
  }

  return context;
}
