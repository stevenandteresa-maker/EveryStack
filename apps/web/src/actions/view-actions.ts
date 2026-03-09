'use server';

/**
 * Server Actions — View configuration mutations.
 *
 * Used by column resize, reorder, freeze, hide, and coloring to persist
 * changes to views.config JSONB.
 *
 * @see docs/reference/tables-and-views.md § Column Behavior
 */

import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  sql,
  views,
  writeAuditLog,
} from '@everystack/shared/db';
import type { DrizzleTransaction, View } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError, NotFoundError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

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
  sorts: z.array(sortLevelSchema).optional(),
  filters: filterConfigPatchSchema.optional(),
  groups: z.array(groupLevelSchema).optional(),
});

const updateViewConfigSchema = z.object({
  viewId: z.string().uuid(),
  configPatch: viewConfigPatchSchema,
});

const renameFieldSchema = z.object({
  fieldId: z.string().uuid(),
  name: z.string().min(1).max(255),
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

  const { fields } = await import('@everystack/shared/db');
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
