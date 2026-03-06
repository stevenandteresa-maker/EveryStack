'use server';

/**
 * Server Actions — Resolve and undo sync conflict resolutions.
 *
 * resolveConflict: updates sync_conflicts + canonical_data + search_vector +
 *   sync_metadata in a single transaction, emits real-time events, and
 *   enqueues outbound sync when the resolved value differs from platform.
 *
 * undoConflictResolution: reverts a resolution within an 8-second window
 *   using cached state from Redis.
 *
 * @see docs/reference/sync-engine.md § Resolution actions (lines 603–608)
 * @see docs/reference/sync-engine.md § Optimistic Resolution + Undo (lines 733–745)
 */

import { z } from 'zod';
import { requireRole } from '@everystack/shared/auth';
import {
  getDbForTenant,
  records,
  fields as fieldsTable,
  syncConflicts,
  syncedFieldMappings,
  baseConnections,
  eq,
  and,
  isNull,
  buildSearchVector,
  generateUUIDv7,
  writeAuditLog,
} from '@everystack/shared/db';
import type { SearchFieldDefinition } from '@everystack/shared/db';
import { updateLastSyncedValues } from '@everystack/shared/sync';
import type { SyncMetadata } from '@everystack/shared/sync';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import { createEventPublisher } from '@everystack/shared/realtime';
import { createRedisClient } from '@everystack/shared/redis';
import { getAuthContext } from '@/lib/auth-context';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  wrapUnknownError,
} from '@/lib/errors';
import { getQueue } from '@/lib/queue';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Redis singleton (lazy)
// ---------------------------------------------------------------------------

let redisClient: ReturnType<typeof createRedisClient> | null = null;

function getRedis(): ReturnType<typeof createRedisClient> {
  if (!redisClient) {
    redisClient = createRedisClient('web:conflict-resolve');
  }
  return redisClient;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Undo window in seconds. */
const UNDO_TTL_SECONDS = 8;

/** Redis key prefix for undo state. */
const UNDO_KEY_PREFIX = 'conflict-undo:';

/** Outbound sync priority for conflict resolutions (P1 — immediate). */
const RESOLUTION_PRIORITY = 1;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const resolutionEnum = z.enum(['resolved_local', 'resolved_remote', 'resolved_merged']);

const resolveConflictSchema = z.object({
  conflictId: z.string().uuid(),
  resolution: resolutionEnum,
  mergedValue: z.unknown().optional(),
  tableId: z.string().uuid(),
});

const undoConflictResolutionSchema = z.object({
  undoToken: z.string().uuid(),
});

export type ResolveConflictInput = z.input<typeof resolveConflictSchema>;

const bulkResolveConflictsSchema = z.object({
  recordId: z.string().uuid(),
  tableId: z.string().uuid(),
  resolution: resolutionEnum,
});

const bulkResolveTableConflictsSchema = z.object({
  tableId: z.string().uuid(),
  resolution: resolutionEnum,
});

// ---------------------------------------------------------------------------
// Undo cache shape
// ---------------------------------------------------------------------------

interface UndoState {
  conflictId: string;
  recordId: string;
  fieldId: string;
  tableId: string;
  tenantId: string;
  previousCanonicalData: Record<string, unknown>;
  previousSyncMetadata: Record<string, unknown> | null;
  localValue: unknown;
  remoteValue: unknown;
  baseValue: unknown;
  platform: string;
  outboundJobId: string | null;
}

interface BulkUndoState {
  type: 'bulk';
  tableId: string;
  tenantId: string;
  items: UndoState[];
  outboundJobIds: string[];
}

// ---------------------------------------------------------------------------
// resolveConflict
// ---------------------------------------------------------------------------

export async function resolveConflict(
  input: z.input<typeof resolveConflictSchema>,
): Promise<{ success: true; undoToken: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'record', 'update');

  const { conflictId, resolution, mergedValue, tableId } =
    resolveConflictSchema.parse(input);

  // Merged resolution requires a mergedValue
  if (resolution === 'resolved_merged' && mergedValue === undefined) {
    throw new ValidationError('mergedValue is required for merged resolution', {
      conflictId,
    });
  }

  try {
    const db = getDbForTenant(tenantId, 'write');

    // 1. Load the conflict and verify it's pending
    const [conflict] = await db
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.id, conflictId),
          eq(syncConflicts.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!conflict) {
      throw new NotFoundError('Conflict not found', { conflictId });
    }

    if (conflict.status !== 'pending') {
      throw new ValidationError('Conflict is already resolved', {
        conflictId,
        currentStatus: conflict.status,
      });
    }

    // 2. Load the record
    const [record] = await db
      .select({
        tenantId: records.tenantId,
        id: records.id,
        tableId: records.tableId,
        canonicalData: records.canonicalData,
        syncMetadata: records.syncMetadata,
      })
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenantId),
          eq(records.id, conflict.recordId),
          isNull(records.archivedAt),
        ),
      )
      .limit(1);

    if (!record) {
      throw new NotFoundError('Record not found', {
        recordId: conflict.recordId,
      });
    }

    // 3. Determine resolved value
    let resolvedValue: unknown;
    switch (resolution) {
      case 'resolved_local':
        resolvedValue = conflict.localValue;
        break;
      case 'resolved_remote':
        resolvedValue = conflict.remoteValue;
        break;
      case 'resolved_merged':
        resolvedValue = mergedValue;
        break;
    }

    // 4. Build updated canonical data
    const updatedCanonicalData: Record<string, unknown> = {
      ...record.canonicalData,
      [conflict.fieldId]: resolvedValue,
    };

    // 5. Load table fields for search_vector rebuild
    const tableFields = await db
      .select({
        id: fieldsTable.id,
        fieldType: fieldsTable.fieldType,
        isPrimary: fieldsTable.isPrimary,
        config: fieldsTable.config,
      })
      .from(fieldsTable)
      .where(
        and(
          eq(fieldsTable.tenantId, tenantId),
          eq(fieldsTable.tableId, tableId),
        ),
      );

    const searchFieldDefs: SearchFieldDefinition[] = tableFields.map((f) => ({
      id: f.id,
      fieldType: f.fieldType,
      isPrimary: f.isPrimary,
      config: f.config,
    }));

    const searchVectorExpr = buildSearchVector(updatedCanonicalData, searchFieldDefs);

    // 6. Update sync_metadata with the resolved value as last-synced
    const existingMeta = record.syncMetadata as SyncMetadata | null;
    const updatedSyncMetadata = existingMeta
      ? updateLastSyncedValues(existingMeta, [conflict.fieldId], updatedCanonicalData)
      : null;

    // 7. Single transaction: update conflict + record + audit log
    await db.transaction(async (tx) => {
      // Update sync_conflicts status
      await tx
        .update(syncConflicts)
        .set({
          status: resolution,
          resolvedBy: userId,
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(syncConflicts.id, conflictId),
            eq(syncConflicts.tenantId, tenantId),
          ),
        );

      // Update record canonical_data + search_vector + sync_metadata
      await tx
        .update(records)
        .set({
          canonicalData: updatedCanonicalData,
          searchVector: searchVectorExpr as unknown as string,
          ...(updatedSyncMetadata
            ? { syncMetadata: updatedSyncMetadata as unknown as Record<string, unknown> }
            : {}),
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, conflict.recordId),
          ),
        );

      // Audit log
      await writeAuditLog(tx, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'sync_conflict.resolved',
        entityType: 'record',
        entityId: conflict.recordId,
        details: {
          conflictId,
          fieldId: conflict.fieldId,
          resolution,
          previousValue: resolution === 'resolved_local' ? conflict.remoteValue : conflict.localValue,
          resolvedValue,
          platform: conflict.platform,
        },
        traceId: getTraceId() ?? `conflict-resolve:${conflictId}:${Date.now()}`,
      });
    });

    // 8. Emit real-time events
    const redis = getRedis();
    const publisher = createEventPublisher(redis);
    const tableChannel = `table:${tableId}`;

    await publisher.publish({
      tenantId,
      channel: tableChannel,
      event: REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED,
      payload: {
        type: REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED,
        recordId: conflict.recordId,
        fieldId: conflict.fieldId,
        conflictId,
        resolvedValue,
        resolution,
      },
      excludeUserId: userId,
    });

    await publisher.publish({
      tenantId,
      channel: tableChannel,
      event: REALTIME_EVENTS.RECORD_UPDATED,
      payload: {
        recordId: conflict.recordId,
        fields: { [conflict.fieldId]: resolvedValue },
      },
      excludeUserId: userId,
    });

    // 9. Enqueue outbound sync for resolved_local and resolved_merged
    let outboundJobId: string | null = null;

    if (resolution === 'resolved_local' || resolution === 'resolved_merged') {
      const [mapping] = await db
        .select({ baseConnectionId: syncedFieldMappings.baseConnectionId })
        .from(syncedFieldMappings)
        .where(
          and(
            eq(syncedFieldMappings.tenantId, tenantId),
            eq(syncedFieldMappings.tableId, tableId),
            eq(syncedFieldMappings.status, 'active'),
          ),
        )
        .limit(1);

      if (mapping) {
        const [connection] = await db
          .select({
            syncDirection: baseConnections.syncDirection,
            syncStatus: baseConnections.syncStatus,
          })
          .from(baseConnections)
          .where(
            and(
              eq(baseConnections.id, mapping.baseConnectionId),
              eq(baseConnections.tenantId, tenantId),
            ),
          )
          .limit(1);

        if (
          connection &&
          connection.syncDirection !== 'inbound_only' &&
          connection.syncStatus === 'active'
        ) {
          const queue = getQueue('sync:outbound');
          outboundJobId = `outbound:${tenantId}:${conflict.recordId}`;

          await queue.add(
            'outbound-sync',
            {
              tenantId,
              recordId: conflict.recordId,
              tableId,
              baseConnectionId: mapping.baseConnectionId,
              changedFieldIds: [conflict.fieldId],
              editedBy: userId,
              priority: RESOLUTION_PRIORITY,
              traceId:
                getTraceId() ??
                `conflict-resolve:${conflictId}:${Date.now()}`,
              triggeredBy: userId,
            },
            {
              jobId: outboundJobId,
              priority: RESOLUTION_PRIORITY,
            },
          );
        }
      }
    }

    // 10. Cache undo state in Redis with 8-second TTL
    const undoToken = generateUUIDv7();
    const undoState: UndoState = {
      conflictId,
      recordId: conflict.recordId,
      fieldId: conflict.fieldId,
      tableId,
      tenantId,
      previousCanonicalData: record.canonicalData,
      previousSyncMetadata: record.syncMetadata,
      localValue: conflict.localValue,
      remoteValue: conflict.remoteValue,
      baseValue: conflict.baseValue,
      platform: conflict.platform,
      outboundJobId,
    };

    await redis.set(
      `${UNDO_KEY_PREFIX}${undoToken}`,
      JSON.stringify(undoState),
      'EX',
      UNDO_TTL_SECONDS,
    );

    return { success: true, undoToken };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// undoConflictResolution
// ---------------------------------------------------------------------------

export async function undoConflictResolution(
  input: z.input<typeof undoConflictResolutionSchema>,
): Promise<{ success: boolean }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'record', 'update');

  const { undoToken } = undoConflictResolutionSchema.parse(input);

  try {
    const redis = getRedis();
    const key = `${UNDO_KEY_PREFIX}${undoToken}`;

    // 1. Fetch and delete the undo state atomically
    const raw = await redis.get(key);
    if (!raw) {
      return { success: false };
    }
    await redis.del(key);

    const undoState: UndoState = JSON.parse(raw);

    // Verify tenant ownership
    if (undoState.tenantId !== tenantId) {
      throw new ForbiddenError('Cannot undo conflict for another tenant');
    }

    const db = getDbForTenant(tenantId, 'write');

    // 2. Load table fields for search_vector rebuild
    const tableFields = await db
      .select({
        id: fieldsTable.id,
        fieldType: fieldsTable.fieldType,
        isPrimary: fieldsTable.isPrimary,
        config: fieldsTable.config,
      })
      .from(fieldsTable)
      .where(
        and(
          eq(fieldsTable.tenantId, tenantId),
          eq(fieldsTable.tableId, undoState.tableId),
        ),
      );

    const searchFieldDefs: SearchFieldDefinition[] = tableFields.map((f) => ({
      id: f.id,
      fieldType: f.fieldType,
      isPrimary: f.isPrimary,
      config: f.config,
    }));

    const searchVectorExpr = buildSearchVector(
      undoState.previousCanonicalData,
      searchFieldDefs,
    );

    // 3. Revert in a single transaction
    await db.transaction(async (tx) => {
      // Revert sync_conflicts to pending
      await tx
        .update(syncConflicts)
        .set({
          status: 'pending',
          resolvedBy: null,
          resolvedAt: null,
        })
        .where(
          and(
            eq(syncConflicts.id, undoState.conflictId),
            eq(syncConflicts.tenantId, tenantId),
          ),
        );

      // Restore canonical_data, search_vector, sync_metadata
      await tx
        .update(records)
        .set({
          canonicalData: undoState.previousCanonicalData,
          searchVector: searchVectorExpr as unknown as string,
          ...(undoState.previousSyncMetadata
            ? { syncMetadata: undoState.previousSyncMetadata }
            : {}),
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, undoState.recordId),
          ),
        );
    });

    // 4. Cancel outbound sync job if one was enqueued
    if (undoState.outboundJobId) {
      const queue = getQueue('sync:outbound');
      const job = await queue.getJob(undoState.outboundJobId);
      if (job) {
        const state = await job.getState();
        if (state === 'waiting' || state === 'delayed') {
          await job.remove();
        }
      }
    }

    // 5. Emit sync.conflict_detected to restore the conflict indicator
    const publisher = createEventPublisher(redis);
    const tableChannel = `table:${undoState.tableId}`;

    await publisher.publish({
      tenantId,
      channel: tableChannel,
      event: REALTIME_EVENTS.SYNC_CONFLICT_DETECTED,
      payload: {
        type: REALTIME_EVENTS.SYNC_CONFLICT_DETECTED,
        recordId: undoState.recordId,
        fieldId: undoState.fieldId,
        conflictId: undoState.conflictId,
        localValue: undoState.localValue,
        remoteValue: undoState.remoteValue,
        platform: undoState.platform,
      },
      excludeUserId: userId,
    });

    return { success: true };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// bulkResolveConflicts — resolve all pending conflicts on a single record
// ---------------------------------------------------------------------------

export async function bulkResolveConflicts(
  input: z.input<typeof bulkResolveConflictsSchema>,
): Promise<{ success: true; undoToken: string; resolvedCount: number }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'record', 'update');

  const { recordId, tableId, resolution } = bulkResolveConflictsSchema.parse(input);

  // Merged resolution not supported in bulk (no per-field mergedValue)
  if (resolution === 'resolved_merged') {
    throw new ValidationError('Bulk resolve does not support merged resolution', {
      recordId,
    });
  }

  try {
    const db = getDbForTenant(tenantId, 'write');

    // 1. Load all pending conflicts for this record
    const pendingConflicts = await db
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.tenantId, tenantId),
          eq(syncConflicts.recordId, recordId),
          eq(syncConflicts.status, 'pending'),
        ),
      );

    if (pendingConflicts.length === 0) {
      throw new NotFoundError('No pending conflicts found for record', { recordId });
    }

    // 2. Load the record
    const [record] = await db
      .select({
        tenantId: records.tenantId,
        id: records.id,
        tableId: records.tableId,
        canonicalData: records.canonicalData,
        syncMetadata: records.syncMetadata,
      })
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenantId),
          eq(records.id, recordId),
          isNull(records.archivedAt),
        ),
      )
      .limit(1);

    if (!record) {
      throw new NotFoundError('Record not found', { recordId });
    }

    // 3. Build updated canonical data with all resolved fields
    const updatedCanonicalData: Record<string, unknown> = { ...record.canonicalData };
    const changedFieldIds: string[] = [];

    for (const conflict of pendingConflicts) {
      const resolvedValue = resolution === 'resolved_local'
        ? conflict.localValue
        : conflict.remoteValue;
      updatedCanonicalData[conflict.fieldId] = resolvedValue;
      changedFieldIds.push(conflict.fieldId);
    }

    // 4. Load table fields for search_vector rebuild
    const tableFields = await db
      .select({
        id: fieldsTable.id,
        fieldType: fieldsTable.fieldType,
        isPrimary: fieldsTable.isPrimary,
        config: fieldsTable.config,
      })
      .from(fieldsTable)
      .where(
        and(
          eq(fieldsTable.tenantId, tenantId),
          eq(fieldsTable.tableId, tableId),
        ),
      );

    const searchFieldDefs: SearchFieldDefinition[] = tableFields.map((f) => ({
      id: f.id,
      fieldType: f.fieldType,
      isPrimary: f.isPrimary,
      config: f.config,
    }));

    const searchVectorExpr = buildSearchVector(updatedCanonicalData, searchFieldDefs);

    // 5. Update sync_metadata
    const existingMeta = record.syncMetadata as SyncMetadata | null;
    const updatedSyncMetadata = existingMeta
      ? updateLastSyncedValues(existingMeta, changedFieldIds, updatedCanonicalData)
      : null;

    // 6. Single transaction: update all conflicts + record + audit logs
    await db.transaction(async (tx) => {
      for (const conflict of pendingConflicts) {
        await tx
          .update(syncConflicts)
          .set({
            status: resolution,
            resolvedBy: userId,
            resolvedAt: new Date(),
          })
          .where(
            and(
              eq(syncConflicts.id, conflict.id),
              eq(syncConflicts.tenantId, tenantId),
            ),
          );

        const resolvedValue = resolution === 'resolved_local'
          ? conflict.localValue
          : conflict.remoteValue;

        await writeAuditLog(tx, {
          tenantId,
          actorType: 'user',
          actorId: userId,
          action: 'sync_conflict.resolved',
          entityType: 'record',
          entityId: recordId,
          details: {
            conflictId: conflict.id,
            fieldId: conflict.fieldId,
            resolution,
            previousValue: resolution === 'resolved_local' ? conflict.remoteValue : conflict.localValue,
            resolvedValue,
            platform: conflict.platform,
            bulk: true,
          },
          traceId: getTraceId() ?? `bulk-conflict-resolve:${recordId}:${Date.now()}`,
        });
      }

      await tx
        .update(records)
        .set({
          canonicalData: updatedCanonicalData,
          searchVector: searchVectorExpr as unknown as string,
          ...(updatedSyncMetadata
            ? { syncMetadata: updatedSyncMetadata as unknown as Record<string, unknown> }
            : {}),
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, recordId),
          ),
        );
    });

    // 7. Emit events per conflict + single RECORD_UPDATED
    const redis = getRedis();
    const publisher = createEventPublisher(redis);
    const tableChannel = `table:${tableId}`;

    const allResolvedFields: Record<string, unknown> = {};
    for (const conflict of pendingConflicts) {
      const resolvedValue = resolution === 'resolved_local'
        ? conflict.localValue
        : conflict.remoteValue;
      allResolvedFields[conflict.fieldId] = resolvedValue;

      await publisher.publish({
        tenantId,
        channel: tableChannel,
        event: REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED,
        payload: {
          type: REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED,
          recordId,
          fieldId: conflict.fieldId,
          conflictId: conflict.id,
          resolvedValue,
          resolution,
        },
        excludeUserId: userId,
      });
    }

    await publisher.publish({
      tenantId,
      channel: tableChannel,
      event: REALTIME_EVENTS.RECORD_UPDATED,
      payload: { recordId, fields: allResolvedFields },
      excludeUserId: userId,
    });

    // 8. Enqueue outbound sync if resolved_local and connection is active
    let outboundJobId: string | null = null;

    if (resolution === 'resolved_local') {
      const [mapping] = await db
        .select({ baseConnectionId: syncedFieldMappings.baseConnectionId })
        .from(syncedFieldMappings)
        .where(
          and(
            eq(syncedFieldMappings.tenantId, tenantId),
            eq(syncedFieldMappings.tableId, tableId),
            eq(syncedFieldMappings.status, 'active'),
          ),
        )
        .limit(1);

      if (mapping) {
        const [connection] = await db
          .select({
            syncDirection: baseConnections.syncDirection,
            syncStatus: baseConnections.syncStatus,
          })
          .from(baseConnections)
          .where(
            and(
              eq(baseConnections.id, mapping.baseConnectionId),
              eq(baseConnections.tenantId, tenantId),
            ),
          )
          .limit(1);

        if (
          connection &&
          connection.syncDirection !== 'inbound_only' &&
          connection.syncStatus === 'active'
        ) {
          const queue = getQueue('sync:outbound');
          outboundJobId = `outbound:${tenantId}:${recordId}:bulk`;

          await queue.add(
            'outbound-sync',
            {
              tenantId,
              recordId,
              tableId,
              baseConnectionId: mapping.baseConnectionId,
              changedFieldIds,
              editedBy: userId,
              priority: RESOLUTION_PRIORITY,
              traceId: getTraceId() ?? `bulk-conflict-resolve:${recordId}:${Date.now()}`,
              triggeredBy: userId,
            },
            {
              jobId: outboundJobId,
              priority: RESOLUTION_PRIORITY,
            },
          );
        }
      }
    }

    // 9. Cache bulk undo state
    const undoToken = generateUUIDv7();
    const undoItems: UndoState[] = pendingConflicts.map((conflict) => ({
      conflictId: conflict.id,
      recordId,
      fieldId: conflict.fieldId,
      tableId,
      tenantId,
      previousCanonicalData: record.canonicalData,
      previousSyncMetadata: record.syncMetadata,
      localValue: conflict.localValue,
      remoteValue: conflict.remoteValue,
      baseValue: conflict.baseValue,
      platform: conflict.platform,
      outboundJobId,
    }));

    const bulkUndoState: BulkUndoState = {
      type: 'bulk',
      tableId,
      tenantId,
      items: undoItems,
      outboundJobIds: outboundJobId ? [outboundJobId] : [],
    };

    await redis.set(
      `${UNDO_KEY_PREFIX}${undoToken}`,
      JSON.stringify(bulkUndoState),
      'EX',
      UNDO_TTL_SECONDS,
    );

    return { success: true, undoToken, resolvedCount: pendingConflicts.length };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// bulkResolveTableConflicts — resolve all pending conflicts in a table
// ---------------------------------------------------------------------------

export async function bulkResolveTableConflicts(
  input: z.input<typeof bulkResolveTableConflictsSchema>,
): Promise<{ success: true; undoToken: string; resolvedCount: number }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'record', 'update');

  const { tableId, resolution } = bulkResolveTableConflictsSchema.parse(input);

  if (resolution === 'resolved_merged') {
    throw new ValidationError('Bulk resolve does not support merged resolution', {
      tableId,
    });
  }

  try {
    const db = getDbForTenant(tenantId, 'write');

    // 1. Load all pending conflicts for the table (join through records)
    const allConflicts = await db
      .select({
        conflict: syncConflicts,
        recordTableId: records.tableId,
      })
      .from(syncConflicts)
      .innerJoin(
        records,
        and(
          eq(records.id, syncConflicts.recordId),
          eq(records.tenantId, syncConflicts.tenantId),
        ),
      )
      .where(
        and(
          eq(syncConflicts.tenantId, tenantId),
          eq(syncConflicts.status, 'pending'),
          eq(records.tableId, tableId),
          isNull(records.archivedAt),
        ),
      );

    if (allConflicts.length === 0) {
      throw new NotFoundError('No pending conflicts found for table', { tableId });
    }

    // 2. Group conflicts by record
    const conflictsByRecord = new Map<string, typeof allConflicts>();
    for (const row of allConflicts) {
      const recId = row.conflict.recordId;
      const existing = conflictsByRecord.get(recId) ?? [];
      existing.push(row);
      conflictsByRecord.set(recId, existing);
    }

    // 3. Load table fields once
    const tableFields = await db
      .select({
        id: fieldsTable.id,
        fieldType: fieldsTable.fieldType,
        isPrimary: fieldsTable.isPrimary,
        config: fieldsTable.config,
      })
      .from(fieldsTable)
      .where(
        and(
          eq(fieldsTable.tenantId, tenantId),
          eq(fieldsTable.tableId, tableId),
        ),
      );

    const searchFieldDefs: SearchFieldDefinition[] = tableFields.map((f) => ({
      id: f.id,
      fieldType: f.fieldType,
      isPrimary: f.isPrimary,
      config: f.config,
    }));

    // 4. Process each record group
    const allUndoItems: UndoState[] = [];
    const allOutboundJobIds: string[] = [];
    let totalResolved = 0;

    for (const [recId, rows] of conflictsByRecord) {
      const conflicts = rows.map((r) => r.conflict);

      // Load the record
      const [record] = await db
        .select({
          tenantId: records.tenantId,
          id: records.id,
          tableId: records.tableId,
          canonicalData: records.canonicalData,
          syncMetadata: records.syncMetadata,
        })
        .from(records)
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, recId),
            isNull(records.archivedAt),
          ),
        )
        .limit(1);

      if (!record) continue;

      // Build updated canonical data
      const updatedCanonicalData: Record<string, unknown> = { ...record.canonicalData };
      const changedFieldIds: string[] = [];

      for (const conflict of conflicts) {
        const resolvedValue = resolution === 'resolved_local'
          ? conflict.localValue
          : conflict.remoteValue;
        updatedCanonicalData[conflict.fieldId] = resolvedValue;
        changedFieldIds.push(conflict.fieldId);
      }

      const searchVectorExpr = buildSearchVector(updatedCanonicalData, searchFieldDefs);
      const existingMeta = record.syncMetadata as SyncMetadata | null;
      const updatedSyncMetadata = existingMeta
        ? updateLastSyncedValues(existingMeta, changedFieldIds, updatedCanonicalData)
        : null;

      // Transaction per record
      await db.transaction(async (tx) => {
        for (const conflict of conflicts) {
          await tx
            .update(syncConflicts)
            .set({
              status: resolution,
              resolvedBy: userId,
              resolvedAt: new Date(),
            })
            .where(
              and(
                eq(syncConflicts.id, conflict.id),
                eq(syncConflicts.tenantId, tenantId),
              ),
            );

          const resolvedValue = resolution === 'resolved_local'
            ? conflict.localValue
            : conflict.remoteValue;

          await writeAuditLog(tx, {
            tenantId,
            actorType: 'user',
            actorId: userId,
            action: 'sync_conflict.resolved',
            entityType: 'record',
            entityId: recId,
            details: {
              conflictId: conflict.id,
              fieldId: conflict.fieldId,
              resolution,
              previousValue: resolution === 'resolved_local' ? conflict.remoteValue : conflict.localValue,
              resolvedValue,
              platform: conflict.platform,
              bulk: true,
              tableLevel: true,
            },
            traceId: getTraceId() ?? `bulk-table-conflict-resolve:${tableId}:${Date.now()}`,
          });
        }

        await tx
          .update(records)
          .set({
            canonicalData: updatedCanonicalData,
            searchVector: searchVectorExpr as unknown as string,
            ...(updatedSyncMetadata
              ? { syncMetadata: updatedSyncMetadata as unknown as Record<string, unknown> }
              : {}),
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(records.tenantId, tenantId),
              eq(records.id, recId),
            ),
          );
      });

      // Emit events
      const redis = getRedis();
      const publisher = createEventPublisher(redis);
      const tableChannel = `table:${tableId}`;

      const resolvedFields: Record<string, unknown> = {};
      for (const conflict of conflicts) {
        const resolvedValue = resolution === 'resolved_local'
          ? conflict.localValue
          : conflict.remoteValue;
        resolvedFields[conflict.fieldId] = resolvedValue;

        await publisher.publish({
          tenantId,
          channel: tableChannel,
          event: REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED,
          payload: {
            type: REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED,
            recordId: recId,
            fieldId: conflict.fieldId,
            conflictId: conflict.id,
            resolvedValue,
            resolution,
          },
          excludeUserId: userId,
        });
      }

      await publisher.publish({
        tenantId,
        channel: tableChannel,
        event: REALTIME_EVENTS.RECORD_UPDATED,
        payload: { recordId: recId, fields: resolvedFields },
        excludeUserId: userId,
      });

      // Build undo items
      for (const conflict of conflicts) {
        allUndoItems.push({
          conflictId: conflict.id,
          recordId: recId,
          fieldId: conflict.fieldId,
          tableId,
          tenantId,
          previousCanonicalData: record.canonicalData,
          previousSyncMetadata: record.syncMetadata,
          localValue: conflict.localValue,
          remoteValue: conflict.remoteValue,
          baseValue: conflict.baseValue,
          platform: conflict.platform,
          outboundJobId: null,
        });
      }

      totalResolved += conflicts.length;
    }

    // 5. Cache bulk undo state
    const redis = getRedis();
    const undoToken = generateUUIDv7();
    const bulkUndoState: BulkUndoState = {
      type: 'bulk',
      tableId,
      tenantId,
      items: allUndoItems,
      outboundJobIds: allOutboundJobIds,
    };

    await redis.set(
      `${UNDO_KEY_PREFIX}${undoToken}`,
      JSON.stringify(bulkUndoState),
      'EX',
      UNDO_TTL_SECONDS,
    );

    return { success: true, undoToken, resolvedCount: totalResolved };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
