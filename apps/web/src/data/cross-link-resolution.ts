/**
 * Cross-link resolution — L0/L1 query-time resolution and permission intersection.
 *
 * L0: Pure extraction from canonical JSONB (zero DB queries — grid rendering).
 * L1: Single IN query for full linked records (Record View).
 * Permission intersection: card_fields ∩ user's target table permissions.
 *
 * @see docs/reference/cross-linking.md § Query-Time Resolution
 */

import {
  getDbForTenant,
  eq,
  and,
  isNull,
  inArray,
  asc,
  count,
  records,
  crossLinkIndex,
} from '@everystack/shared/db';
import type { DbRecord, CrossLink } from '@everystack/shared/db';
import {
  resolveEffectiveRole,
  resolveAllFieldPermissions,
} from '@everystack/shared/auth';
import type { ResolvedPermissionContext } from '@everystack/shared/auth';
import { extractCrossLinkField } from '@everystack/shared/sync';
import type { CrossLinkFieldValue } from '@everystack/shared/sync';
import { getTableById } from '@/data/tables';
import { getFieldsByTable } from '@/data/fields';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkedRecordResult {
  record: DbRecord;
  crossLinkIndexCreatedAt: Date;
}

export interface LinkedRecordsResponse {
  records: LinkedRecordResult[];
  totalCount: number;
}

// ---------------------------------------------------------------------------
// L0 — Pure canonical extraction (zero DB queries)
// ---------------------------------------------------------------------------

/**
 * Extract a cross-link field value from canonical JSONB.
 *
 * This is what the grid calls — zero database queries. Cost is paid at
 * write time via denormalization of display values.
 */
export function resolveLinkedRecordsL0(
  canonicalData: Record<string, unknown>,
  fieldId: string,
): CrossLinkFieldValue | null {
  return extractCrossLinkField(canonicalData, fieldId);
}

// ---------------------------------------------------------------------------
// L1 — Single IN query for full linked records
// ---------------------------------------------------------------------------

/**
 * Fetch full linked records for a source record + cross-link definition.
 *
 * 1. Query cross_link_index for target record IDs.
 * 2. Single IN query for full target records.
 * 3. Paginated, ordered by index created_at ASC.
 */
export async function resolveLinkedRecordsL1(
  tenantId: string,
  recordId: string,
  crossLinkId: string,
  opts?: { limit?: number; offset?: number },
): Promise<LinkedRecordsResponse> {
  const db = getDbForTenant(tenantId, 'read');
  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;

  // Fetch linked record IDs from index, ordered by creation time
  const indexRows = await db
    .select({
      targetRecordId: crossLinkIndex.targetRecordId,
      createdAt: crossLinkIndex.createdAt,
    })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, crossLinkId),
        eq(crossLinkIndex.sourceRecordId, recordId),
      ),
    )
    .orderBy(asc(crossLinkIndex.createdAt))
    .limit(limit)
    .offset(offset);

  // Total count for pagination
  const countResult = await db
    .select({ value: count() })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, crossLinkId),
        eq(crossLinkIndex.sourceRecordId, recordId),
      ),
    );

  const totalCount = Number(countResult[0]?.value ?? 0);

  if (indexRows.length === 0) {
    return { records: [], totalCount };
  }

  // Single IN query for full target records
  const targetRecordIds = indexRows.map((r) => r.targetRecordId);
  const targetRecords = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.tenantId, tenantId),
        isNull(records.archivedAt),
        inArray(records.id, targetRecordIds),
      ),
    );

  // Preserve index ordering
  const recordMap = new Map(targetRecords.map((r) => [r.id, r]));
  const orderedResults: LinkedRecordResult[] = [];
  for (const indexRow of indexRows) {
    const rec = recordMap.get(indexRow.targetRecordId);
    if (rec) {
      orderedResults.push({
        record: rec,
        crossLinkIndexCreatedAt: indexRow.createdAt,
      });
    }
  }

  return { records: orderedResults, totalCount };
}

// ---------------------------------------------------------------------------
// Permission intersection
// ---------------------------------------------------------------------------

/**
 * Resolve which fields the user may see on linked records.
 *
 * 1. Load card_fields from cross-link definition (display ceiling).
 * 2. Resolve user's field permissions on the target table.
 * 3. Intersect: return field IDs that are BOTH in card_fields AND
 *    the user has at least read_only permission for.
 * 4. If card_fields is empty, use all non-hidden fields.
 */
export async function resolveLinkedRecordPermissions(
  tenantId: string,
  userId: string,
  crossLink: CrossLink,
  targetTableId: string,
): Promise<string[]> {
  // Load target table info for workspace-level role resolution
  const table = await getTableById(tenantId, targetTableId);
  const tableFields = await getFieldsByTable(tenantId, targetTableId);

  // Resolve user's effective role on the target table's workspace
  const effectiveRole = await resolveEffectiveRole(userId, tenantId, table.workspace.id);

  if (!effectiveRole) {
    // No access to target workspace — zero permitted fields
    return [];
  }

  // Build permission context at the table level (no view restriction)
  const fieldPermissions: Record<string, Record<string, unknown>> = {};
  for (const field of tableFields) {
    fieldPermissions[field.id] = (field.permissions ?? {}) as Record<string, unknown>;
  }

  const allFieldIds = tableFields.map((f) => f.id);

  const context: ResolvedPermissionContext = {
    userId,
    effectiveRole,
    tableId: targetTableId,
    viewId: '', // No view context — table-level resolution
    fieldIds: allFieldIds,
    viewFieldOverrides: allFieldIds, // No view filtering — all fields visible
    viewPermissions: {
      roles: [],
      specificUsers: [],
      excludedUsers: [],
      fieldPermissions: {
        roleRestrictions: [],
        individualOverrides: [],
      },
    },
    fieldPermissions,
  };

  const permissionMap = resolveAllFieldPermissions(context);

  // Determine candidate fields: card_fields if defined, else all fields
  const cardFields = crossLink.cardFields as string[] | null;
  const candidateFieldIds =
    cardFields && cardFields.length > 0 ? cardFields : allFieldIds;

  // Intersect: only fields that are both candidates AND at least read_only
  return candidateFieldIds.filter((fieldId) => {
    const state = permissionMap.get(fieldId);
    return state === 'read_write' || state === 'read_only';
  });
}

// ---------------------------------------------------------------------------
// Permission-based field stripping
// ---------------------------------------------------------------------------

/**
 * Strip non-permitted fields from a record's canonical_data.
 *
 * If permittedFieldIds is empty, returns a minimal shape with empty
 * canonical_data — the caller renders this as a "Linked record" label.
 */
export function filterLinkedRecordByPermissions(
  record: DbRecord,
  permittedFieldIds: string[],
): Partial<DbRecord> {
  if (permittedFieldIds.length === 0) {
    return { id: record.id, canonicalData: {} };
  }

  const filteredData: Record<string, unknown> = {};
  for (const fieldId of permittedFieldIds) {
    if (fieldId in record.canonicalData) {
      filteredData[fieldId] = record.canonicalData[fieldId];
    }
  }

  return {
    ...record,
    canonicalData: filteredData,
  };
}
