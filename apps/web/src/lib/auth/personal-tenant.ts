import { eq } from 'drizzle-orm';
import {
  db,
  users,
  tenants,
  tenantMemberships,
  workspaces,
  setTenantContext,
  generateUUIDv7,
} from '@everystack/shared/db';
import type { DrizzleClient } from '@everystack/shared/db';

/**
 * Fixed warm neutral accent color for personal tenants.
 * Stone-500 (#78716C) — never available in the org accent picker.
 */
export const PERSONAL_TENANT_ACCENT_COLOR = '#78716C';

/**
 * Provisions a personal tenant for a user.
 *
 * Creates a new tenant with personal settings, an owner membership,
 * and updates users.personal_tenant_id — all in a single transaction.
 *
 * Idempotent: if users.personal_tenant_id is already set, returns the
 * existing personal tenant ID without making any changes.
 *
 * @param userId - Internal user ID (not Clerk ID)
 * @param userName - Display name, used for the tenant name via i18n key personal_tenant.default_name
 * @param client - Optional Drizzle client for testability
 * @returns The personal tenant ID
 */
export async function provisionPersonalTenant(
  userId: string,
  userName: string,
  client: DrizzleClient = db,
): Promise<string> {
  // Idempotency: check if personal tenant already provisioned
  const [user] = await client
    .select({ personalTenantId: users.personalTenantId })
    .from(users)
    .where(eq(users.id, userId));

  if (user?.personalTenantId) {
    return user.personalTenantId;
  }

  const personalTenantId = generateUUIDv7();

  await client.transaction(async (tx) => {
    // 1. Create personal tenant with warm neutral accent
    // Name uses the i18n key pattern: personal_tenant.default_name
    // Server-side we store the interpolated name; UI can re-render via i18n
    const tenantName = `${userName}'s Workspace`;
    await tx.insert(tenants).values({
      id: personalTenantId,
      name: tenantName,
      plan: 'freelancer',
      settings: {
        personal: true,
        auto_provisioned: true,
        branding_accent_color: PERSONAL_TENANT_ACCENT_COLOR,
      },
    });

    // 2. Set tenant context for RLS-protected inserts
    await setTenantContext(tx, personalTenantId);

    // 3. Create owner membership
    await tx.insert(tenantMemberships).values({
      tenantId: personalTenantId,
      userId,
      role: 'owner',
      status: 'active',
    });

    // 4. Update users.personal_tenant_id in the same transaction
    await tx
      .update(users)
      .set({ personalTenantId: personalTenantId })
      .where(eq(users.id, userId));
  });

  return personalTenantId;
}

/**
 * Checks whether a given tenant is the personal tenant for a specific user.
 *
 * @param tenantId - The tenant to check
 * @param userId - The user whose personal tenant to compare against
 * @param client - Optional Drizzle client for testability
 */
export async function isPersonalTenant(
  tenantId: string,
  userId: string,
  client: DrizzleClient = db,
): Promise<boolean> {
  const [user] = await client
    .select({ personalTenantId: users.personalTenantId })
    .from(users)
    .where(eq(users.id, userId));

  if (!user?.personalTenantId) {
    return false;
  }

  return user.personalTenantId === tenantId;
}

/**
 * Checks whether a personal tenant has at least one workspace.
 * Used for sidebar display rules: personal tenant is hidden in the tenant
 * switcher until it contains at least one workspace.
 *
 * @param tenantId - The personal tenant to check
 * @param client - Optional Drizzle client for testability
 */
export async function hasPersonalWorkspace(
  tenantId: string,
  client: DrizzleClient = db,
): Promise<boolean> {
  const results = await client
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.tenantId, tenantId))
    .limit(1);

  return results.length > 0;
}
