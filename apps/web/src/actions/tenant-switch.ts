'use server';

/**
 * Server Actions — Tenant Switching
 *
 * Validates access, updates Redis cache, writes audit log, and returns
 * a TenantSwitchResult that the client uses for Clerk setActive().
 *
 * @see docs/reference/navigation.md § Tenant Switching
 */

import { z } from 'zod';
import { getDbForTenant, writeAuditLog } from '@everystack/shared/db';
import type { DrizzleTransaction } from '@everystack/shared/db';
import { getTraceId } from '@everystack/shared/logging';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import {
  switchTenant,
  invalidateTenantCache,
} from '@/lib/auth/tenant-switch';
import type { TenantSwitchResult } from '@/lib/auth/tenant-switch';

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const switchInputSchema = z.object({
  targetTenantId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// switchTenantAction
// ---------------------------------------------------------------------------

/**
 * Switch the current user's active tenant.
 *
 * 1. Validates input
 * 2. Verifies access + updates Redis via switchTenant()
 * 3. Writes audit log in a DB transaction
 * 4. Returns TenantSwitchResult (client calls Clerk setActive with clerkOrgId)
 */
export async function switchTenantAction(
  targetTenantId: string,
): Promise<TenantSwitchResult> {
  const { userId, tenantId: previousTenantId } = await getAuthContext();
  const { targetTenantId: validatedId } = switchInputSchema.parse({
    targetTenantId,
  });

  try {
    const result = await switchTenant(userId, validatedId);

    // Write audit log in the target tenant's context
    const db = getDbForTenant(result.tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId: result.tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'tenant.switched',
        entityType: 'tenant',
        entityId: result.tenantId,
        details: {
          previousTenantId,
          source: result.source,
        },
        traceId: getTraceId(),
      });
    });

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// invalidateTenantCacheAction
// ---------------------------------------------------------------------------

/**
 * Invalidate the Redis tenant cache for the current user.
 * Used as a revert path when Clerk setActive() fails on the client.
 */
export async function invalidateTenantCacheAction(): Promise<void> {
  const { userId } = await getAuthContext();

  try {
    await invalidateTenantCache(userId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
