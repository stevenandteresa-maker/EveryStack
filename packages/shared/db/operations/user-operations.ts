import { eq } from 'drizzle-orm';
import { db } from '../client';
import type { DrizzleClient } from '../client';
import { setTenantContext } from '../rls';
import { generateUUIDv7 } from '../uuid';
import { users } from '../schema/users';
import { tenants } from '../schema/tenants';
import { tenantMemberships } from '../schema/tenant-memberships';
import { workspaces } from '../schema/workspaces';
import { workspaceMemberships } from '../schema/workspace-memberships';

/**
 * Generates a URL-safe slug from a name.
 * Lowercases, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 * Appends a short random suffix for uniqueness.
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Append 6-char hex suffix for uniqueness
  const suffix = generateUUIDv7().replace(/-/g, '').slice(0, 6);
  return base ? `${base}-${suffix}` : suffix;
}

export interface CreateUserWithTenantResult {
  userId: string;
  tenantId: string;
  workspaceId: string;
}

/**
 * Creates a new user, tenant, tenant membership, workspace, and workspace
 * membership in a single database transaction. If any insert fails, the
 * entire operation rolls back.
 *
 * @param params.clerkId  - The Clerk user ID (e.g., "user_xxx")
 * @param params.email    - The user's email address
 * @param params.name     - The user's display name
 * @param client          - Optional Drizzle client for testability (defaults to the primary write client)
 */
export async function createUserWithTenant(
  params: { clerkId: string; email: string; name: string },
  client: DrizzleClient = db,
): Promise<CreateUserWithTenantResult> {
  const { clerkId, email, name } = params;

  const userId = generateUUIDv7();
  const tenantId = generateUUIDv7();
  const workspaceId = generateUUIDv7();

  await client.transaction(async (tx) => {
    // 1. Create user (no RLS — users table has no tenant_id)
    await tx.insert(users).values({
      id: userId,
      clerkId,
      email,
      name,
    });

    // 2. Create tenant (no RLS — tenants table has no tenant_id)
    const tenantName = `${name}'s Workspace`;
    await tx.insert(tenants).values({
      id: tenantId,
      name: tenantName,
      plan: 'freelancer',
    });

    // 3. Set tenant context for RLS-protected tables
    await setTenantContext(tx, tenantId);

    // 4. Create tenant membership (owner, active)
    await tx.insert(tenantMemberships).values({
      tenantId,
      userId,
      role: 'owner',
      status: 'active',
    });

    // 5. Create default workspace
    await tx.insert(workspaces).values({
      id: workspaceId,
      tenantId,
      name: 'My Workspace',
      slug: generateSlug('my-workspace'),
      createdBy: userId,
    });

    // 6. Create workspace membership (manager)
    await tx.insert(workspaceMemberships).values({
      userId,
      tenantId,
      workspaceId,
      role: 'manager',
    });
  });

  return { userId, tenantId, workspaceId };
}

/**
 * Updates a user's email and/or name when Clerk fires a user.updated event.
 * Matches the user by their Clerk ID.
 *
 * @param clerkId - The Clerk user ID to match
 * @param updates - Fields to update (email and/or name)
 * @param client  - Optional Drizzle client for testability
 */
export async function updateUserFromClerk(
  clerkId: string,
  updates: { email?: string; name?: string },
  client: DrizzleClient = db,
): Promise<void> {
  const setValues: Record<string, string> = {};

  if (updates.email !== undefined) {
    setValues.email = updates.email;
  }
  if (updates.name !== undefined) {
    setValues.name = updates.name;
  }

  if (Object.keys(setValues).length === 0) {
    return;
  }

  await client.update(users).set(setValues).where(eq(users.clerkId, clerkId));
}
