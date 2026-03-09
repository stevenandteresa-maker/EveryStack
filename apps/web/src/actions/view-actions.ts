'use server';

/**
 * Server Actions — View configuration and management mutations.
 *
 * Includes view config updates (sorts, filters, groups, columns),
 * view CRUD (create, rename, duplicate, delete), promotion (My → Shared),
 * locking, and user view preferences.
 *
 * @see docs/reference/tables-and-views.md § My Views & Shared Views
 */

import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  sql,
  views,
  fields,
  userViewPreferences,
  writeAuditLog,
  generateUUIDv7,
} from '@everystack/shared/db';
import type { DrizzleTransaction, View } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';
import { resolveEffectiveRole, roleAtLeast } from '@everystack/shared/auth';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const sortLevelSchema = z.object({
  fieldId: z.string().uuid(),
  direction: z.enum(['asc', 'desc']),
});

const filterConditionPatchSchema = z.object({
  id: z.string(),
  fieldId: z.string().uuid(),
  operator: z.string(),
  value: z.unknown(),
});

const filterGroupPatchSchema = z.object({
  id: z.string(),
  logic: z.enum(['and', 'or']),
  conditions: z.array(filterConditionPatchSchema),
});

const filterConfigPatchSchema = z.object({
  logic: z.enum(['and', 'or']),
  conditions: z.array(filterConditionPatchSchema),
  groups: z.array(filterGroupPatchSchema),
});

const groupLevelSchema = z.object({
  fieldId: z.string().uuid(),
  direction: z.enum(['asc', 'desc']),
});

const viewConfigPatchSchema = z.object({
  columns: z
    .array(
      z.object({
        fieldId: z.string().uuid(),
        width: z.number().int().min(60).max(800).optional(),
        visible: z.boolean().optional(),
      }),
    )
    .optional(),
  frozenColumns: z.number().int().min(0).max(5).optional(),
  density: z.enum(['compact', 'medium', 'tall']).optional(),
  isDefault: z.boolean().optional(),
  columnOrder: z.array(z.string().uuid()).optional(),
  columnColors: z.record(z.string().uuid(), z.string()).optional(),
  hidden_fields: z.array(z.string().uuid()).optional(),
  sorts: z.array(sortLevelSchema).optional(),
  filters: filterConfigPatchSchema.optional(),
  groups: z.array(groupLevelSchema).optional(),
  locked: z.boolean().optional(),
});

const updateViewConfigSchema = z.object({
  viewId: z.string().uuid(),
  configPatch: viewConfigPatchSchema,
});

const renameFieldSchema = z.object({
  fieldId: z.string().uuid(),
  name: z.string().min(1).max(255),
});

const createViewSchema = z.object({
  tableId: z.string().uuid(),
  name: z.string().min(1).max(255),
  viewType: z.enum(['grid', 'card']),
  isShared: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()).optional(),
  workspaceId: z.string().uuid().optional(),
});

const renameViewSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().min(1).max(255),
});

const duplicateViewSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().min(1).max(255),
});

const promoteViewSchema = z.object({
  viewId: z.string().uuid(),
  workspaceId: z.string().uuid().optional(),
});

const lockViewSchema = z.object({
  viewId: z.string().uuid(),
  locked: z.boolean(),
  workspaceId: z.string().uuid().optional(),
});

const deleteViewSchema = z.object({
  viewId: z.string().uuid(),
});

const saveUserViewPreferenceSchema = z.object({
  viewId: z.string().uuid(),
  overrides: z.record(z.string(), z.unknown()),
});

const deleteUserViewPreferenceSchema = z.object({
  viewId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// updateViewConfig
// ---------------------------------------------------------------------------

/**
 * Merges a partial config update into the views.config JSONB column.
 *
 * The patch is shallow-merged with the existing config — top-level keys
 * in the patch overwrite existing keys, keys not in the patch are preserved.
 */
export async function updateViewConfig(
  input: z.input<typeof updateViewConfigSchema>,
): Promise<View> {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateViewConfigSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      // Verify view exists
      const [existing] = await tx
        .select({ id: views.id })
        .from(views)
        .where(
          and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('View not found');
      }

      // Merge config patch using jsonb concatenation (||)
      const configPatchJson = JSON.stringify(validated.configPatch);
      const [updated] = await tx
        .update(views)
        .set({
          config: sql`COALESCE(${views.config}, '{}'::jsonb) || ${configPatchJson}::jsonb`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)),
        )
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'view.config_updated',
        entityType: 'view',
        entityId: validated.viewId,
        details: { configPatch: validated.configPatch },
        traceId: getTraceId(),
      });

      return updated;
    });

    if (!result) {
      throw new Error('Failed to update view config');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// createView
// ---------------------------------------------------------------------------

/**
 * Creates a new view for a table.
 *
 * - Any role can create a My View (is_shared = false).
 * - Manager+ required to create a Shared View (is_shared = true).
 */
export async function createView(
  input: z.input<typeof createViewSchema>,
): Promise<View> {
  const { userId, tenantId } = await getAuthContext();
  const validated = createViewSchema.parse(input);

  // Manager+ required for shared views
  if (validated.isShared) {
    const role = await resolveEffectiveRole(userId, tenantId, validated.workspaceId);
    if (!role || !roleAtLeast(role, 'manager')) {
      throw new ForbiddenError("You don't have permission to create shared views.");
    }
  }

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      // Determine position (append at end)
      const existingViews = await tx
        .select({ position: views.position })
        .from(views)
        .where(and(eq(views.tenantId, tenantId), eq(views.tableId, validated.tableId)))
        .orderBy(sql`${views.position} DESC`)
        .limit(1);

      const nextPosition = (existingViews[0]?.position ?? -1) + 1;

      const [created] = await tx
        .insert(views)
        .values({
          id: generateUUIDv7(),
          tenantId,
          tableId: validated.tableId,
          name: validated.name,
          viewType: validated.viewType,
          config: validated.config ?? {},
          permissions: {},
          isShared: validated.isShared,
          publishState: 'live',
          environment: 'live',
          position: nextPosition,
          createdBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'view.created',
        entityType: 'view',
        entityId: created!.id,
        details: {
          name: validated.name,
          viewType: validated.viewType,
          isShared: validated.isShared,
        },
        traceId: getTraceId(),
      });

      return created;
    });

    if (!result) {
      throw new Error('Failed to create view');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// renameView
// ---------------------------------------------------------------------------

export async function renameView(
  input: z.input<typeof renameViewSchema>,
): Promise<View> {
  const { userId, tenantId } = await getAuthContext();
  const validated = renameViewSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(views)
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError('View not found');
      }

      const [updated] = await tx
        .update(views)
        .set({ name: validated.name, updatedAt: new Date() })
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)))
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'view.renamed',
        entityType: 'view',
        entityId: validated.viewId,
        details: { name: validated.name },
        traceId: getTraceId(),
      });

      return updated;
    });

    if (!result) {
      throw new Error('Failed to rename view');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// duplicateView
// ---------------------------------------------------------------------------

export async function duplicateView(
  input: z.input<typeof duplicateViewSchema>,
): Promise<View> {
  const { userId, tenantId } = await getAuthContext();
  const validated = duplicateViewSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(views)
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError('View not found');
      }

      // Determine position (append at end)
      const lastViews = await tx
        .select({ position: views.position })
        .from(views)
        .where(and(eq(views.tenantId, tenantId), eq(views.tableId, existing.tableId)))
        .orderBy(sql`${views.position} DESC`)
        .limit(1);

      const nextPosition = (lastViews[0]?.position ?? -1) + 1;

      const [created] = await tx
        .insert(views)
        .values({
          id: generateUUIDv7(),
          tenantId,
          tableId: existing.tableId,
          name: validated.name,
          viewType: existing.viewType,
          config: existing.config,
          permissions: {},
          isShared: false, // Duplicates are always My Views
          publishState: 'live',
          environment: 'live',
          position: nextPosition,
          createdBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'view.duplicated',
        entityType: 'view',
        entityId: created!.id,
        details: { sourceViewId: validated.viewId, name: validated.name },
        traceId: getTraceId(),
      });

      return created;
    });

    if (!result) {
      throw new Error('Failed to duplicate view');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// promoteView
// ---------------------------------------------------------------------------

/**
 * Promotes a My View to a Shared View. Requires Manager+ role.
 */
export async function promoteView(
  input: z.input<typeof promoteViewSchema>,
): Promise<View> {
  const { userId, tenantId } = await getAuthContext();
  const validated = promoteViewSchema.parse(input);

  const role = await resolveEffectiveRole(userId, tenantId, validated.workspaceId);
  if (!role || !roleAtLeast(role, 'manager')) {
    throw new ForbiddenError("You don't have permission to promote views.");
  }

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(views)
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError('View not found');
      }

      if (existing.isShared) {
        return existing; // Already shared, no-op
      }

      const [updated] = await tx
        .update(views)
        .set({ isShared: true, updatedAt: new Date() })
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)))
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'view.promoted',
        entityType: 'view',
        entityId: validated.viewId,
        details: { name: existing.name },
        traceId: getTraceId(),
      });

      return updated;
    });

    if (!result) {
      throw new Error('Failed to promote view');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// lockView
// ---------------------------------------------------------------------------

/**
 * Locks or unlocks a shared view. Manager+ and must be the creator.
 */
export async function lockView(
  input: z.input<typeof lockViewSchema>,
): Promise<View> {
  const { userId, tenantId } = await getAuthContext();
  const validated = lockViewSchema.parse(input);

  const role = await resolveEffectiveRole(userId, tenantId, validated.workspaceId);
  if (!role || !roleAtLeast(role, 'manager')) {
    throw new ForbiddenError("You don't have permission to lock views.");
  }

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(views)
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError('View not found');
      }

      if (!existing.isShared) {
        throw new ForbiddenError('Only shared views can be locked.');
      }

      if (existing.createdBy !== userId) {
        throw new ForbiddenError('Only the view creator can lock or unlock it.');
      }

      const configPatchJson = JSON.stringify({ locked: validated.locked });
      const [updated] = await tx
        .update(views)
        .set({
          config: sql`COALESCE(${views.config}, '{}'::jsonb) || ${configPatchJson}::jsonb`,
          updatedAt: new Date(),
        })
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)))
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: validated.locked ? 'view.locked' : 'view.unlocked',
        entityType: 'view',
        entityId: validated.viewId,
        details: {},
        traceId: getTraceId(),
      });

      return updated;
    });

    if (!result) {
      throw new Error('Failed to lock view');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// deleteView
// ---------------------------------------------------------------------------

/**
 * Deletes a view. Cannot delete the auto-generated "All Records" default view
 * (config.isDefault === true on the only shared view).
 */
export async function deleteView(
  input: z.input<typeof deleteViewSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = deleteViewSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(views)
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError('View not found');
      }

      // Check if this is the default view — prevent deletion
      const config = existing.config as Record<string, unknown>;
      if (config?.isDefault === true) {
        throw new ForbiddenError('Cannot delete the default view.');
      }

      await tx
        .delete(views)
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)));

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'view.deleted',
        entityType: 'view',
        entityId: validated.viewId,
        details: { name: existing.name },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// saveUserViewPreference
// ---------------------------------------------------------------------------

/**
 * Saves personal overrides for a shared view. Creates or updates.
 */
export async function saveUserViewPreference(
  input: z.input<typeof saveUserViewPreferenceSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = saveUserViewPreferenceSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      // Verify view exists
      const [existing] = await tx
        .select({ id: views.id })
        .from(views)
        .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.viewId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError('View not found');
      }

      // Upsert preference
      const overridesJson = JSON.stringify(validated.overrides);
      await tx
        .insert(userViewPreferences)
        .values({
          id: generateUUIDv7(),
          tenantId,
          viewId: validated.viewId,
          userId,
          overrides: validated.overrides,
        })
        .onConflictDoUpdate({
          target: [userViewPreferences.viewId, userViewPreferences.userId],
          set: {
            overrides: sql`${overridesJson}::jsonb`,
            updatedAt: new Date(),
          },
        });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// deleteUserViewPreference ("Reset to shared")
// ---------------------------------------------------------------------------

/**
 * Removes personal overrides for a shared view, restoring the shared config.
 */
export async function deleteUserViewPreference(
  input: z.input<typeof deleteUserViewPreferenceSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = deleteUserViewPreferenceSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db
      .delete(userViewPreferences)
      .where(
        and(
          eq(userViewPreferences.tenantId, tenantId),
          eq(userViewPreferences.viewId, validated.viewId),
          eq(userViewPreferences.userId, userId),
        ),
      );
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// renameField
// ---------------------------------------------------------------------------

/**
 * Rename a field. Manager+ only — caller must enforce role check.
 */
export async function renameField(
  input: z.input<typeof renameFieldSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = renameFieldSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: fields.id })
        .from(fields)
        .where(
          and(eq(fields.tenantId, tenantId), eq(fields.id, validated.fieldId)),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Field not found');
      }

      await tx
        .update(fields)
        .set({ name: validated.name, updatedAt: new Date() })
        .where(
          and(eq(fields.tenantId, tenantId), eq(fields.id, validated.fieldId)),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'field.renamed',
        entityType: 'field',
        entityId: validated.fieldId,
        details: { name: validated.name },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
