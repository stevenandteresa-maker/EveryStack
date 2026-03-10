/**
 * Cross-link data access functions.
 *
 * Queries the cross_link_index for linked record pairs, then fetches
 * target records with their canonical data.
 *
 * @see docs/reference/cross-linking.md
 * @see docs/reference/tables-and-views.md § Inline Sub-Table Display
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
  crossLinks,
  crossLinkIndex,
  fields,
} from '@everystack/shared/db';
import type { DbRecord, Field, CrossLink } from '@everystack/shared/db';

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
  crossLink: CrossLink | null;
  targetFields: Field[];
}

// ---------------------------------------------------------------------------
// getLinkedRecords
// ---------------------------------------------------------------------------

/**
 * Fetch linked records for a specific record + linked record field.
 *
 * 1. Finds the cross_link definition for the given field.
 * 2. Queries cross_link_index for all target record IDs.
 * 3. Fetches the actual target records with canonical data.
 * 4. Fetches target table fields for inline column rendering.
 *
 * Returns empty result if no cross_link definition exists for the field.
 */
export async function getLinkedRecords(
  tenantId: string,
  recordId: string,
  fieldId: string,
  options?: { limit?: number; offset?: number },
): Promise<LinkedRecordsResponse> {
  const db = getDbForTenant(tenantId, 'read');
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  // Find the cross_link definition for this field
  const crossLinkRows = await db
    .select()
    .from(crossLinks)
    .where(
      and(
        eq(crossLinks.tenantId, tenantId),
        eq(crossLinks.sourceFieldId, fieldId),
      ),
    )
    .limit(1);

  const crossLink = crossLinkRows[0] ?? null;
  if (!crossLink) {
    return { records: [], totalCount: 0, crossLink: null, targetFields: [] };
  }

  // Query cross_link_index for linked record IDs
  const indexRows = await db
    .select({
      targetRecordId: crossLinkIndex.targetRecordId,
      createdAt: crossLinkIndex.createdAt,
    })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, crossLink.id),
        eq(crossLinkIndex.sourceRecordId, recordId),
      ),
    )
    .orderBy(asc(crossLinkIndex.createdAt))
    .limit(limit)
    .offset(offset);

  // Count total linked records
  const countResult = await db
    .select({ value: count() })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, crossLink.id),
        eq(crossLinkIndex.sourceRecordId, recordId),
      ),
    );

  const totalCount = Number(countResult[0]?.value ?? 0);

  if (indexRows.length === 0) {
    // Fetch target fields even when no records exist (needed for column headers)
    const targetFields = await db
      .select()
      .from(fields)
      .where(
        and(
          eq(fields.tenantId, tenantId),
          eq(fields.tableId, crossLink.targetTableId),
        ),
      )
      .orderBy(asc(fields.sortOrder));

    return { records: [], totalCount: 0, crossLink, targetFields };
  }

  // Fetch the actual target records
  const targetRecordIds = indexRows.map((r) => r.targetRecordId);
  const targetRecords = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.tenantId, tenantId),
        eq(records.tableId, crossLink.targetTableId),
        isNull(records.archivedAt),
        inArray(records.id, targetRecordIds),
      ),
    );

  // Build a map for ordering results by index order
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

  // Fetch target table fields for column rendering
  const targetFields = await db
    .select()
    .from(fields)
    .where(
      and(
        eq(fields.tenantId, tenantId),
        eq(fields.tableId, crossLink.targetTableId),
      ),
    )
    .orderBy(asc(fields.sortOrder));

  return {
    records: orderedResults,
    totalCount,
    crossLink,
    targetFields,
  };
}

// ---------------------------------------------------------------------------
// getLinkedRecordCount
// ---------------------------------------------------------------------------

/**
 * Returns the count of linked records for a given record + field.
 * Used for grid cell display ("N items").
 */
export async function getLinkedRecordCount(
  tenantId: string,
  recordId: string,
  fieldId: string,
): Promise<number> {
  const db = getDbForTenant(tenantId, 'read');

  // Find the cross_link definition
  const crossLinkRows = await db
    .select({ id: crossLinks.id })
    .from(crossLinks)
    .where(
      and(
        eq(crossLinks.tenantId, tenantId),
        eq(crossLinks.sourceFieldId, fieldId),
      ),
    )
    .limit(1);

  const crossLink = crossLinkRows[0];
  if (!crossLink) return 0;

  const result = await db
    .select({ value: count() })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, crossLink.id),
        eq(crossLinkIndex.sourceRecordId, recordId),
      ),
    );

  return Number(result[0]?.value ?? 0);
}
