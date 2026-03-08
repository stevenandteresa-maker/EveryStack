/**
 * Sync Dashboard Conflicts — Connection-level conflict data for the dashboard.
 *
 * Fetches pending conflicts scoped to a base connection (via synced_field_mappings)
 * with record and field display names for the Conflicts tab.
 *
 * @see docs/reference/sync-engine.md § Conflict Resolution UX
 */

import {
  getDbForTenant,
  eq,
  and,
  sql,
  syncConflicts,
  syncedFieldMappings,
  records,
  fields,
} from '@everystack/shared/db';
import type { ConflictForDashboard } from '@/components/sync/ConflictsTab';

// Re-export for convenience
export type { ConflictForDashboard };

// ---------------------------------------------------------------------------
// getConflictsForConnection
// ---------------------------------------------------------------------------

/**
 * Fetches pending conflicts for a base connection with display names.
 *
 * Joins sync_conflicts through synced_field_mappings to scope by connection,
 * and through records/fields for display names.
 *
 * @param tenantId - tenant UUID
 * @param baseConnectionId - base_connections.id
 * @returns array of conflicts with record/field names
 */
export async function getConflictsForConnection(
  tenantId: string,
  baseConnectionId: string,
): Promise<ConflictForDashboard[]> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      id: syncConflicts.id,
      recordId: syncConflicts.recordId,
      fieldId: syncConflicts.fieldId,
      localValue: syncConflicts.localValue,
      remoteValue: syncConflicts.remoteValue,
      platform: syncConflicts.platform,
      createdAt: syncConflicts.createdAt,
      // Extract record display name from canonical_data
      recordName: sql<string | null>`
        COALESCE(
          (SELECT value::text FROM jsonb_each_text(${records.canonicalData}) LIMIT 1),
          ${records.id}::text
        )
      `.as('record_name'),
      // Field display name
      fieldName: fields.name,
    })
    .from(syncConflicts)
    .innerJoin(
      syncedFieldMappings,
      and(
        eq(syncedFieldMappings.fieldId, syncConflicts.fieldId),
        eq(syncedFieldMappings.tenantId, syncConflicts.tenantId),
      ),
    )
    .leftJoin(
      records,
      and(
        eq(records.id, syncConflicts.recordId),
        eq(records.tenantId, tenantId),
      ),
    )
    .leftJoin(
      fields,
      and(
        eq(fields.id, syncConflicts.fieldId),
        eq(fields.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(syncConflicts.tenantId, tenantId),
        eq(syncConflicts.status, 'pending'),
        eq(syncedFieldMappings.baseConnectionId, baseConnectionId),
      ),
    )
    .orderBy(sql`${syncConflicts.createdAt} DESC`);

  return rows.map((row) => ({
    id: row.id,
    recordId: row.recordId,
    fieldId: row.fieldId,
    recordName: row.recordName,
    fieldName: row.fieldName,
    localValue: row.localValue,
    remoteValue: row.remoteValue,
    platform: row.platform,
    createdAt: row.createdAt.toISOString(),
  }));
}
