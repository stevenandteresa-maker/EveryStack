'use server';

/**
 * Server Actions — Cross-Link Definition CRUD.
 *
 * Create, update, and delete cross-link definitions that connect
 * tables across workspaces and platforms within a tenant.
 *
 * @see docs/reference/cross-linking.md § Data Model
 * @see docs/reference/cross-linking.md § Creation Constraints
 * @see docs/reference/cross-linking.md § Permissions
 */

import {
  getDbForTenant,
  eq,
  and,
  count,
  inArray,
  sql,
  crossLinks,
  crossLinkIndex,
  fields,
  records,
  tables,
  generateUUIDv7,
  writeAuditLog,
} from '@everystack/shared/db';
import type { DrizzleTransaction, CrossLink } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';
import type { z } from 'zod';
import {
  createCrossLinkSchema,
  updateCrossLinkSchema,
  linkRecordsSchema,
  unlinkRecordsSchema,
  CROSS_LINK_LIMITS,
  extractCrossLinkField,
  setCrossLinkField,
} from '@everystack/shared/sync';
import type {
  UpdateCrossLinkInput,
  CrossLinkFieldValue,
  CrossLinkLinkedRecordEntry,
} from '@everystack/shared/sync';
import {
  checkCrossLinkPermission,
  getCrossLinkDefinition,
  validateLinkTarget,
} from '@/data/cross-links';
import { enqueueCascadeJob } from '@/lib/cross-link-cascade';

// ---------------------------------------------------------------------------
// Structural vs Operational field sets
// ---------------------------------------------------------------------------

const STRUCTURAL_FIELDS = new Set<keyof UpdateCrossLinkInput>([
  'relationshipType',
  'reverseFieldId',
]);

// Operational fields are everything not in STRUCTURAL_FIELDS:
// name, linkScopeFilter, targetDisplayFieldId, cardFields, maxLinksPerRecord, maxDepth

// ---------------------------------------------------------------------------
// createCrossLinkDefinition
// ---------------------------------------------------------------------------

/**
 * Create a new cross-link definition between two tables.
 *
 * - Validates input with createCrossLinkSchema
 * - Enforces tenant boundary on both tables
 * - Enforces MAX_DEFINITIONS_PER_TABLE limit
 * - Checks create permission (Manager of both tables or Admin/Owner)
 * - Optionally creates a reverse field on the target table
 */
export async function createCrossLinkDefinition(
  input: z.input<typeof createCrossLinkSchema>,
): Promise<CrossLink> {
  const { userId, tenantId } = await getAuthContext();
  const validated = createCrossLinkSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  // Verify both tables belong to the tenant
  const [sourceTable] = await db
    .select({ id: tables.id })
    .from(tables)
    .where(and(eq(tables.tenantId, tenantId), eq(tables.id, validated.sourceTableId)))
    .limit(1);

  const [targetTable] = await db
    .select({ id: tables.id })
    .from(tables)
    .where(and(eq(tables.tenantId, tenantId), eq(tables.id, validated.targetTableId)))
    .limit(1);

  if (!sourceTable || !targetTable) {
    throw new ForbiddenError('Source or target table does not belong to this tenant');
  }

  // Enforce MAX_DEFINITIONS_PER_TABLE
  const [defCount] = await db
    .select({ value: count() })
    .from(crossLinks)
    .where(
      and(
        eq(crossLinks.tenantId, tenantId),
        eq(crossLinks.sourceTableId, validated.sourceTableId),
      ),
    );

  if (Number(defCount?.value ?? 0) >= CROSS_LINK_LIMITS.MAX_DEFINITIONS_PER_TABLE) {
    throw new ForbiddenError(
      `Maximum of ${CROSS_LINK_LIMITS.MAX_DEFINITIONS_PER_TABLE} cross-link definitions per table exceeded`,
    );
  }

  // Permission check
  const hasPermission = await checkCrossLinkPermission(
    tenantId,
    userId,
    validated.sourceTableId,
    validated.targetTableId,
    'create',
  );
  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to create this cross-link');
  }

  try {
    const result = await db.transaction(async (tx) => {
      let reverseFieldId = validated.reverseFieldId;

      // Create reverse field on target table if requested
      if (reverseFieldId) {
        const reverseId = generateUUIDv7();
        // Get max sort order on target table
        const [maxSort] = await tx
          .select({ value: sql<number>`COALESCE(MAX(${fields.sortOrder}), -1)` })
          .from(fields)
          .where(
            and(
              eq(fields.tenantId, tenantId),
              eq(fields.tableId, validated.targetTableId),
            ),
          );

        await tx.insert(fields).values({
          id: reverseId,
          tenantId,
          tableId: validated.targetTableId,
          name: `${validated.name} (reverse)`,
          fieldType: 'linked_record',
          config: {
            sourceTableId: validated.sourceTableId,
            crossLinkReverse: true,
          },
          sortOrder: (maxSort?.value ?? 0) + 1,
        });

        reverseFieldId = reverseId;
      }

      const id = generateUUIDv7();
      const [row] = await tx
        .insert(crossLinks)
        .values({
          id,
          tenantId,
          name: validated.name,
          sourceTableId: validated.sourceTableId,
          sourceFieldId: validated.sourceFieldId,
          targetTableId: validated.targetTableId,
          targetDisplayFieldId: validated.targetDisplayFieldId,
          relationshipType: validated.relationshipType,
          reverseFieldId: reverseFieldId ?? null,
          linkScopeFilter: validated.linkScopeFilter as Record<string, unknown> | undefined,
          cardFields: validated.cardFields,
          maxLinksPerRecord: validated.maxLinksPerRecord,
          maxDepth: validated.maxDepth,
          createdBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'cross_link.created',
        entityType: 'cross_link',
        entityId: id,
        details: {
          sourceTableId: validated.sourceTableId,
          targetTableId: validated.targetTableId,
          relationshipType: validated.relationshipType,
        },
        traceId: getTraceId(),
      });

      return row;
    });

    if (!result) {
      throw new Error('Failed to create cross-link definition');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// updateCrossLinkDefinition
// ---------------------------------------------------------------------------

/**
 * Update an existing cross-link definition.
 *
 * Distinguishes structural changes (topology-altering) from operational
 * changes (tuning) and checks the appropriate permission level.
 */
export async function updateCrossLinkDefinition(
  id: string,
  input: z.input<typeof updateCrossLinkSchema>,
): Promise<CrossLink> {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateCrossLinkSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  // Fetch existing definition and verify tenant ownership
  const [existing] = await db
    .select()
    .from(crossLinks)
    .where(and(eq(crossLinks.tenantId, tenantId), eq(crossLinks.id, id)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Cross-link definition not found');
  }

  // Determine if any changed fields are structural
  const changedKeys = Object.keys(validated) as (keyof UpdateCrossLinkInput)[];
  const hasStructuralChange = changedKeys.some((k) => STRUCTURAL_FIELDS.has(k));

  // Check appropriate permission
  const permissionType = hasStructuralChange ? 'structural' : 'operational';
  const hasPermission = await checkCrossLinkPermission(
    tenantId,
    userId,
    existing.sourceTableId,
    existing.targetTableId,
    permissionType,
  );
  if (!hasPermission) {
    throw new ForbiddenError(
      `You do not have permission to make ${permissionType} changes to this cross-link`,
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(crossLinks)
        .set({
          ...(validated.name !== undefined && { name: validated.name }),
          ...(validated.targetDisplayFieldId !== undefined && {
            targetDisplayFieldId: validated.targetDisplayFieldId,
          }),
          ...(validated.relationshipType !== undefined && {
            relationshipType: validated.relationshipType,
          }),
          ...(validated.reverseFieldId !== undefined && {
            reverseFieldId: validated.reverseFieldId,
          }),
          ...(validated.linkScopeFilter !== undefined && {
            linkScopeFilter: validated.linkScopeFilter as Record<string, unknown> | null,
          }),
          ...(validated.cardFields !== undefined && { cardFields: validated.cardFields }),
          ...(validated.maxLinksPerRecord !== undefined && {
            maxLinksPerRecord: validated.maxLinksPerRecord,
          }),
          ...(validated.maxDepth !== undefined && { maxDepth: validated.maxDepth }),
        })
        .where(and(eq(crossLinks.tenantId, tenantId), eq(crossLinks.id, id)))
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'cross_link.updated',
        entityType: 'cross_link',
        entityId: id,
        details: {
          changes: changedKeys,
          permissionType,
        },
        traceId: getTraceId(),
      });

      return updated;
    });

    if (!result) {
      throw new Error('Failed to update cross-link definition');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// deleteCrossLinkDefinition
// ---------------------------------------------------------------------------

/**
 * Delete a cross-link definition and cascade:
 * - Remove all cross_link_index entries (FK cascade)
 * - Clear canonical field values from source records
 * - Delete reverse field if it exists
 * - Delete the cross_links row
 */
export async function deleteCrossLinkDefinition(id: string): Promise<void> {
  const { userId, tenantId } = await getAuthContext();

  const db = getDbForTenant(tenantId, 'write');

  // Fetch existing definition and verify tenant ownership
  const [existing] = await db
    .select()
    .from(crossLinks)
    .where(and(eq(crossLinks.tenantId, tenantId), eq(crossLinks.id, id)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Cross-link definition not found');
  }

  // Check structural permission (same authority as creation)
  const hasPermission = await checkCrossLinkPermission(
    tenantId,
    userId,
    existing.sourceTableId,
    existing.targetTableId,
    'structural',
  );
  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to delete this cross-link');
  }

  try {
    await db.transaction(async (tx) => {
      // Delete cross_link_index entries (FK cascade handles this, but explicit for clarity)
      await tx
        .delete(crossLinkIndex)
        .where(
          and(
            eq(crossLinkIndex.tenantId, tenantId),
            eq(crossLinkIndex.crossLinkId, id),
          ),
        );

      // Clear canonical field values from source records
      // Remove the cross-link field key from canonical_data on all source records
      await tx
        .update(records)
        .set({
          canonicalData: sql`${records.canonicalData} - ${existing.sourceFieldId}`,
        })
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.tableId, existing.sourceTableId),
          ),
        );

      // Delete reverse field if it exists
      if (existing.reverseFieldId) {
        await tx
          .delete(fields)
          .where(
            and(
              eq(fields.tenantId, tenantId),
              eq(fields.id, existing.reverseFieldId),
            ),
          );
      }

      // Delete the cross_links row
      await tx
        .delete(crossLinks)
        .where(and(eq(crossLinks.tenantId, tenantId), eq(crossLinks.id, id)));

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'cross_link.deleted',
        entityType: 'cross_link',
        entityId: id,
        details: {
          sourceTableId: existing.sourceTableId,
          targetTableId: existing.targetTableId,
          reverseFieldId: existing.reverseFieldId,
        },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// linkRecords
// ---------------------------------------------------------------------------

/**
 * Link one or more target records to a source record via a cross-link.
 *
 * - Validates each target via validateLinkTarget (scope filter, existence, self-link)
 * - Enforces max_links_per_record
 * - Inserts cross_link_index entries (ON CONFLICT DO NOTHING for idempotency)
 * - Updates source record's canonical_data with LinkedRecordEntry items
 * - Enqueues display value cascade jobs (stub)
 */
export async function linkRecords(
  input: z.input<typeof linkRecordsSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = linkRecordsSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  // Fetch the cross-link definition and verify tenant ownership
  const definition = await getCrossLinkDefinition(tenantId, validated.crossLinkId);
  if (!definition) {
    throw new NotFoundError('Cross-link definition not found');
  }

  // Validate each target record
  const validTargetIds: string[] = [];
  for (const targetId of validated.targetRecordIds) {
    const result = await validateLinkTarget(
      tenantId,
      validated.crossLinkId,
      targetId,
      validated.sourceRecordId,
    );
    if (!result.valid) {
      throw new ForbiddenError(result.reason ?? 'Invalid link target');
    }
    validTargetIds.push(targetId);
  }

  // Check link count: current + new must not exceed max
  const [countResult] = await db
    .select({ value: count() })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, validated.crossLinkId),
        eq(crossLinkIndex.sourceRecordId, validated.sourceRecordId),
      ),
    );

  const currentCount = Number(countResult?.value ?? 0);
  if (currentCount + validTargetIds.length > definition.maxLinksPerRecord) {
    throw new ForbiddenError(
      `Adding ${validTargetIds.length} links would exceed the limit of ${definition.maxLinksPerRecord} links per record (current: ${currentCount})`,
    );
  }

  try {
    await db.transaction(async (tx) => {
      // Fetch source record for canonical_data update
      const [sourceRecord] = await tx
        .select()
        .from(records)
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.sourceRecordId),
          ),
        )
        .limit(1);

      if (!sourceRecord) {
        throw new NotFoundError('Source record not found');
      }

      // Fetch target records to get display values
      const targetRecords = await tx
        .select()
        .from(records)
        .where(
          and(
            eq(records.tenantId, tenantId),
            inArray(records.id, validTargetIds),
          ),
        );

      const targetRecordMap = new Map(targetRecords.map((r) => [r.id, r]));

      // Batch insert cross_link_index entries (ON CONFLICT DO NOTHING)
      const indexEntries = validTargetIds.map((targetId) => ({
        tenantId,
        crossLinkId: validated.crossLinkId,
        sourceRecordId: validated.sourceRecordId,
        sourceTableId: definition.sourceTableId,
        targetRecordId: targetId,
      }));

      await tx
        .insert(crossLinkIndex)
        .values(indexEntries)
        .onConflictDoNothing();

      // Build new LinkedRecordEntry items from target records
      const now = new Date().toISOString();
      const newEntries: CrossLinkLinkedRecordEntry[] = validTargetIds.map((targetId) => {
        const targetRecord = targetRecordMap.get(targetId);
        const displayValue = targetRecord
          ? String(
              (targetRecord.canonicalData as Record<string, unknown>)[
                definition.targetDisplayFieldId
              ] ?? '',
            )
          : '';

        return {
          record_id: targetId,
          table_id: definition.targetTableId,
          display_value: displayValue,
          _display_updated_at: now,
        };
      });

      // Update source record's canonical_data
      const existingField = extractCrossLinkField(
        sourceRecord.canonicalData,
        definition.sourceFieldId,
      );

      const existingEntries = existingField?.value.linked_records ?? [];

      // Deduplicate: only add entries that don't already exist
      const existingIds = new Set(existingEntries.map((e) => e.record_id));
      const entriesToAdd = newEntries.filter((e) => !existingIds.has(e.record_id));

      const allEntries = [
        ...existingEntries,
        ...entriesToAdd,
      ] as CrossLinkFieldValue['value']['linked_records'];

      const updatedCanonical = setCrossLinkField(
        sourceRecord.canonicalData,
        definition.sourceFieldId,
        {
          type: 'cross_link',
          value: {
            linked_records: allEntries,
            cross_link_id: validated.crossLinkId,
          },
        },
      );

      await tx
        .update(records)
        .set({ canonicalData: updatedCanonical })
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.sourceRecordId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'cross_link.records_linked',
        entityType: 'cross_link',
        entityId: validated.crossLinkId,
        details: {
          sourceRecordId: validated.sourceRecordId,
          record_ids: validTargetIds,
        },
        traceId: getTraceId(),
      });
    });

    // Enqueue cascade jobs for each linked target (outside transaction)
    for (const targetId of validTargetIds) {
      await enqueueCascadeJob(tenantId, targetId, 'high');
    }
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// unlinkRecords
// ---------------------------------------------------------------------------

/**
 * Unlink one or more target records from a source record.
 *
 * - Deletes cross_link_index entries for the specified pairs
 * - Removes unlinked entries from source record's canonical_data
 * - Enqueues display value cascade jobs (stub)
 */
export async function unlinkRecords(
  input: z.input<typeof unlinkRecordsSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = unlinkRecordsSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  // Fetch the cross-link definition and verify tenant ownership
  const definition = await getCrossLinkDefinition(tenantId, validated.crossLinkId);
  if (!definition) {
    throw new NotFoundError('Cross-link definition not found');
  }

  try {
    await db.transaction(async (tx) => {
      // Delete cross_link_index entries for each target
      for (const targetId of validated.targetRecordIds) {
        await tx
          .delete(crossLinkIndex)
          .where(
            and(
              eq(crossLinkIndex.tenantId, tenantId),
              eq(crossLinkIndex.crossLinkId, validated.crossLinkId),
              eq(crossLinkIndex.sourceRecordId, validated.sourceRecordId),
              eq(crossLinkIndex.targetRecordId, targetId),
            ),
          );
      }

      // Fetch source record to update canonical_data
      const [sourceRecord] = await tx
        .select()
        .from(records)
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.sourceRecordId),
          ),
        )
        .limit(1);

      if (!sourceRecord) {
        throw new NotFoundError('Source record not found');
      }

      // Remove unlinked entries from canonical_data
      const existingField = extractCrossLinkField(
        sourceRecord.canonicalData,
        definition.sourceFieldId,
      );

      if (existingField) {
        const unlinkSet = new Set(validated.targetRecordIds);
        const filteredEntries = existingField.value.linked_records.filter(
          (entry) => !unlinkSet.has(entry.record_id),
        );

        const updatedFieldValue: CrossLinkFieldValue = {
          type: 'cross_link',
          value: {
            linked_records: filteredEntries,
            cross_link_id: validated.crossLinkId,
          },
        };

        const updatedCanonical = setCrossLinkField(
          sourceRecord.canonicalData,
          definition.sourceFieldId,
          updatedFieldValue,
        );

        await tx
          .update(records)
          .set({ canonicalData: updatedCanonical })
          .where(
            and(
              eq(records.tenantId, tenantId),
              eq(records.id, validated.sourceRecordId),
            ),
          );
      }

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'cross_link.records_unlinked',
        entityType: 'cross_link',
        entityId: validated.crossLinkId,
        details: {
          sourceRecordId: validated.sourceRecordId,
          record_ids: validated.targetRecordIds,
        },
        traceId: getTraceId(),
      });
    });

    // Enqueue cascade jobs for each unlinked target (outside transaction)
    for (const targetId of validated.targetRecordIds) {
      await enqueueCascadeJob(tenantId, targetId, 'low');
    }
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
