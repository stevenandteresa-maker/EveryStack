/**
 * Sync Schema Changes — Data access functions for the sync_schema_changes table.
 *
 * Provides CRUD for schema mismatch records detected during inbound sync,
 * impact analysis computation, and resolution operations.
 *
 * @see docs/reference/sync-engine.md § Schema Mismatch
 */

import {
  getDbForTenant,
  syncSchemaChanges,
  fields,
  syncedFieldMappings,
  crossLinks,
  automations,
  portals,
  eq,
  and,
  or,
  sql,
} from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchemaChangeImpact {
  /** Formula fields referencing this field */
  formulaCount: number;
  /** Automations with conditions on this field */
  automationCount: number;
  /** Portal data bindings using this field */
  portalFieldCount: number;
  /** Cross-links displaying this field */
  crossLinkCount: number;
}

export interface CreateSchemaChangeInput {
  baseConnectionId: string;
  changeType: 'field_type_changed' | 'field_deleted' | 'field_added' | 'field_renamed';
  fieldId: string | null;
  platformFieldId: string;
  oldSchema: Record<string, unknown> | null;
  newSchema: Record<string, unknown> | null;
  impact?: SchemaChangeImpact;
}

export interface SyncSchemaChangeRow {
  id: string;
  tenantId: string;
  baseConnectionId: string;
  changeType: string;
  fieldId: string | null;
  platformFieldId: string;
  oldSchema: Record<string, unknown> | null;
  newSchema: Record<string, unknown> | null;
  impact: SchemaChangeImpact;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Record a schema change detected during inbound sync.
 */
export async function createSchemaChange(
  tenantId: string,
  change: CreateSchemaChangeInput,
): Promise<SyncSchemaChangeRow> {
  const db = getDbForTenant(tenantId, 'write');

  const rows = await db
    .insert(syncSchemaChanges)
    .values({
      tenantId,
      baseConnectionId: change.baseConnectionId,
      changeType: change.changeType,
      fieldId: change.fieldId,
      platformFieldId: change.platformFieldId,
      oldSchema: change.oldSchema,
      newSchema: change.newSchema,
      impact: (change.impact ?? { formulaCount: 0, automationCount: 0, portalFieldCount: 0, crossLinkCount: 0 }) as unknown as Record<string, unknown>,
      status: 'pending',
    })
    .returning();

  const row = rows[0]!;
  return mapRow(row);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get all schema changes for a connection, ordered newest first.
 * Optionally filter by status.
 */
export async function getSchemaChangesForConnection(
  tenantId: string,
  baseConnectionId: string,
  statusFilter?: 'pending' | 'accepted' | 'rejected',
): Promise<SyncSchemaChangeRow[]> {
  const db = getDbForTenant(tenantId, 'read');

  const conditions = [
    eq(syncSchemaChanges.tenantId, tenantId),
    eq(syncSchemaChanges.baseConnectionId, baseConnectionId),
  ];

  if (statusFilter) {
    conditions.push(eq(syncSchemaChanges.status, statusFilter));
  }

  const rows = await db
    .select()
    .from(syncSchemaChanges)
    .where(and(...conditions))
    .orderBy(sql`${syncSchemaChanges.createdAt} DESC`);

  return rows.map(mapRow);
}

/**
 * Count pending schema changes for a connection (used by dashboard badges).
 */
export async function countPendingSchemaChanges(
  tenantId: string,
  baseConnectionId: string,
): Promise<number> {
  const db = getDbForTenant(tenantId, 'read');

  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(syncSchemaChanges)
    .where(
      and(
        eq(syncSchemaChanges.tenantId, tenantId),
        eq(syncSchemaChanges.baseConnectionId, baseConnectionId),
        eq(syncSchemaChanges.status, 'pending'),
      ),
    );

  return row?.count ?? 0;
}

/**
 * Check if a pending schema change already exists for this field + change type
 * to avoid duplicates on repeated sync cycles.
 */
export async function hasPendingSchemaChange(
  tenantId: string,
  baseConnectionId: string,
  platformFieldId: string,
  changeType: string,
): Promise<boolean> {
  const db = getDbForTenant(tenantId, 'read');

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(syncSchemaChanges)
    .where(
      and(
        eq(syncSchemaChanges.tenantId, tenantId),
        eq(syncSchemaChanges.baseConnectionId, baseConnectionId),
        eq(syncSchemaChanges.platformFieldId, platformFieldId),
        eq(syncSchemaChanges.changeType, changeType),
        eq(syncSchemaChanges.status, 'pending'),
      ),
    );

  return (row?.count ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Accept a schema change — sets status to 'accepted' with resolver info.
 */
export async function acceptSchemaChange(
  tenantId: string,
  changeId: string,
  resolvedBy: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(syncSchemaChanges)
    .set({
      status: 'accepted',
      resolvedAt: new Date(),
      resolvedBy,
    })
    .where(
      and(
        eq(syncSchemaChanges.id, changeId),
        eq(syncSchemaChanges.tenantId, tenantId),
      ),
    );
}

/**
 * Reject a schema change — sets status to 'rejected' with resolver info.
 */
export async function rejectSchemaChange(
  tenantId: string,
  changeId: string,
  resolvedBy: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(syncSchemaChanges)
    .set({
      status: 'rejected',
      resolvedAt: new Date(),
      resolvedBy,
    })
    .where(
      and(
        eq(syncSchemaChanges.id, changeId),
        eq(syncSchemaChanges.tenantId, tenantId),
      ),
    );
}

// ---------------------------------------------------------------------------
// Impact Analysis
// ---------------------------------------------------------------------------

/**
 * Compute downstream impact of a schema change on a field.
 *
 * Counts:
 * - Formula fields referencing this field (fields with fieldType containing
 *   'formula', 'lookup', 'rollup' that reference the field in config)
 * - Automations with trigger/step conditions referencing this field
 * - Portal bindings on tables containing this field
 * - Cross-links using this field as source or target display
 */
export async function computeSchemaChangeImpact(
  tenantId: string,
  fieldId: string,
): Promise<SchemaChangeImpact> {
  const db = getDbForTenant(tenantId, 'read');

  // Get the field's table ID for portal/automation queries
  const [fieldRow] = await db
    .select({ tableId: fields.tableId })
    .from(fields)
    .where(
      and(
        eq(fields.id, fieldId),
        eq(fields.tenantId, tenantId),
      ),
    );

  if (!fieldRow) {
    return { formulaCount: 0, automationCount: 0, portalFieldCount: 0, crossLinkCount: 0 };
  }

  // 1. Formula/lookup/rollup fields that reference this field in their config
  const [formulaRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fields)
    .where(
      and(
        eq(fields.tenantId, tenantId),
        eq(fields.tableId, fieldRow.tableId),
        sql`${fields.fieldType} IN ('formula', 'lookup', 'rollup')`,
        sql`${fields.config}::text LIKE ${'%' + fieldId + '%'}`,
      ),
    );

  // 2. Automations that reference this field in trigger or steps JSON
  const [automationRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(automations)
    .where(
      and(
        eq(automations.tenantId, tenantId),
        or(
          sql`${automations.trigger}::text LIKE ${'%' + fieldId + '%'}`,
          sql`${automations.steps}::text LIKE ${'%' + fieldId + '%'}`,
        ),
      ),
    );

  // 3. Portals on the same table (portal field bindings)
  const [portalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(portals)
    .where(
      and(
        eq(portals.tenantId, tenantId),
        eq(portals.tableId, fieldRow.tableId),
      ),
    );

  // 4. Cross-links referencing this field
  const [crossLinkRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crossLinks)
    .where(
      and(
        eq(crossLinks.tenantId, tenantId),
        or(
          eq(crossLinks.sourceFieldId, fieldId),
          eq(crossLinks.targetDisplayFieldId, fieldId),
        ),
      ),
    );

  return {
    formulaCount: formulaRow?.count ?? 0,
    automationCount: automationRow?.count ?? 0,
    portalFieldCount: portalRow?.count ?? 0,
    crossLinkCount: crossLinkRow?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Field operations for resolution actions
// ---------------------------------------------------------------------------

/**
 * Update a field's type and the corresponding synced_field_mapping.
 * Used when accepting a field_type_changed schema change.
 */
export async function updateFieldTypeFromSchemaChange(
  tenantId: string,
  fieldId: string,
  newFieldType: string,
  newPlatformFieldType: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  // Update the field's type
  await db
    .update(fields)
    .set({ fieldType: newFieldType })
    .where(
      and(
        eq(fields.id, fieldId),
        eq(fields.tenantId, tenantId),
      ),
    );

  // Update the synced_field_mapping type and reset status to active
  await db
    .update(syncedFieldMappings)
    .set({
      externalFieldType: newPlatformFieldType,
      status: 'active',
    })
    .where(
      and(
        eq(syncedFieldMappings.fieldId, fieldId),
        eq(syncedFieldMappings.tenantId, tenantId),
      ),
    );
}

/**
 * Mark a field mapping as disconnected (field no longer syncs).
 * Used when rejecting a field_type_changed schema change.
 */
export async function disconnectFieldMapping(
  tenantId: string,
  fieldId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(syncedFieldMappings)
    .set({ status: 'disconnected' })
    .where(
      and(
        eq(syncedFieldMappings.fieldId, fieldId),
        eq(syncedFieldMappings.tenantId, tenantId),
      ),
    );
}

/**
 * Soft-archive a field — sets archived_at so it's hidden from grid
 * but data is preserved. Also removes from synced_field_mappings.
 * Used for field_deleted → "Archive Field" action.
 */
export async function archiveField(
  tenantId: string,
  fieldId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  // Note: fields table doesn't have archived_at — we use display config to hide
  // and disconnect the mapping so it no longer syncs
  await db
    .update(fields)
    .set({
      display: sql`jsonb_set(COALESCE(${fields.display}, '{}'), '{archived}', 'true')`,
    })
    .where(
      and(
        eq(fields.id, fieldId),
        eq(fields.tenantId, tenantId),
      ),
    );

  await db
    .update(syncedFieldMappings)
    .set({ status: 'disconnected' })
    .where(
      and(
        eq(syncedFieldMappings.fieldId, fieldId),
        eq(syncedFieldMappings.tenantId, tenantId),
      ),
    );
}

/**
 * Rename a field locally.
 * Used when accepting a field_renamed schema change.
 */
export async function renameField(
  tenantId: string,
  fieldId: string,
  newName: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(fields)
    .set({ name: newName })
    .where(
      and(
        eq(fields.id, fieldId),
        eq(fields.tenantId, tenantId),
      ),
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRow(row: Record<string, unknown>): SyncSchemaChangeRow {
  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    baseConnectionId: row.baseConnectionId as string,
    changeType: row.changeType as string,
    fieldId: (row.fieldId as string) ?? null,
    platformFieldId: row.platformFieldId as string,
    oldSchema: (row.oldSchema as Record<string, unknown>) ?? null,
    newSchema: (row.newSchema as Record<string, unknown>) ?? null,
    impact: (row.impact as SchemaChangeImpact) ?? { formulaCount: 0, automationCount: 0, portalFieldCount: 0, crossLinkCount: 0 },
    status: row.status as string,
    createdAt: row.createdAt as Date,
    resolvedAt: (row.resolvedAt as Date) ?? null,
    resolvedBy: (row.resolvedBy as string) ?? null,
  };
}
