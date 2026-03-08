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
  NotionAdapter,
  NotionApiClient,
  registerAirtableTransforms,
  registerNotionTransforms,
  translateFilterToFormula,
  translateToNotionFilter,
  rateLimiter,
  createInitialSyncMetadata,
  updateLastSyncedValues,
  getNotionDatabaseSchema,
} from '@everystack/shared/sync';
import type {
  PlatformAdapter,
  SyncConfig,
  SyncMetadata,
  SyncPlatform,
  FieldMapping,
  AirtableTokens,
  NotionTokens,
} from '@everystack/shared/sync';
import { detectConflicts, writeConflictRecords, applyLastWriteWins } from '@everystack/shared/sync';
import type { ConflictResolutionStrategy, WrittenConflict } from '@everystack/shared/sync';
import {
  createSyncFailure,
  getPendingRetriableFailures,
  incrementRetryCount,
  markFailureResolved,
  detectSchemaChanges,
  createSchemaChange,
  hasPendingSchemaChange,
  computeSchemaChangeImpact,
} from '@everystack/shared/sync';
import type {
  CreateSyncFailureInput,
  LocalFieldMapping,
  PlatformFieldDefinition,
} from '@everystack/shared/sync';
import { decryptTokens } from '@everystack/shared/crypto';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { EventPublisher } from '@everystack/shared/realtime';
import { BaseProcessor } from '../../lib/base-processor';

// Ensure transforms are registered
registerAirtableTransforms();
registerNotionTransforms();

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class InboundSyncProcessor extends BaseProcessor<IncrementalSyncJobData> {
  private readonly airtableAdapter = new AirtableAdapter();
  private readonly notionAdapter = new NotionAdapter();
  private readonly eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    super('sync', { concurrency: 3 });
    this.eventPublisher = eventPublisher;
  }

  /** Resolve the correct adapter for the connection's platform. */
  private getAdapter(platform: string): PlatformAdapter {
    if (platform === 'notion') return this.notionAdapter;
    return this.airtableAdapter;
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

    const rawTokens = decryptTokens<Record<string, unknown>>(
      connection.oauthTokens as Record<string, unknown>,
    );
    const baseId = connection.externalBaseId;
    const syncConfig = connection.syncConfig as unknown as SyncConfig;
    const platform = connection.platform as SyncPlatform;
    const conflictResolution = (connection.conflictResolution ?? 'last_write_wins') as ConflictResolutionStrategy;

    // Platform-aware API client
    const airtableClient = platform !== 'notion'
      ? new AirtableApiClient((rawTokens as unknown as AirtableTokens).access_token, baseId ?? '')
      : null;
    const notionClient = platform === 'notion'
      ? new NotionApiClient((rawTokens as unknown as NotionTokens).access_token)
      : null;

    // 2. Auto-retry pending failures from previous sync cycles
    await this.retryPendingFailures({
      tenantId,
      connectionId,
      platform,
      conflictResolution,
      airtableClient,
      notionClient,
      logger,
    });

    // 3. Process each enabled table
    let totalUpdated = 0;
    let totalCreated = 0;
    let totalConflicts = 0;
    let totalFailed = 0;

    for (const tableConfig of syncConfig.tables) {
      if (!tableConfig.enabled || !tableConfig.es_table_id) continue;

      const notionAccessToken = platform === 'notion' ? (rawTokens as unknown as NotionTokens).access_token : null;
      const result = await this.syncTableInbound({
        tenantId,
        connectionId,
        baseId: baseId ?? '',
        esTableId: tableConfig.es_table_id,
        externalTableId: tableConfig.external_table_id,
        syncFilter: tableConfig.sync_filter,
        platform,
        conflictResolution,
        airtableClient,
        notionClient,
        notionAccessToken,
        logger,
      });

      totalUpdated += result.updated;
      totalCreated += result.created;
      totalConflicts += result.conflicts;
      totalFailed += result.failed;
    }

    // 4. Update connection lastSyncAt + health
    const writeDb = getDbForTenant(tenantId);
    const syncStatusValue = totalFailed > 0 ? 'completed_with_errors' : undefined;
    await writeDb
      .update(baseConnections)
      .set({
        lastSyncAt: new Date(),
        ...(syncStatusValue ? { syncStatus: syncStatusValue } : {}),
        health: {
          last_sync_type: 'incremental',
          last_sync_completed_at: new Date().toISOString(),
          last_sync_stats: {
            updated: totalUpdated,
            created: totalCreated,
            conflicts: totalConflicts,
            failed: totalFailed,
          },
          records_failed: totalFailed,
        },
      })
      .where(
        and(
          eq(baseConnections.id, connectionId),
          eq(baseConnections.tenantId, tenantId),
        ),
      );

    logger.info(
      { totalUpdated, totalCreated, totalConflicts, totalFailed },
      totalFailed > 0 ? 'Incremental inbound sync completed with errors' : 'Incremental inbound sync completed',
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
    airtableClient: AirtableApiClient | null;
    notionClient: NotionApiClient | null;
    notionAccessToken: string | null;
    logger: Logger;
  }): Promise<{ updated: number; created: number; conflicts: number; failed: number }> {
    const {
      tenantId,
      connectionId,
      baseId,
      esTableId,
      externalTableId,
      syncFilter,
      platform,
      conflictResolution,
      airtableClient,
      notionClient,
      notionAccessToken,
      logger,
    } = params;

    const adapter = this.getAdapter(platform);

    // Build field mappings
    const fieldMappings = await this.buildFieldMappings(tenantId, connectionId, esTableId);

    // Schema change detection: compare platform fields against local mappings
    const skippedFieldIds = await this.detectAndRecordSchemaChanges({
      tenantId,
      connectionId,
      esTableId,
      platform,
      airtableClient,
      notionAccessToken,
      externalTableId,
      fieldMappings,
      logger,
    });

    // Filter out skipped fields (type_changed or deleted pending resolution)
    const activeFieldMappings = skippedFieldIds.size > 0
      ? fieldMappings.filter((m) => !skippedFieldIds.has(m.fieldId))
      : fieldMappings;
    const syncedFieldIds = activeFieldMappings.map((m) => m.fieldId);

    // Build fieldMap for filter translation
    const fieldMap = new Map<string, string>();
    for (const mapping of activeFieldMappings) {
      fieldMap.set(mapping.fieldId, mapping.externalFieldId);
    }

    // Platform-specific filter setup
    let airtableFilterFormula = '';
    let notionFilter: Record<string, unknown> | undefined;
    if (syncFilter && syncFilter.length > 0) {
      if (platform === 'notion') {
        notionFilter = translateToNotionFilter(syncFilter, fieldMappings) as Record<string, unknown> | undefined;
      } else {
        airtableFilterFormula = translateFilterToFormula(syncFilter, fieldMap);
      }
    }

    let updated = 0;
    let created = 0;
    let conflicts = 0;
    let failed = 0;

    if (platform === 'notion' && notionClient) {
      // Notion pagination: uses start_cursor / has_more
      let startCursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const rateLimitScope = `integration:${connectionId}`;
        await rateLimiter.waitForCapacity('notion', rateLimitScope);

        const queryResult = await notionClient.queryDatabase(externalTableId, {
          pageSize: 100,
          startCursor,
          filter: notionFilter,
        });

        if (queryResult.results.length === 0) break;

        for (const page of queryResult.results) {
          try {
            const inboundCanonical = adapter.toCanonical(page, fieldMappings);
            const platformRecordId = page.id;

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

            if (result.status === 'created') created++;
            else if (result.status === 'updated') updated++;
            else if (result.status === 'conflict') conflicts++;

            if (result.writtenConflicts.length > 0) {
              await this.emitConflictDetectedEvents(
                tenantId,
                esTableId,
                result.recordId,
                result.writtenConflicts,
                platform,
              );
            }
          } catch (recordError) {
            failed++;
            await this.recordSyncFailure(tenantId, connectionId, page.id, recordError, page, 'inbound', logger);
          }
        }

        hasMore = queryResult.has_more;
        startCursor = queryResult.next_cursor;
      }
    } else if (airtableClient) {
      // Airtable pagination: uses offset string
      let offset: string | undefined;

      do {
        await rateLimiter.waitForCapacity('airtable', `base:${baseId}`);

        const page = await airtableClient.listRecords(externalTableId, {
          pageSize: 100,
          offset,
          filterByFormula: airtableFilterFormula || undefined,
        });

        if (page.records.length === 0) break;

        for (const platformRecord of page.records) {
          try {
            const inboundCanonical = adapter.toCanonical(platformRecord, fieldMappings);
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

            if (result.status === 'created') created++;
            else if (result.status === 'updated') updated++;
            else if (result.status === 'conflict') conflicts++;

            if (result.writtenConflicts.length > 0) {
              await this.emitConflictDetectedEvents(
                tenantId,
                esTableId,
                result.recordId,
                result.writtenConflicts,
                platform,
              );
            }
          } catch (recordError) {
            failed++;
            await this.recordSyncFailure(tenantId, connectionId, platformRecord.id, recordError, platformRecord, 'inbound', logger);
          }
        }

        offset = page.offset;
      } while (offset);
    }

    logger.info(
      { esTableId, updated, created, conflicts, failed },
      failed > 0 ? 'Table inbound sync complete with failures' : 'Table inbound sync complete',
    );

    return { updated, created, conflicts, failed };
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
  }): Promise<{ status: 'created' | 'updated' | 'conflict' | 'unchanged'; recordId: string; writtenConflicts: WrittenConflict[] }> {
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

      return { status: 'created' as const, recordId: '', writtenConflicts: [] };
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
      return { status: 'unchanged' as const, recordId: existing.id, writtenConflicts: [] };
    }

    // Track conflicts written during manual resolution
    let writtenConflicts: WrittenConflict[] = [];

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
          writtenConflicts = await writeConflictRecords(tx, tenantId, existing.id, detection.conflicts, platform);
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
    const status = hasConflicts ? 'conflict' as const : 'updated' as const;
    return { status, recordId: existing.id, writtenConflicts };
  }

  /**
   * Emit sync.conflict_detected for each conflict written during manual resolution.
   * Each conflict gets its own event so clients can update individual cell indicators.
   */
  private async emitConflictDetectedEvents(
    tenantId: string,
    tableId: string,
    recordId: string,
    writtenConflicts: WrittenConflict[],
    platform: string,
  ): Promise<void> {
    for (const conflict of writtenConflicts) {
      await this.eventPublisher.publish({
        tenantId,
        channel: `table:${tableId}`,
        event: REALTIME_EVENTS.SYNC_CONFLICT_DETECTED,
        payload: {
          type: REALTIME_EVENTS.SYNC_CONFLICT_DETECTED,
          recordId,
          fieldId: conflict.fieldId,
          conflictId: conflict.id,
          localValue: conflict.localValue,
          remoteValue: conflict.remoteValue,
          platform,
        },
      });
    }
  }

  /**
   * Record a sync failure for an individual record that failed during processing.
   * Classifies the error and writes to sync_failures. Does not rethrow.
   */
  private async recordSyncFailure(
    tenantId: string,
    connectionId: string,
    platformRecordId: string,
    error: unknown,
    rawPayload: unknown,
    direction: 'inbound' | 'outbound',
    logger: Logger,
  ): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = this.classifyRecordError(errorMessage);

      await createSyncFailure(tenantId, {
        baseConnectionId: connectionId,
        direction,
        errorCode,
        errorMessage,
        platformRecordId,
        payload: rawPayload,
      });

      logger.warn(
        { platformRecordId, errorCode, errorMessage },
        'Individual record sync failure recorded',
      );
    } catch (writeError) {
      // Failure recording itself failed — log but don't propagate
      logger.error(
        { platformRecordId, writeError },
        'Failed to write sync failure record',
      );
    }
  }

  /**
   * Classify a record-level error into a sync failure error code.
   */
  private classifyRecordError(
    message: string,
  ): CreateSyncFailureInput['errorCode'] {
    const lower = message.toLowerCase();
    if (lower.includes('validation') || lower.includes('invalid value') || lower.includes('field type mismatch')) {
      return 'validation';
    }
    if (lower.includes('schema') || lower.includes('field not found')) {
      return 'schema_mismatch';
    }
    if (lower.includes('too large') || lower.includes('payload')) {
      return 'payload_too_large';
    }
    if (lower.includes('rejected') || lower.includes('refused')) {
      return 'platform_rejected';
    }
    return 'unknown';
  }

  /**
   * Auto-retry pending failures from previous sync cycles.
   *
   * Fetches pending failures with retry_count < MAX_AUTO_RETRY_COUNT,
   * re-attempts toCanonical + reconcile, and either resolves or
   * increments the retry count.
   */
  private async retryPendingFailures(params: {
    tenantId: string;
    connectionId: string;
    platform: SyncPlatform;
    conflictResolution: ConflictResolutionStrategy;
    airtableClient: AirtableApiClient | null;
    notionClient: NotionApiClient | null;
    logger: Logger;
  }): Promise<void> {
    const { tenantId, connectionId, logger } = params;

    const pendingFailures = await getPendingRetriableFailures(tenantId, connectionId);
    if (pendingFailures.length === 0) return;

    logger.info(
      { count: pendingFailures.length },
      'Auto-retrying pending sync failures',
    );

    for (const failure of pendingFailures) {
      try {
        if (!failure.payload || !failure.platformRecordId) {
          await incrementRetryCount(tenantId, failure.id);
          continue;
        }

        const adapter = this.getAdapter(params.platform);
        const fieldMappings = await this.buildFieldMappings(tenantId, connectionId, '');
        const syncedFieldIds = fieldMappings.map((m) => m.fieldId);

        const inboundCanonical = adapter.toCanonical(
          failure.payload as Record<string, unknown>,
          fieldMappings,
        );

        await this.reconcileRecord({
          tenantId,
          esTableId: '', // Will be resolved from the record if it exists
          platformRecordId: failure.platformRecordId,
          inboundCanonical,
          syncedFieldIds,
          platform: params.platform,
          conflictResolution: params.conflictResolution,
          fieldMappings,
          logger,
        });

        // Success — mark as resolved
        await markFailureResolved(tenantId, failure.id);

        logger.info(
          { failureId: failure.id, platformRecordId: failure.platformRecordId },
          'Auto-retry succeeded — failure resolved',
        );
      } catch {
        // Still failing — increment retry count
        const result = await incrementRetryCount(tenantId, failure.id);

        logger.warn(
          {
            failureId: failure.id,
            retryCount: result.newRetryCount,
            requiresManual: result.requiresManual,
          },
          result.requiresManual
            ? 'Auto-retry failed — requires manual resolution'
            : 'Auto-retry failed — will retry next cycle',
        );
      }
    }
  }

  /**
   * Detect schema changes between the platform's current fields and local mappings.
   * Writes detected changes to sync_schema_changes (deduped) and returns
   * the set of field IDs that should be skipped during this sync cycle.
   */
  private async detectAndRecordSchemaChanges(params: {
    tenantId: string;
    connectionId: string;
    esTableId: string;
    platform: string;
    airtableClient: AirtableApiClient | null;
    notionAccessToken: string | null;
    externalTableId: string;
    fieldMappings: FieldMapping[];
    logger: Logger;
  }): Promise<Set<string>> {
    const {
      tenantId,
      connectionId,
      esTableId,
      platform,
      airtableClient,
      notionAccessToken,
      externalTableId,
      fieldMappings,
      logger,
    } = params;

    const skippedFieldIds = new Set<string>();

    try {
      // Fetch current platform field definitions
      let platformFields: PlatformFieldDefinition[] = [];

      if (platform === 'notion' && notionAccessToken) {
        const schema = await getNotionDatabaseSchema(notionAccessToken, externalTableId);
        platformFields = (schema.properties ?? []).map((prop) => ({
          id: prop.id,
          name: prop.name,
          type: prop.type,
        }));
      } else if (airtableClient) {
        const airtableFields = await airtableClient.listFields(externalTableId);
        platformFields = airtableFields.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          options: f.options,
        }));
      }

      if (platformFields.length === 0) return skippedFieldIds;

      // Build local mappings with field names for the detector
      const db = getDbForTenant(tenantId, 'read');
      const fieldRows = await db
        .select({ id: fields.id, name: fields.name })
        .from(fields)
        .where(eq(fields.tenantId, tenantId));

      const fieldNameMap = new Map<string, string>();
      for (const row of fieldRows) {
        fieldNameMap.set(row.id, row.name);
      }

      const localMappings: LocalFieldMapping[] = fieldMappings.map((m) => ({
        fieldId: m.fieldId,
        externalFieldId: m.externalFieldId,
        externalFieldType: m.externalFieldType,
        fieldName: fieldNameMap.get(m.fieldId) ?? '',
      }));

      // Detect changes
      const changes = detectSchemaChanges(localMappings, platformFields);

      if (changes.length === 0) return skippedFieldIds;

      logger.info(
        { changeCount: changes.length, changeTypes: changes.map((c) => c.changeType) },
        'Schema changes detected during inbound sync',
      );

      // Write changes to sync_schema_changes (deduped — skip if pending already exists)
      for (const change of changes) {
        const alreadyPending = await hasPendingSchemaChange(
          tenantId,
          connectionId,
          change.platformFieldId,
          change.changeType,
        );

        if (alreadyPending) {
          // Still pending from previous cycle — skip but still mark field for skipping
          if (
            change.fieldId &&
            (change.changeType === 'field_type_changed' || change.changeType === 'field_deleted')
          ) {
            skippedFieldIds.add(change.fieldId);
          }
          continue;
        }

        // Compute impact for existing fields
        let impact = { formulaCount: 0, automationCount: 0, portalFieldCount: 0, crossLinkCount: 0 };
        if (change.fieldId) {
          impact = await computeSchemaChangeImpact(tenantId, change.fieldId);
        }

        await createSchemaChange(tenantId, {
          baseConnectionId: connectionId,
          changeType: change.changeType,
          fieldId: change.fieldId,
          platformFieldId: change.platformFieldId,
          oldSchema: change.oldSchema,
          newSchema: change.newSchema,
          impact,
        });

        // Skip syncing affected fields until Manager resolves
        if (
          change.fieldId &&
          (change.changeType === 'field_type_changed' || change.changeType === 'field_deleted')
        ) {
          skippedFieldIds.add(change.fieldId);
        }

        logger.info(
          {
            changeType: change.changeType,
            fieldId: change.fieldId,
            platformFieldId: change.platformFieldId,
            impact,
          },
          'Schema change recorded',
        );
      }

      // Emit real-time event so the UI can refresh the Schema Changes tab
      if (skippedFieldIds.size > 0 || changes.length > 0) {
        await this.eventPublisher.publish({
          tenantId,
          channel: `table:${esTableId}`,
          event: REALTIME_EVENTS.SYNC_SCHEMA_CHANGE_DETECTED,
          payload: {
            connectionId,
            tableId: esTableId,
            changeCount: changes.length,
            changeTypes: [...new Set(changes.map((c) => c.changeType))],
          },
        });
      }
    } catch (error) {
      // Schema detection failure should not block the sync
      logger.error(
        { error },
        'Schema change detection failed — continuing sync without detection',
      );
    }

    return skippedFieldIds;
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
