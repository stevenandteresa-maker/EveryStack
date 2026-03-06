/**
 * InboundSyncProcessor — Incremental (polling) inbound sync pipeline.
 *
 * Fetches updated records from the source platform since the last sync,
 * performs three-way conflict detection per record, and:
 *   - Clean remote changes → applied to canonical_data + sync_metadata updated
 *   - Clean local changes → preserved (no action)
 *   - Conflicts → written to sync_conflicts table (status: pending)
 *   - New records from platform → created (no conflict possible)
 *
 * Queue: sync (job name: 'incremental-sync')
 *
 * @see docs/reference/sync-engine.md § Conflict Resolution UX > Detection
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { IncrementalSyncJobData } from '@everystack/shared/queue';
import {
  getDbForTenant,
  baseConnections,
  records,
  syncedFieldMappings,
  fields,
  generateUUIDv7,
  eq,
  and,
  sql,
} from '@everystack/shared/db';
import type { DrizzleClient } from '@everystack/shared/db';
import {
  AirtableApiClient,
  AirtableAdapter,
  registerAirtableTransforms,
  translateFilterToFormula,
  rateLimiter,
  createInitialSyncMetadata,
  updateLastSyncedValues,
} from '@everystack/shared/sync';
import type {
  SyncConfig,
  SyncMetadata,
  SyncPlatform,
  FieldMapping,
  AirtableTokens,
} from '@everystack/shared/sync';
import { detectConflicts, writeConflictRecords, applyLastWriteWins } from '@everystack/shared/sync';
import type { ConflictResolutionStrategy } from '@everystack/shared/sync';
import { decryptTokens } from '@everystack/shared/crypto';
import { BaseProcessor } from '../../lib/base-processor';

// Ensure transforms are registered
registerAirtableTransforms();

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class InboundSyncProcessor extends BaseProcessor<IncrementalSyncJobData> {
  private readonly adapter = new AirtableAdapter();

  constructor() {
    super('sync', { concurrency: 3 });
  }

  async processJob(job: Job<IncrementalSyncJobData>, logger: Logger): Promise<void> {
    const { tenantId, connectionId } = job.data;

    logger.info({ connectionId }, 'Starting incremental inbound sync');

    // 1. Load connection
    const db = getDbForTenant(tenantId, 'read');
    const [connection] = await db
      .select({
        id: baseConnections.id,
        platform: baseConnections.platform,
        externalBaseId: baseConnections.externalBaseId,
        syncConfig: baseConnections.syncConfig,
        oauthTokens: baseConnections.oauthTokens,
        lastSyncAt: baseConnections.lastSyncAt,
        conflictResolution: baseConnections.conflictResolution,
      })
      .from(baseConnections)
      .where(
        and(
          eq(baseConnections.id, connectionId),
          eq(baseConnections.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!connection?.oauthTokens || !connection.externalBaseId) {
      throw new Error('Connection missing tokens or base ID');
    }

    const tokens = decryptTokens<Record<string, unknown>>(
      connection.oauthTokens as Record<string, unknown>,
    ) as unknown as AirtableTokens;
    const baseId = connection.externalBaseId;
    const syncConfig = connection.syncConfig as unknown as SyncConfig;
    const platform = connection.platform as SyncPlatform;
    const conflictResolution = (connection.conflictResolution ?? 'last_write_wins') as ConflictResolutionStrategy;

    const apiClient = new AirtableApiClient(tokens.access_token, baseId);

    // 2. Process each enabled table
    let totalUpdated = 0;
    let totalCreated = 0;
    let totalConflicts = 0;

    for (const tableConfig of syncConfig.tables) {
      if (!tableConfig.enabled || !tableConfig.es_table_id) continue;

      const result = await this.syncTableInbound({
        tenantId,
        connectionId,
        baseId,
        esTableId: tableConfig.es_table_id,
        externalTableId: tableConfig.external_table_id,
        syncFilter: tableConfig.sync_filter,
        platform,
        conflictResolution,
        apiClient,
        logger,
      });

      totalUpdated += result.updated;
      totalCreated += result.created;
      totalConflicts += result.conflicts;
    }

    // 3. Update connection lastSyncAt
    const writeDb = getDbForTenant(tenantId);
    await writeDb
      .update(baseConnections)
      .set({
        lastSyncAt: new Date(),
        health: {
          last_sync_type: 'incremental',
          last_sync_completed_at: new Date().toISOString(),
          last_sync_stats: { updated: totalUpdated, created: totalCreated, conflicts: totalConflicts },
        },
      })
      .where(
        and(
          eq(baseConnections.id, connectionId),
          eq(baseConnections.tenantId, tenantId),
        ),
      );

    logger.info(
      { totalUpdated, totalCreated, totalConflicts },
      'Incremental inbound sync completed',
    );
  }

  /**
   * Fetch inbound records for a single table and reconcile with conflict detection.
   */
  private async syncTableInbound(params: {
    tenantId: string;
    connectionId: string;
    baseId: string;
    esTableId: string;
    externalTableId: string;
    syncFilter: SyncConfig['tables'][0]['sync_filter'];
    platform: SyncPlatform;
    conflictResolution: ConflictResolutionStrategy;
    apiClient: AirtableApiClient;
    logger: Logger;
  }): Promise<{ updated: number; created: number; conflicts: number }> {
    const {
      tenantId,
      connectionId,
      baseId,
      esTableId,
      externalTableId,
      syncFilter,
      platform,
      conflictResolution,
      apiClient,
      logger,
    } = params;

    // Build field mappings
    const fieldMappings = await this.buildFieldMappings(tenantId, connectionId, esTableId);
    const syncedFieldIds = fieldMappings.map((m) => m.fieldId);

    // Build fieldMap for filter translation
    const fieldMap = new Map<string, string>();
    for (const mapping of fieldMappings) {
      fieldMap.set(mapping.fieldId, mapping.externalFieldId);
    }

    let filterFormula = '';
    if (syncFilter && syncFilter.length > 0) {
      filterFormula = translateFilterToFormula(syncFilter, fieldMap);
    }

    let offset: string | undefined;
    let updated = 0;
    let created = 0;
    let conflicts = 0;

    do {
      await rateLimiter.waitForCapacity('airtable', `base:${baseId}`);

      const page = await apiClient.listRecords(externalTableId, {
        pageSize: 100,
        offset,
        filterByFormula: filterFormula || undefined,
      });

      if (page.records.length === 0) break;

      for (const platformRecord of page.records) {
        const inboundCanonical = this.adapter.toCanonical(platformRecord, fieldMappings);
        const platformRecordId = platformRecord.id;

        const result = await this.reconcileRecord({
          tenantId,
          esTableId,
          platformRecordId,
          inboundCanonical,
          syncedFieldIds,
          platform,
          conflictResolution,
          fieldMappings,
          logger,
        });

        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else if (result === 'conflict') conflicts++;
      }

      offset = page.offset;
    } while (offset);

    logger.info(
      { esTableId, updated, created, conflicts },
      'Table inbound sync complete',
    );

    return { updated, created, conflicts };
  }

  /**
   * Reconcile a single inbound platform record against its local counterpart.
   *
   * - If no local record exists: create it (new record from platform)
   * - If local record exists: run three-way conflict detection
   */
  private async reconcileRecord(params: {
    tenantId: string;
    esTableId: string;
    platformRecordId: string;
    inboundCanonical: Record<string, unknown>;
    syncedFieldIds: string[];
    platform: SyncPlatform;
    conflictResolution: ConflictResolutionStrategy;
    fieldMappings: FieldMapping[];
    logger: Logger;
  }): Promise<'created' | 'updated' | 'conflict' | 'unchanged'> {
    const {
      tenantId,
      esTableId,
      platformRecordId,
      inboundCanonical,
      syncedFieldIds,
      platform,
      conflictResolution,
      logger,
    } = params;

    const db = getDbForTenant(tenantId);

    // Look up existing record by platform_record_id in sync_metadata
    const [existing] = await db
      .select({
        id: records.id,
        tenantId: records.tenantId,
        canonicalData: records.canonicalData,
        syncMetadata: records.syncMetadata,
      })
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenantId),
          eq(records.tableId, esTableId),
          sql`${records.syncMetadata}->>'platform_record_id' = ${platformRecordId}`,
        ),
      )
      .limit(1);

    // New record from platform — create, no conflict possible
    if (!existing) {
      const syncMeta = createInitialSyncMetadata(
        platformRecordId,
        inboundCanonical,
        syncedFieldIds,
      );

      await db.insert(records).values({
        tenantId,
        id: generateUUIDv7(),
        tableId: esTableId,
        canonicalData: inboundCanonical,
        syncMetadata: syncMeta as unknown as Record<string, unknown>,
      });

      return 'created';
    }

    // Existing record — run three-way conflict detection
    const currentCanonical = (existing.canonicalData ?? {}) as Record<string, unknown>;
    const syncMetadata = existing.syncMetadata as unknown as SyncMetadata | null;

    const detection = detectConflicts(
      currentCanonical,
      inboundCanonical,
      syncMetadata,
      syncedFieldIds,
    );

    const hasRemoteChanges = detection.cleanRemoteChanges.length > 0;
    const hasConflicts = detection.conflicts.length > 0;

    if (!hasRemoteChanges && !hasConflicts && detection.convergentFieldIds.length === 0) {
      return 'unchanged';
    }

    // Apply within a transaction
    await db.transaction(async (tx: DrizzleClient) => {
      // 1. Build canonical with clean remote changes applied
      let mergedCanonical = { ...currentCanonical };
      for (const change of detection.cleanRemoteChanges) {
        mergedCanonical[change.fieldId] = change.value;
      }

      // 2. Compute metadata for clean remote + convergent fields
      const cleanFieldIds = [
        ...detection.cleanRemoteChanges.map((c) => c.fieldId),
        ...detection.convergentFieldIds,
      ];

      let updatedMeta = syncMetadata
        ? updateLastSyncedValues(syncMetadata, cleanFieldIds, mergedCanonical)
        : createInitialSyncMetadata(
            platformRecordId,
            mergedCanonical,
            syncedFieldIds,
          );

      // 3. Handle conflicts based on resolution strategy
      if (hasConflicts) {
        if (conflictResolution === 'last_write_wins') {
          // LWW: remote wins — apply remote values, write resolved_remote
          const lwwResult = await applyLastWriteWins(
            tx,
            tenantId,
            existing.id,
            detection.conflicts,
            platform,
            mergedCanonical,
            updatedMeta,
            platformRecordId,
            syncedFieldIds,
          );
          mergedCanonical = lwwResult.updatedCanonical;
          updatedMeta = lwwResult.updatedSyncMetadata;
        } else {
          // Manual: write pending conflict records, local values preserved
          await writeConflictRecords(tx, tenantId, existing.id, detection.conflicts, platform);
          logger.warn(
            { recordId: existing.id, conflictCount: detection.conflicts.length },
            'Sync conflicts detected — pending manual resolution',
          );
        }
      }

      // 4. Write updated canonical + metadata to records
      const hasAnyChanges = hasRemoteChanges
        || detection.convergentFieldIds.length > 0
        || (hasConflicts && conflictResolution === 'last_write_wins');

      if (hasAnyChanges) {
        await tx
          .update(records)
          .set({
            canonicalData: mergedCanonical,
            syncMetadata: updatedMeta as unknown as Record<string, unknown>,
          })
          .where(
            and(
              eq(records.tenantId, tenantId),
              eq(records.id, existing.id),
            ),
          );
      } else if (cleanFieldIds.length > 0 && syncMetadata) {
        // Only convergent changes with no canonical data modification — update metadata only
        await tx
          .update(records)
          .set({
            syncMetadata: updatedMeta as unknown as Record<string, unknown>,
          })
          .where(
            and(
              eq(records.tenantId, tenantId),
              eq(records.id, existing.id),
            ),
          );
      }
    });

    // In manual mode, conflicts are pending — still report as 'conflict'
    return hasConflicts ? 'conflict' : 'updated';
  }

  /**
   * Build FieldMapping[] from synced_field_mappings + fields tables.
   */
  private async buildFieldMappings(
    tenantId: string,
    connectionId: string,
    esTableId: string,
  ): Promise<FieldMapping[]> {
    const db = getDbForTenant(tenantId, 'read');

    const mappingRows = await db
      .select({
        fieldId: syncedFieldMappings.fieldId,
        externalFieldId: syncedFieldMappings.externalFieldId,
        externalFieldType: syncedFieldMappings.externalFieldType,
        fieldType: fields.fieldType,
        config: fields.config,
      })
      .from(syncedFieldMappings)
      .innerJoin(fields, eq(syncedFieldMappings.fieldId, fields.id))
      .where(
        and(
          eq(syncedFieldMappings.tenantId, tenantId),
          eq(syncedFieldMappings.baseConnectionId, connectionId),
          eq(syncedFieldMappings.tableId, esTableId),
          eq(syncedFieldMappings.status, 'active'),
        ),
      );

    return mappingRows.map((row) => ({
      fieldId: row.fieldId,
      externalFieldId: row.externalFieldId,
      externalFieldType: row.externalFieldType,
      fieldType: row.fieldType,
      config: (row.config as Record<string, unknown>) ?? {},
    }));
  }
}
