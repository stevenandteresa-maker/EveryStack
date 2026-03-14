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
  desc,
  count,
  sql,
  records,
  crossLinks,
  crossLinkIndex,
  fields,
  tables,
} from '@everystack/shared/db';
import type { DbRecord, Field, CrossLink } from '@everystack/shared/db';
import { resolveEffectiveRole } from '@everystack/shared/auth';
import { roleAtLeast } from '@everystack/shared/auth';
import type { LinkScopeFilter, LinkScopeCondition } from '@everystack/shared/sync';

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

// ---------------------------------------------------------------------------
// getCrossLinkDefinition
// ---------------------------------------------------------------------------

/**
 * Fetch a single cross-link definition by ID, tenant-scoped.
 */
export async function getCrossLinkDefinition(
  tenantId: string,
  crossLinkId: string,
): Promise<CrossLink | null> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(crossLinks)
    .where(
      and(
        eq(crossLinks.tenantId, tenantId),
        eq(crossLinks.id, crossLinkId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// listCrossLinkDefinitions
// ---------------------------------------------------------------------------

/**
 * List all cross-link definitions where source_table_id = tableId,
 * ordered by created_at.
 */
export async function listCrossLinkDefinitions(
  tenantId: string,
  tableId: string,
): Promise<CrossLink[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(crossLinks)
    .where(
      and(
        eq(crossLinks.tenantId, tenantId),
        eq(crossLinks.sourceTableId, tableId),
      ),
    )
    .orderBy(asc(crossLinks.createdAt));
}

// ---------------------------------------------------------------------------
// getCrossLinksByTarget
// ---------------------------------------------------------------------------

/**
 * Reverse lookup: all cross-link definitions pointing at targetTableId.
 */
export async function getCrossLinksByTarget(
  tenantId: string,
  targetTableId: string,
): Promise<CrossLink[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(crossLinks)
    .where(
      and(
        eq(crossLinks.tenantId, tenantId),
        eq(crossLinks.targetTableId, targetTableId),
      ),
    )
    .orderBy(asc(crossLinks.createdAt));
}

// ---------------------------------------------------------------------------
// validateLinkTarget
// ---------------------------------------------------------------------------

/**
 * Evaluate a single LinkScopeCondition against a record's canonical data.
 */
function evaluateScopeCondition(
  condition: LinkScopeCondition,
  canonicalData: Record<string, unknown>,
): boolean {
  const fieldValue = canonicalData[condition.field_id];

  switch (condition.operator) {
    case 'is_empty':
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
    case 'is_not_empty':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
    case 'contains': {
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.includes(condition.value);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condition.value);
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Evaluate a LinkScopeFilter against a record's canonical data.
 */
function evaluateScopeFilter(
  filter: LinkScopeFilter,
  canonicalData: Record<string, unknown>,
): boolean {
  if (filter.conditions.length === 0) return true;

  if (filter.logic === 'and') {
    return filter.conditions.every((c: LinkScopeCondition) => evaluateScopeCondition(c, canonicalData));
  }
  return filter.conditions.some((c: LinkScopeCondition) => evaluateScopeCondition(c, canonicalData));
}

/**
 * Validates whether a target record is a valid link target for a cross-link.
 *
 * Checks:
 * - Target record exists and belongs to correct target table
 * - Target record is not archived
 * - Scope filter passes
 * - Same-record self-link blocked
 * - Link count under max_links_per_record limit
 */
export async function validateLinkTarget(
  tenantId: string,
  crossLinkId: string,
  targetRecordId: string,
  sourceRecordId?: string,
): Promise<{ valid: boolean; reason?: string }> {
  const db = getDbForTenant(tenantId, 'read');

  // Fetch the cross-link definition
  const definition = await getCrossLinkDefinition(tenantId, crossLinkId);
  if (!definition) {
    return { valid: false, reason: 'Cross-link definition not found' };
  }

  // Same-record self-link check
  if (sourceRecordId && sourceRecordId === targetRecordId) {
    return { valid: false, reason: 'A record cannot link to itself' };
  }

  // Fetch target record
  const targetRows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.tenantId, tenantId),
        eq(records.id, targetRecordId),
      ),
    )
    .limit(1);

  const targetRecord = targetRows[0];
  if (!targetRecord) {
    return { valid: false, reason: 'Target record does not exist' };
  }

  // Verify target belongs to the correct table
  if (targetRecord.tableId !== definition.targetTableId) {
    return { valid: false, reason: 'Target record does not belong to the target table' };
  }

  // Check archived
  if (targetRecord.archivedAt !== null) {
    return { valid: false, reason: 'Target record is archived' };
  }

  // Evaluate scope filter
  if (definition.linkScopeFilter) {
    const filter = definition.linkScopeFilter as unknown as LinkScopeFilter;
    if (filter.conditions && filter.conditions.length > 0) {
      const passes = evaluateScopeFilter(filter, targetRecord.canonicalData);
      if (!passes) {
        return { valid: false, reason: 'Target record does not match scope filter' };
      }
    }
  }

  // Check link count limit (count existing links for the source record)
  if (sourceRecordId) {
    const countResult = await db
      .select({ value: count() })
      .from(crossLinkIndex)
      .where(
        and(
          eq(crossLinkIndex.tenantId, tenantId),
          eq(crossLinkIndex.crossLinkId, crossLinkId),
          eq(crossLinkIndex.sourceRecordId, sourceRecordId),
        ),
      );

    const currentCount = Number(countResult[0]?.value ?? 0);
    if (currentCount >= definition.maxLinksPerRecord) {
      return { valid: false, reason: 'Link count exceeds max_links_per_record limit' };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// checkCrossLinkPermission
// ---------------------------------------------------------------------------

/**
 * Check whether a user has permission for a cross-link operation.
 *
 * - `create` / `structural`: Must be Manager of both tables (same workspace),
 *   or Admin/Owner (cross-workspace).
 * - `operational`: Must be Manager of either table.
 *
 * Uses resolveEffectiveRole() on both source and target table workspaces.
 */
export async function checkCrossLinkPermission(
  tenantId: string,
  userId: string,
  sourceTableId: string,
  targetTableId: string,
  operation: 'create' | 'structural' | 'operational',
): Promise<boolean> {
  const db = getDbForTenant(tenantId, 'read');

  // Look up workspaces for both tables
  const [sourceTable] = await db
    .select({ workspaceId: tables.workspaceId })
    .from(tables)
    .where(
      and(
        eq(tables.tenantId, tenantId),
        eq(tables.id, sourceTableId),
      ),
    )
    .limit(1);

  const [targetTable] = await db
    .select({ workspaceId: tables.workspaceId })
    .from(tables)
    .where(
      and(
        eq(tables.tenantId, tenantId),
        eq(tables.id, targetTableId),
      ),
    )
    .limit(1);

  if (!sourceTable || !targetTable) return false;

  // Resolve effective roles on each workspace
  const sourceRole = await resolveEffectiveRole(userId, tenantId, sourceTable.workspaceId);
  const targetRole = await resolveEffectiveRole(userId, tenantId, targetTable.workspaceId);

  if (operation === 'operational') {
    // Manager of either table suffices
    const sourceOk = sourceRole !== null && roleAtLeast(sourceRole, 'manager');
    const targetOk = targetRole !== null && roleAtLeast(targetRole, 'manager');
    return sourceOk || targetOk;
  }

  // create / structural — need authority over both sides
  const sameWorkspace = sourceTable.workspaceId === targetTable.workspaceId;

  if (sameWorkspace) {
    // Manager of workspace (which covers both tables) is sufficient
    return sourceRole !== null && roleAtLeast(sourceRole, 'manager');
  }

  // Cross-workspace: Admin or Owner required
  // Admin/Owner roles are tenant-level, so resolveEffectiveRole returns them
  // regardless of workspace — checking on either workspace works
  const highestRole = sourceRole ?? targetRole;
  if (!highestRole) return false;
  return roleAtLeast(highestRole, 'admin');
}

// ---------------------------------------------------------------------------
// SearchResult type for searchLinkableRecords
// ---------------------------------------------------------------------------

export interface SearchResult {
  record: DbRecord;
  displayValue: string;
}

// ---------------------------------------------------------------------------
// searchLinkableRecords
// ---------------------------------------------------------------------------

/**
 * Search linkable records on a cross-link's target table using tsvector
 * prefix matching on the target display field. Applies scope filter from
 * the cross-link definition.
 *
 * @see docs/reference/cross-linking.md § Link Picker UX — Search
 */
export async function searchLinkableRecords(
  tenantId: string,
  crossLinkId: string,
  query: string,
  opts?: { limit?: number; offset?: number },
): Promise<SearchResult[]> {
  const db = getDbForTenant(tenantId, 'read');
  const limit = Math.min(opts?.limit ?? 100, 100);
  const offset = opts?.offset ?? 0;

  // Fetch cross-link definition
  const definition = await getCrossLinkDefinition(tenantId, crossLinkId);
  if (!definition) return [];

  // Sanitize query for tsquery: strip special chars and append :* for prefix match
  const sanitized = query.replace(/[^\w\s]/g, '').trim();
  if (sanitized.length === 0) {
    // No meaningful query — return first page of unarchived target records
    const allRows = await db
      .select()
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenantId),
          eq(records.tableId, definition.targetTableId),
          isNull(records.archivedAt),
        ),
      )
      .limit(limit)
      .offset(offset);

    return applySearchScopeFilter(allRows, definition);
  }

  // Build prefix tsquery: "word1:* & word2:*"
  const tsQueryTerms = sanitized
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(' & ');

  // Search using tsvector on the display field within canonical_data JSONB
  const displayFieldId = definition.targetDisplayFieldId;
  const matchingRows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.tenantId, tenantId),
        eq(records.tableId, definition.targetTableId),
        isNull(records.archivedAt),
        sql`to_tsvector('simple', coalesce(${records.canonicalData}->>${displayFieldId}, '')) @@ to_tsquery('simple', ${tsQueryTerms})`,
      ),
    )
    .limit(limit)
    .offset(offset);

  return applySearchScopeFilter(matchingRows, definition);
}

/**
 * Apply the cross-link scope filter to search results and extract display values.
 */
function applySearchScopeFilter(
  rows: DbRecord[],
  definition: CrossLink,
): SearchResult[] {
  const results: SearchResult[] = [];
  const displayFieldId = definition.targetDisplayFieldId;

  for (const row of rows) {
    // Apply scope filter if defined
    if (definition.linkScopeFilter) {
      const filter = definition.linkScopeFilter as unknown as LinkScopeFilter;
      if (filter.conditions && filter.conditions.length > 0) {
        if (!evaluateScopeFilter(filter, row.canonicalData)) {
          continue;
        }
      }
    }

    results.push({
      record: row,
      displayValue: String(row.canonicalData[displayFieldId] ?? ''),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// getRecentLinkedRecords
// ---------------------------------------------------------------------------

/**
 * Get the last N records linked by any user to this cross-link definition,
 * ordered by most recently linked first. Used for the "Recent" section
 * in the Link Picker.
 *
 * @see docs/reference/cross-linking.md § Link Picker UX — Recent Section
 */
export async function getRecentLinkedRecords(
  tenantId: string,
  crossLinkId: string,
  _userId: string,
  limit: number = 5,
): Promise<DbRecord[]> {
  const db = getDbForTenant(tenantId, 'read');

  // Fetch the most recent cross_link_index entries for this definition
  const recentIndexRows = await db
    .select({
      targetRecordId: crossLinkIndex.targetRecordId,
    })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, crossLinkId),
      ),
    )
    .orderBy(desc(crossLinkIndex.createdAt))
    .limit(limit);

  if (recentIndexRows.length === 0) return [];

  // Deduplicate target record IDs (same record may be linked from multiple sources)
  const uniqueTargetIds = [...new Set(recentIndexRows.map((r) => r.targetRecordId))];

  // Fetch the actual target records
  const targetRecords = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.tenantId, tenantId),
        isNull(records.archivedAt),
        inArray(records.id, uniqueTargetIds),
      ),
    );

  // Preserve order from the index query
  const recordMap = new Map(targetRecords.map((r) => [r.id, r]));
  const ordered: DbRecord[] = [];
  for (const id of uniqueTargetIds) {
    const rec = recordMap.get(id);
    if (rec) ordered.push(rec);
  }

  return ordered;
}
