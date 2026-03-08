/**
 * InitialSyncProcessor — Progressive initial sync pipeline.
 *
 * BullMQ processor on the 'sync' queue that performs initial data sync
 * from Airtable in stages for progressive UX:
 *   Phase 1: Schema sync (grid headers in <2s)
 *   Phase 2: First page of records per table (interactive in <4s)
 *   Phase 3: Remaining pages in background
 *
 * @see docs/reference/sync-engine.md § Initial Sync
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { InitialSyncJobData } from '@everystack/shared/queue';
import type { EventPublisher } from '@everystack/shared/realtime';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import {
  getDbForTenant,
  baseConnections,
  records,
  syncedFieldMappings,
  fields,
  generateUUIDv7,
  eq,
  and,
} from '@everystack/shared/db';
import {
  AirtableApiClient,
  AirtableAdapter,
  NotionAdapter,
  NotionApiClient,
  registerAirtableTransforms,
  registerNotionTransforms,
  translateFilterToFormula,
  translateToNotionFilter,
  enforceQuotaOnBatch,
  incrementQuotaCache,
  rateLimiter,
} from '@everystack/shared/sync';
import type { SyncConfig, FieldMapping, AirtableTokens, NotionTokens, PlatformAdapter, SyncPlatform } from '@everystack/shared/sync';
import { createInitialSyncMetadata } from '@everystack/shared/sync';
import { decryptTokens } from '@everystack/shared/crypto';
import { BaseProcessor } from '../../lib/base-processor';
import { syncSchema } from './schema-sync';

// Ensure transforms are registered
registerAirtableTransforms();
registerNotionTransforms();

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class InitialSyncProcessor extends BaseProcessor<InitialSyncJobData> {
  private readonly eventPublisher: EventPublisher;
  private readonly airtableAdapter = new AirtableAdapter();
  private readonly notionAdapter = new NotionAdapter();

  constructor(eventPublisher: EventPublisher) {
    super('sync', { concurrency: 3 });
    this.eventPublisher = eventPublisher;
  }

  /** Resolve the correct adapter for the connection's platform. */
  private getAdapter(platform: string): PlatformAdapter {
    if (platform === 'notion') return this.notionAdapter;
    return this.airtableAdapter;
  }

  async processJob(job: Job<InitialSyncJobData>, logger: Logger): Promise<void> {
    const { tenantId, connectionId, workspaceId } = job.data;

    logger.info({ connectionId, workspaceId }, 'Starting initial sync');

    // 1. Load connection with tokens
    const connection = await this.loadConnection(tenantId, connectionId);
    if (!connection.oauthTokens || !connection.externalBaseId) {
      throw new Error('Connection missing tokens or base ID');
    }

    // 2. Decrypt tokens and create platform-specific API client
    const rawTokens = decryptTokens<Record<string, unknown>>(connection.oauthTokens);
    const baseId = connection.externalBaseId;
    const syncConfig = connection.syncConfig as unknown as SyncConfig;
    const platform = (connection.platform ?? 'airtable') as SyncPlatform;

    const airtableClient = platform !== 'notion'
      ? new AirtableApiClient((rawTokens as unknown as AirtableTokens).access_token, baseId ?? '')
      : null;
    const notionClient = platform === 'notion'
      ? new NotionApiClient((rawTokens as unknown as NotionTokens).access_token)
      : null;

    // Legacy alias for schema sync (expects AirtableApiClient)
    const apiClient = airtableClient ?? new AirtableApiClient('', '');

    // 4. Emit SYNC_STARTED
    await this.eventPublisher.publish({
      tenantId,
      channel: `workspace:${workspaceId}`,
      event: REALTIME_EVENTS.SYNC_STARTED,
      payload: { connectionId, baseId },
    });

    try {
      // Phase 1 — Schema sync
      logger.info('Phase 1: Schema sync');
      const { tableMap, updatedSyncConfig } = await syncSchema({
        tenantId,
        connectionId,
        baseId,
        workspaceId,
        createdBy: connection.createdBy,
        syncConfig,
        apiClient,
        eventPublisher: this.eventPublisher,
        logger,
      });

      // Phase 2 — Record sync (per enabled table, sequentially)
      logger.info('Phase 2: Record sync');
      let totalRecordsSynced = 0;

      for (const tableConfig of updatedSyncConfig.tables) {
        if (!tableConfig.enabled) continue;

        const esTableId = tableMap.get(tableConfig.external_table_id);
        if (!esTableId) continue;

        const recordsSynced = await this.syncTableRecords({
          tenantId,
          connectionId,
          baseId: baseId ?? '',
          workspaceId,
          esTableId,
          externalTableId: tableConfig.external_table_id,
          syncFilter: tableConfig.sync_filter,
          createdBy: connection.createdBy,
          platform,
          airtableClient,
          notionClient,
          logger,
        });

        totalRecordsSynced += recordsSynced;

        // Update synced_record_count on the table config
        tableConfig.synced_record_count = recordsSynced;
      }

      // Finalize: update connection status
      const db = getDbForTenant(tenantId);
      await db
        .update(baseConnections)
        .set({
          syncStatus: 'active',
          lastSyncAt: new Date(),
          syncConfig: updatedSyncConfig as unknown as Record<string, unknown>,
          health: {
            ...((connection.health as Record<string, unknown>) ?? {}),
            records_synced: totalRecordsSynced,
            last_sync_type: 'initial',
            last_sync_completed_at: new Date().toISOString(),
          },
        })
        .where(
          and(
            eq(baseConnections.id, connectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        );

      // Emit SYNC_COMPLETED
      await this.eventPublisher.publish({
        tenantId,
        channel: `workspace:${workspaceId}`,
        event: REALTIME_EVENTS.SYNC_COMPLETED,
        payload: {
          connectionId,
          totalRecordsSynced,
          tables: Array.from(tableMap.entries()).map(([extId, esId]) => ({
            externalTableId: extId,
            tableId: esId,
          })),
        },
      });

      logger.info({ totalRecordsSynced }, 'Initial sync completed');
    } catch (error) {
      // Emit SYNC_FAILED
      await this.eventPublisher.publish({
        tenantId,
        channel: `workspace:${workspaceId}`,
        event: REALTIME_EVENTS.SYNC_FAILED,
        payload: {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Update connection status to error
      const db = getDbForTenant(tenantId);
      await db
        .update(baseConnections)
        .set({
          syncStatus: 'error',
          health: {
            ...((connection.health as Record<string, unknown>) ?? {}),
            last_error: error instanceof Error ? error.message : 'Unknown error',
            last_error_at: new Date().toISOString(),
          },
        })
        .where(
          and(
            eq(baseConnections.id, connectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        );

      throw error;
    }
  }

  /**
   * Sync records for a single table: fetch pages from Airtable,
   * transform to canonical, enforce quota, and insert.
   */
  private async syncTableRecords(params: {
    tenantId: string;
    connectionId: string;
    baseId: string;
    workspaceId: string;
    esTableId: string;
    externalTableId: string;
    syncFilter: SyncConfig['tables'][0]['sync_filter'];
    createdBy: string;
    platform: SyncPlatform;
    airtableClient: AirtableApiClient | null;
    notionClient: NotionApiClient | null;
    logger: Logger;
  }): Promise<number> {
    const {
      tenantId,
      connectionId,
      baseId,
      workspaceId,
      esTableId,
      externalTableId,
      syncFilter,
      createdBy,
      platform,
      airtableClient,
      notionClient,
      logger,
    } = params;

    const adapter = this.getAdapter(platform);

    // Build field mappings from synced_field_mappings + fields
    const fieldMappings = await this.buildFieldMappings(tenantId, connectionId, esTableId);

    // Platform-specific filter setup
    let airtableFilterFormula = '';
    let notionFilter: Record<string, unknown> | undefined;
    if (syncFilter && syncFilter.length > 0) {
      if (platform === 'notion') {
        notionFilter = translateToNotionFilter(syncFilter, fieldMappings) as Record<string, unknown> | undefined;
      } else {
        const fieldMap = new Map<string, string>();
        for (const mapping of fieldMappings) {
          fieldMap.set(mapping.fieldId, mapping.externalFieldId);
        }
        airtableFilterFormula = translateFilterToFormula(syncFilter, fieldMap);
      }
    }

    let syncedCount = 0;
    let pageNum = 0;
    let quotaExceeded = false;

    /**
     * Inner helper: process a batch of platform records into canonical inserts.
     * Shared by both Airtable and Notion pagination branches.
     */
    const processBatch = async (
      platformRecords: Array<{ id: string }>,
    ): Promise<boolean> => {
      const canonicalRecords = platformRecords.map((record) => {
        const canonical = adapter.toCanonical(record, fieldMappings);
        return { platformId: record.id, canonical };
      });

      const quotaResult = await enforceQuotaOnBatch(tenantId, canonicalRecords.length);
      const acceptedRecords = canonicalRecords.slice(0, quotaResult.acceptedCount);

      if (acceptedRecords.length > 0) {
        const db = getDbForTenant(tenantId);
        const syncedFieldIds = fieldMappings.map((m) => m.fieldId);
        const recordValues = acceptedRecords.map((r) => ({
          tenantId,
          id: generateUUIDv7(),
          tableId: esTableId,
          canonicalData: r.canonical,
          syncMetadata: createInitialSyncMetadata(
            r.platformId,
            r.canonical,
            syncedFieldIds,
          ) as unknown as Record<string, unknown>,
          createdBy,
        }));

        await db.insert(records).values(recordValues);
        await incrementQuotaCache(tenantId, acceptedRecords.length);
        syncedCount += acceptedRecords.length;
      }

      pageNum++;

      await this.eventPublisher.publish({
        tenantId,
        channel: `workspace:${workspaceId}`,
        event: REALTIME_EVENTS.SYNC_PROGRESS,
        payload: {
          tableId: esTableId,
          syncedCount,
          phase: 'records',
          page: pageNum,
        },
      });

      logger.info(
        { esTableId, page: pageNum, pageSynced: acceptedRecords.length, totalSynced: syncedCount },
        'Page synced',
      );

      if (quotaResult.quotaExceeded) {
        logger.warn({ tenantId, esTableId, syncedCount }, 'Quota exceeded — stopping table sync');
        quotaExceeded = true;
        return false; // stop pagination
      }

      return true; // continue
    };

    if (platform === 'notion' && notionClient) {
      // Notion pagination: start_cursor / has_more
      let startCursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        await rateLimiter.waitForCapacity('notion', `integration:${connectionId}`);

        const queryResult = await notionClient.queryDatabase(externalTableId, {
          pageSize: 100,
          startCursor,
          filter: notionFilter,
        });

        if (queryResult.results.length === 0) break;

        const shouldContinue = await processBatch(queryResult.results);
        if (!shouldContinue) break;

        hasMore = queryResult.has_more;
        startCursor = queryResult.next_cursor;
      }
    } else if (airtableClient) {
      // Airtable pagination: offset string
      let offset: string | undefined;

      do {
        await rateLimiter.waitForCapacity('airtable', `base:${baseId}`);

        const page = await airtableClient.listRecords(externalTableId, {
          pageSize: 100,
          offset,
          filterByFormula: airtableFilterFormula || undefined,
        });

        if (page.records.length === 0) break;

        const shouldContinue = await processBatch(page.records);
        if (!shouldContinue) break;

        offset = page.offset;
      } while (offset);
    }

    if (quotaExceeded) {
      // Update connection health to reflect partial sync
      const db = getDbForTenant(tenantId);
      await db
        .update(baseConnections)
        .set({
          health: {
            quota_exceeded: true,
            quota_exceeded_at: new Date().toISOString(),
          },
        })
        .where(
          and(
            eq(baseConnections.id, connectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        );
    }

    logger.info({ esTableId, syncedCount, quotaExceeded }, 'Table record sync complete');
    return syncedCount;
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

  /**
   * Load connection from DB (duplicates the query from apps/web
   * since the worker can't import web-specific modules).
   */
  private async loadConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<{
    id: string;
    platform: string;
    externalBaseId: string | null;
    syncConfig: Record<string, unknown>;
    health: Record<string, unknown>;
    oauthTokens: Record<string, unknown> | null;
    createdBy: string;
  }> {
    const db = getDbForTenant(tenantId, 'read');

    const [row] = await db
      .select({
        id: baseConnections.id,
        platform: baseConnections.platform,
        externalBaseId: baseConnections.externalBaseId,
        syncConfig: baseConnections.syncConfig,
        health: baseConnections.health,
        oauthTokens: baseConnections.oauthTokens,
        createdBy: baseConnections.createdBy,
      })
      .from(baseConnections)
      .where(
        and(
          eq(baseConnections.id, connectionId),
          eq(baseConnections.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new Error(`Connection ${connectionId} not found for tenant ${tenantId}`);
    }

    return row;
  }
}
