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
  CROSS_LINK_LIMITS,
} from '@everystack/shared/sync';
import type { UpdateCrossLinkInput } from '@everystack/shared/sync';
import { checkCrossLinkPermission } from '@/data/cross-links';

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
