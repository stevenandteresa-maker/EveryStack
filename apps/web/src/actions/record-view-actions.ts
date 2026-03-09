'use server';

/**
 * Server Actions — Record View config mutations.
 *
 * CRUD for record_view_configs: create, update layout, delete, set default.
 *
 * @see docs/reference/tables-and-views.md § Record View
 */

import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  recordViewConfigs,
  portals,
  forms,
  writeAuditLog,
  generateUUIDv7,
} from '@everystack/shared/db';
import type { DrizzleTransaction, RecordViewConfig } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError, NotFoundError, ConflictError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const recordViewFieldLayoutSchema = z.object({
  fieldId: z.string().uuid(),
  columnSpan: z.number().int().min(1).max(4),
  height: z.enum(['auto', 'compact', 'expanded']),
  tab: z.string().nullable(),
});

const recordViewTabSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
});

const recordViewLayoutSchema = z.object({
  columns: z.number().int().min(1).max(4),
  fields: z.array(recordViewFieldLayoutSchema),
  tabs: z.array(recordViewTabSchema),
});

const createRecordViewConfigSchema = z.object({
  tableId: z.string().uuid(),
  name: z.string().min(1).max(255),
  layout: recordViewLayoutSchema,
});

const updateRecordViewConfigSchema = z.object({
  configId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  layout: recordViewLayoutSchema.optional(),
});

const deleteRecordViewConfigSchema = z.object({
  configId: z.string().uuid(),
});

const setDefaultRecordViewConfigSchema = z.object({
  tableId: z.string().uuid(),
  configId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// createRecordViewConfig
// ---------------------------------------------------------------------------

export async function createRecordViewConfig(
  input: z.input<typeof createRecordViewConfigSchema>,
): Promise<RecordViewConfig> {
  const { userId, tenantId } = await getAuthContext();
  const validated = createRecordViewConfigSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');
  const id = generateUUIDv7();

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(recordViewConfigs)
        .values({
          id,
          tenantId,
          tableId: validated.tableId,
          name: validated.name,
          layout: validated.layout as unknown as Record<string, unknown>,
          isDefault: false,
          createdBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record_view_config.created',
        entityType: 'record_view_config',
        entityId: id,
        details: {
          tableId: validated.tableId,
          name: validated.name,
        },
        traceId: getTraceId(),
      });

      return row;
    });

    if (!result) {
      throw new Error('Failed to create record view config');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// updateRecordViewConfig
// ---------------------------------------------------------------------------

export async function updateRecordViewConfig(
  input: z.input<typeof updateRecordViewConfigSchema>,
): Promise<RecordViewConfig> {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateRecordViewConfigSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: recordViewConfigs.id })
        .from(recordViewConfigs)
        .where(
          and(
            eq(recordViewConfigs.tenantId, tenantId),
            eq(recordViewConfigs.id, validated.configId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Record view config not found');
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (validated.name !== undefined) {
        updates.name = validated.name;
      }
      if (validated.layout !== undefined) {
        updates.layout = validated.layout as unknown as Record<string, unknown>;
      }

      const [updated] = await tx
        .update(recordViewConfigs)
        .set(updates)
        .where(
          and(
            eq(recordViewConfigs.tenantId, tenantId),
            eq(recordViewConfigs.id, validated.configId),
          ),
        )
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record_view_config.updated',
        entityType: 'record_view_config',
        entityId: validated.configId,
        details: {
          ...(validated.name !== undefined && { name: validated.name }),
          ...(validated.layout !== undefined && { layoutUpdated: true }),
        },
        traceId: getTraceId(),
      });

      return updated;
    });

    if (!result) {
      throw new Error('Failed to update record view config');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// deleteRecordViewConfig
// ---------------------------------------------------------------------------

export async function deleteRecordViewConfig(
  input: z.input<typeof deleteRecordViewConfigSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = deleteRecordViewConfigSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: recordViewConfigs.id, tableId: recordViewConfigs.tableId })
        .from(recordViewConfigs)
        .where(
          and(
            eq(recordViewConfigs.tenantId, tenantId),
            eq(recordViewConfigs.id, validated.configId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Record view config not found');
      }

      // Check if referenced by portals
      const [portalRef] = await tx
        .select({ id: portals.id })
        .from(portals)
        .where(
          and(
            eq(portals.tenantId, tenantId),
            eq(portals.recordViewConfigId, validated.configId),
          ),
        )
        .limit(1);

      if (portalRef) {
        throw new ConflictError(
          'Cannot delete this config because it is used by a portal.',
        );
      }

      // Check if referenced by forms
      const [formRef] = await tx
        .select({ id: forms.id })
        .from(forms)
        .where(
          and(
            eq(forms.tenantId, tenantId),
            eq(forms.recordViewConfigId, validated.configId),
          ),
        )
        .limit(1);

      if (formRef) {
        throw new ConflictError(
          'Cannot delete this config because it is used by a form.',
        );
      }

      await tx
        .delete(recordViewConfigs)
        .where(
          and(
            eq(recordViewConfigs.tenantId, tenantId),
            eq(recordViewConfigs.id, validated.configId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record_view_config.deleted',
        entityType: 'record_view_config',
        entityId: validated.configId,
        details: {},
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// setDefaultRecordViewConfig
// ---------------------------------------------------------------------------

export async function setDefaultRecordViewConfig(
  input: z.input<typeof setDefaultRecordViewConfigSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = setDefaultRecordViewConfigSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      // Verify the config exists
      const [existing] = await tx
        .select({ id: recordViewConfigs.id })
        .from(recordViewConfigs)
        .where(
          and(
            eq(recordViewConfigs.tenantId, tenantId),
            eq(recordViewConfigs.id, validated.configId),
            eq(recordViewConfigs.tableId, validated.tableId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Record view config not found');
      }

      // Unset prior default for this table
      await tx
        .update(recordViewConfigs)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(recordViewConfigs.tenantId, tenantId),
            eq(recordViewConfigs.tableId, validated.tableId),
            eq(recordViewConfigs.isDefault, true),
          ),
        );

      // Set new default
      await tx
        .update(recordViewConfigs)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(
          and(
            eq(recordViewConfigs.tenantId, tenantId),
            eq(recordViewConfigs.id, validated.configId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record_view_config.set_default',
        entityType: 'record_view_config',
        entityId: validated.configId,
        details: { tableId: validated.tableId },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
