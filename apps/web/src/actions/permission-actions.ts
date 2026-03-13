'use server';

/**
 * Server Actions — Permission configuration mutations.
 *
 * Handles view-level role restrictions and field-level global defaults.
 * Only Manager+ can configure view permissions; only Admin+ can change
 * field global permissions.
 *
 * @see docs/reference/permissions.md § Permission Configuration UI
 * @see docs/reference/permissions.md § Permission Storage (JSONB)
 */

import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  views,
  fields,
  writeAuditLog,
} from '@everystack/shared/db';
import type { DrizzleTransaction } from '@everystack/shared/db';
import {
  resolveEffectiveRole,
  roleAtLeast,
  viewPermissionsSchema,
  fieldPermissionsSchema,
} from '@everystack/shared/auth';
import { PermissionDeniedError } from '@everystack/shared/auth';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';
import { invalidatePermissionCache } from '@/data/permissions';
import { publishPermissionUpdate } from '@/lib/realtime/permission-events';

// ---------------------------------------------------------------------------
// Zod schemas — action inputs
// ---------------------------------------------------------------------------

const updateViewPermissionsSchema = z.object({
  viewId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  tableId: z.string().uuid(),
  permissions: viewPermissionsSchema,
});

const updateFieldGlobalPermissionsSchema = z.object({
  fieldId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  tableId: z.string().uuid(),
  permissions: fieldPermissionsSchema,
});

// ---------------------------------------------------------------------------
// updateViewPermissions
// ---------------------------------------------------------------------------

/**
 * Update the permissions JSONB on a Table View.
 *
 * Access: Manager+ can configure Team Member/Viewer restrictions.
 * Admin+ can also configure Manager restrictions.
 * Manager cannot add restrictions targeting the 'manager' role.
 */
export async function updateViewPermissions(
  input: z.input<typeof updateViewPermissionsSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateViewPermissionsSchema.parse(input);

  // Resolve the caller's effective role
  const effectiveRole = await resolveEffectiveRole(
    userId,
    tenantId,
    validated.workspaceId,
  );

  if (!effectiveRole || !roleAtLeast(effectiveRole, 'manager')) {
    throw new PermissionDeniedError(
      "You don't have permission to configure view permissions.",
      {
        action: 'configure_permissions',
        resource: 'view',
        resourceId: validated.viewId,
        requiredRole: 'manager',
      },
    );
  }

  // Hierarchy check: Manager cannot restrict the 'manager' role
  if (!roleAtLeast(effectiveRole, 'admin')) {
    const hasManagerRestrictions = validated.permissions.fieldPermissions
      .roleRestrictions.some((r) => r.role === 'manager');

    if (hasManagerRestrictions) {
      throw new PermissionDeniedError(
        'Only admins can configure permissions for the Manager role.',
        {
          action: 'configure_manager_permissions',
          resource: 'view',
          resourceId: validated.viewId,
          requiredRole: 'admin',
        },
      );
    }
  }

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(views)
        .set({
          permissions: validated.permissions as unknown as Record<string, unknown>,
        })
        .where(
          and(
            eq(views.tenantId, tenantId),
            eq(views.id, validated.viewId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'view.permissions_updated',
        entityType: 'view',
        entityId: validated.viewId,
        details: {
          tableId: validated.tableId,
        },
        traceId: getTraceId(),
      });
    });

    // Invalidate cache + publish real-time event (sequential ordering)
    await invalidatePermissionCache(tenantId, validated.viewId);
    await publishPermissionUpdate(tenantId, validated.viewId, validated.tableId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// updateFieldGlobalPermissions
// ---------------------------------------------------------------------------

/**
 * Update the global permissions JSONB on a field (Layer 1 ceiling).
 *
 * Access: Admin+ only. Changes affect ALL views containing this field.
 * Invalidates caches for every view on the field's table.
 */
export async function updateFieldGlobalPermissions(
  input: z.input<typeof updateFieldGlobalPermissionsSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateFieldGlobalPermissionsSchema.parse(input);

  // Only Admin+ can change field global permissions
  const effectiveRole = await resolveEffectiveRole(
    userId,
    tenantId,
    validated.workspaceId,
  );

  if (!effectiveRole || !roleAtLeast(effectiveRole, 'admin')) {
    throw new PermissionDeniedError(
      "You don't have permission to change field-level permissions.",
      {
        action: 'configure_field_permissions',
        resource: 'field',
        resourceId: validated.fieldId,
        requiredRole: 'admin',
      },
    );
  }

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(fields)
        .set({
          permissions: validated.permissions as unknown as Record<string, unknown>,
        })
        .where(
          and(
            eq(fields.tenantId, tenantId),
            eq(fields.id, validated.fieldId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'field.permissions_updated',
        entityType: 'field',
        entityId: validated.fieldId,
        details: {
          tableId: validated.tableId,
        },
        traceId: getTraceId(),
      });
    });

    // Invalidate ALL view caches on this field's table
    const allViews = await db
      .select({ id: views.id })
      .from(views)
      .where(
        and(
          eq(views.tenantId, tenantId),
          eq(views.tableId, validated.tableId),
        ),
      );

    // Invalidate + publish for each affected view
    await Promise.all(
      allViews.map(async (view) => {
        await invalidatePermissionCache(tenantId, view.id);
        await publishPermissionUpdate(tenantId, view.id, validated.tableId);
      }),
    );
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
