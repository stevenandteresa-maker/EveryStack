/**
 * Record View config data access functions.
 *
 * @see docs/reference/tables-and-views.md § Record View
 */

import {
  getDbForTenant,
  eq,
  and,
  asc,
  recordViewConfigs,
  fields,
} from '@everystack/shared/db';
import type { RecordViewConfig } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Layout types (matches schema JSONB shape)
// ---------------------------------------------------------------------------

export interface RecordViewFieldLayout {
  fieldId: string;
  columnSpan: number;
  height: 'auto' | 'compact' | 'expanded';
  tab: string | null;
}

export interface RecordViewTab {
  id: string;
  name: string;
}

export interface RecordViewLayout {
  columns: number;
  fields: RecordViewFieldLayout[];
  tabs: RecordViewTab[];
}

// ---------------------------------------------------------------------------
// getRecordViewConfigs
// ---------------------------------------------------------------------------

/**
 * Fetch all Record View configs for a table.
 */
export async function getRecordViewConfigs(
  tenantId: string,
  tableId: string,
): Promise<RecordViewConfig[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(recordViewConfigs)
    .where(
      and(
        eq(recordViewConfigs.tenantId, tenantId),
        eq(recordViewConfigs.tableId, tableId),
      ),
    )
    .orderBy(asc(recordViewConfigs.createdAt));
}

// ---------------------------------------------------------------------------
// getRecordViewConfigById
// ---------------------------------------------------------------------------

/**
 * Fetch a single Record View config by ID.
 * Throws NotFoundError if not found.
 */
export async function getRecordViewConfigById(
  tenantId: string,
  configId: string,
): Promise<RecordViewConfig> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(recordViewConfigs)
    .where(
      and(
        eq(recordViewConfigs.tenantId, tenantId),
        eq(recordViewConfigs.id, configId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NotFoundError('Record view config not found');
  }

  return row;
}

// ---------------------------------------------------------------------------
// getDefaultRecordViewConfig
// ---------------------------------------------------------------------------

/**
 * Returns the default Record View config for a table.
 *
 * Lookup order:
 * 1. Config with is_default = true
 * 2. Auto-generate a default from all table fields (2-column layout)
 */
export async function getDefaultRecordViewConfig(
  tenantId: string,
  tableId: string,
): Promise<RecordViewConfig> {
  const db = getDbForTenant(tenantId, 'read');

  // Try to find an explicit default
  const defaults = await db
    .select()
    .from(recordViewConfigs)
    .where(
      and(
        eq(recordViewConfigs.tenantId, tenantId),
        eq(recordViewConfigs.tableId, tableId),
        eq(recordViewConfigs.isDefault, true),
      ),
    )
    .limit(1);

  if (defaults[0]) {
    return defaults[0];
  }

  // Fallback: first config for this table
  const first = await db
    .select()
    .from(recordViewConfigs)
    .where(
      and(
        eq(recordViewConfigs.tenantId, tenantId),
        eq(recordViewConfigs.tableId, tableId),
      ),
    )
    .orderBy(asc(recordViewConfigs.createdAt))
    .limit(1);

  if (first[0]) {
    return first[0];
  }

  // Auto-generate from table fields
  return generateDefaultConfig(tenantId, tableId);
}

// ---------------------------------------------------------------------------
// generateDefaultConfig (internal)
// ---------------------------------------------------------------------------

/**
 * Auto-generates a default Record View config from all table fields.
 * Uses a 2-column layout with fields ordered by sort_order.
 *
 * Returns a virtual config object (not persisted until user saves).
 */
async function generateDefaultConfig(
  tenantId: string,
  tableId: string,
): Promise<RecordViewConfig> {
  const db = getDbForTenant(tenantId, 'read');

  const tableFields = await db
    .select()
    .from(fields)
    .where(and(eq(fields.tenantId, tenantId), eq(fields.tableId, tableId)))
    .orderBy(asc(fields.sortOrder));

  const layout: RecordViewLayout = {
    columns: 2,
    fields: tableFields.map((f) => ({
      fieldId: f.id,
      columnSpan: 1,
      height: 'auto' as const,
      tab: null,
    })),
    tabs: [],
  };

  // Return a virtual (unsaved) config
  return {
    id: `auto-${tableId}`,
    tenantId,
    tableId,
    name: 'Default',
    layout: layout as unknown as Record<string, unknown>,
    isDefault: true,
    createdBy: tenantId, // placeholder — auto-generated
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
