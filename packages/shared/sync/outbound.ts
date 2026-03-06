/**
 * Outbound Sync Pipeline — pushes EveryStack edits to the source platform.
 *
 * Flow:
 *   1. Load record's canonical_data and sync_metadata
 *   2. Load field mappings (synced_field_mappings + fields)
 *   3. Filter to only changed, writable, non-computed fields
 *   4. Transform changed fields via fromCanonical() (FieldTypeRegistry)
 *   5. Acquire rate-limit token
 *   6. Call platform API to update the record
 *   7. On success: update sync_metadata.last_synced_values
 *   8. On failure: return error (BullMQ handles retries)
 *
 * @see docs/reference/sync-engine.md § Outbound Sync
 * @see docs/reference/data-model.md lines 649–660
 */

import { createLogger } from '@everystack/shared/logging';
import {
  getDbForTenant,
  records,
  syncedFieldMappings,
  fields,
  baseConnections,
  eq,
  and,
} from '@everystack/shared/db';
import { decryptTokens } from '@everystack/shared/crypto';
import { AirtableApiClient } from './adapters/airtable/api-client';
import { AirtableAdapter } from './adapters/airtable';
import { fieldTypeRegistry } from './field-registry';
import { updateLastSyncedValues } from './sync-metadata';
import type { FieldMapping } from './adapters/types';
import type {
  OutboundSyncJob,
  OutboundSyncResult,
  SyncMetadata,
  CanonicalValue,
  SyncConfig,
} from './types';

const logger = createLogger({ service: 'outbound-sync' });

/** Canonical field types that are computed — never sync back to platforms. */
const COMPUTED_FIELD_TYPES = new Set([
  'lookup',
  'rollup',
  'formula',
  'count',
  'auto_number',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
]);

/**
 * Execute an outbound sync for a single record.
 *
 * Reads the record, transforms changed fields back to platform format,
 * pushes the update to the source platform, and updates sync metadata.
 *
 * Does NOT retry — callers (BullMQ) handle retry logic.
 */
export async function executeOutboundSync(
  job: OutboundSyncJob,
): Promise<OutboundSyncResult> {
  const { tenantId, recordId, tableId, baseConnectionId, changedFieldIds } = job;

  // 1. Load the record
  const db = getDbForTenant(tenantId, 'read');
  const [record] = await db
    .select({
      id: records.id,
      canonicalData: records.canonicalData,
      syncMetadata: records.syncMetadata,
    })
    .from(records)
    .where(and(eq(records.id, recordId), eq(records.tenantId, tenantId)))
    .limit(1);

  if (!record) {
    return {
      success: false,
      platformRecordId: null,
      syncedFieldIds: [],
      skippedFieldIds: changedFieldIds,
      error: `Record ${recordId} not found`,
    };
  }

  const canonicalData = record.canonicalData as Record<string, unknown>;
  const syncMetadata = record.syncMetadata as unknown as SyncMetadata | null;

  if (!syncMetadata?.platform_record_id) {
    return {
      success: false,
      platformRecordId: null,
      syncedFieldIds: [],
      skippedFieldIds: changedFieldIds,
      error: 'Record has no sync metadata or platform_record_id',
    };
  }

  // 2. Load the base connection
  const [connection] = await db
    .select({
      platform: baseConnections.platform,
      externalBaseId: baseConnections.externalBaseId,
      oauthTokens: baseConnections.oauthTokens,
      syncConfig: baseConnections.syncConfig,
      syncDirection: baseConnections.syncDirection,
    })
    .from(baseConnections)
    .where(
      and(
        eq(baseConnections.id, baseConnectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!connection) {
    return {
      success: false,
      platformRecordId: syncMetadata.platform_record_id,
      syncedFieldIds: [],
      skippedFieldIds: changedFieldIds,
      error: `Base connection ${baseConnectionId} not found`,
    };
  }

  // Reject inbound-only connections
  if (connection.syncDirection === 'inbound_only') {
    return {
      success: false,
      platformRecordId: syncMetadata.platform_record_id,
      syncedFieldIds: [],
      skippedFieldIds: changedFieldIds,
      error: 'Connection is inbound_only — outbound sync not allowed',
    };
  }

  // 3. Load field mappings
  const allMappings = await buildFieldMappings(tenantId, baseConnectionId, tableId);

  // 4. Filter to changed, writable, non-computed fields
  const { syncableFieldIds, skippedFieldIds } = filterSyncableFields(
    changedFieldIds,
    allMappings,
    connection.platform,
  );

  if (syncableFieldIds.length === 0) {
    logger.info(
      { recordId, skippedFieldIds },
      'No syncable fields changed — skipping outbound sync',
    );
    return {
      success: true,
      platformRecordId: syncMetadata.platform_record_id,
      syncedFieldIds: [],
      skippedFieldIds,
    };
  }

  // 5. Build the subset of canonical data for changed fields
  const changedCanonical: Record<string, CanonicalValue> = {};
  for (const fieldId of syncableFieldIds) {
    if (fieldId in canonicalData) {
      changedCanonical[fieldId] = canonicalData[fieldId] as CanonicalValue;
    }
  }

  // Filter mappings to only the changed fields
  const changedMappings = allMappings.filter((m) =>
    syncableFieldIds.includes(m.fieldId),
  );

  // 6. Transform to platform format via adapter
  const adapter = new AirtableAdapter();
  const platformFields = adapter.fromCanonical(changedCanonical, changedMappings);

  if (Object.keys(platformFields as Record<string, unknown>).length === 0) {
    logger.info(
      { recordId },
      'All fields filtered by adapter — skipping API call',
    );
    return {
      success: true,
      platformRecordId: syncMetadata.platform_record_id,
      syncedFieldIds: [],
      skippedFieldIds: changedFieldIds,
    };
  }

  // 7. Decrypt tokens and find the external table ID
  if (!connection.oauthTokens || !connection.externalBaseId) {
    return {
      success: false,
      platformRecordId: syncMetadata.platform_record_id,
      syncedFieldIds: [],
      skippedFieldIds: changedFieldIds,
      error: 'Connection missing tokens or base ID',
    };
  }

  const tokens = decryptTokens<{ access_token: string }>(connection.oauthTokens);
  const baseId = connection.externalBaseId;

  // Resolve external table ID from sync config
  const syncConfig = connection.syncConfig as unknown as SyncConfig;
  const externalTableId = resolveExternalTableId(syncConfig, tableId);
  if (!externalTableId) {
    return {
      success: false,
      platformRecordId: syncMetadata.platform_record_id,
      syncedFieldIds: [],
      skippedFieldIds: changedFieldIds,
      error: `Could not resolve external table ID for table ${tableId}`,
    };
  }

  // 8. Acquire rate-limit token and call platform API
  const apiClient = new AirtableApiClient(tokens.access_token, baseId);

  try {
    await apiClient.updateRecord(
      externalTableId,
      syncMetadata.platform_record_id,
      platformFields as Record<string, unknown>,
    );
  } catch (err: unknown) {
    const statusCode = (err as Error & { statusCode?: number }).statusCode;
    const message = err instanceof Error ? err.message : String(err);

    logger.error(
      { recordId, platformRecordId: syncMetadata.platform_record_id, statusCode, err: message },
      'Outbound sync API call failed',
    );

    return {
      success: false,
      platformRecordId: syncMetadata.platform_record_id,
      syncedFieldIds: [],
      skippedFieldIds: changedFieldIds,
      error: message,
      statusCode,
    };
  }

  // 9. Update sync_metadata.last_synced_values on success
  const updatedMetadata = updateLastSyncedValues(
    syncMetadata,
    syncableFieldIds,
    canonicalData,
  );

  const writeDb = getDbForTenant(tenantId);
  await writeDb
    .update(records)
    .set({
      syncMetadata: updatedMetadata as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(and(eq(records.id, recordId), eq(records.tenantId, tenantId)));

  logger.info(
    { recordId, platformRecordId: syncMetadata.platform_record_id, fieldCount: syncableFieldIds.length },
    'Outbound sync completed',
  );

  return {
    success: true,
    platformRecordId: syncMetadata.platform_record_id,
    syncedFieldIds: syncableFieldIds,
    skippedFieldIds,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build FieldMapping[] from synced_field_mappings joined with fields.
 * Same pattern as InitialSyncProcessor.buildFieldMappings().
 */
async function buildFieldMappings(
  tenantId: string,
  connectionId: string,
  tableId: string,
): Promise<FieldMapping[]> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
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
        eq(syncedFieldMappings.tableId, tableId),
        eq(syncedFieldMappings.status, 'active'),
      ),
    );

  return rows.map((row) => ({
    fieldId: row.fieldId,
    externalFieldId: row.externalFieldId,
    externalFieldType: row.externalFieldType,
    fieldType: row.fieldType,
    config: (row.config as Record<string, unknown>) ?? {},
  }));
}

/**
 * Filter changed field IDs to only those that are:
 * - Present in field mappings (synced)
 * - Not computed field types (Lookup, Rollup, Formula, Count, system fields)
 * - Writable in the FieldTypeRegistry (supportedOperations includes 'write')
 * - Lossless (isLossless=true) — lossy transforms should not be pushed back
 */
function filterSyncableFields(
  changedFieldIds: string[],
  mappings: FieldMapping[],
  platform: string,
): { syncableFieldIds: string[]; skippedFieldIds: string[] } {
  const mappingByFieldId = new Map(mappings.map((m) => [m.fieldId, m]));
  const syncableFieldIds: string[] = [];
  const skippedFieldIds: string[] = [];

  for (const fieldId of changedFieldIds) {
    const mapping = mappingByFieldId.get(fieldId);

    // Not a synced field — skip
    if (!mapping) {
      skippedFieldIds.push(fieldId);
      continue;
    }

    // Computed field type — never sync back
    if (COMPUTED_FIELD_TYPES.has(mapping.fieldType)) {
      skippedFieldIds.push(fieldId);
      continue;
    }

    // Check registry for write support
    if (!fieldTypeRegistry.has(platform, mapping.externalFieldType)) {
      skippedFieldIds.push(fieldId);
      continue;
    }

    const transform = fieldTypeRegistry.get(platform, mapping.externalFieldType);

    if (!transform.supportedOperations.includes('write')) {
      skippedFieldIds.push(fieldId);
      continue;
    }

    if (!transform.isLossless) {
      skippedFieldIds.push(fieldId);
      continue;
    }

    syncableFieldIds.push(fieldId);
  }

  return { syncableFieldIds, skippedFieldIds };
}

/**
 * Resolve the external (platform) table ID for a given ES table.
 * Matches by `es_table_id` stored in the sync config during schema sync.
 */
function resolveExternalTableId(
  syncConfig: SyncConfig,
  tableId: string,
): string | null {
  if (!syncConfig?.tables) return null;

  // Primary: match by es_table_id (set during schema sync)
  for (const tableConfig of syncConfig.tables) {
    if (tableConfig.es_table_id === tableId) {
      return tableConfig.external_table_id;
    }
  }

  // Fallback for connections synced before es_table_id was stored:
  // if there's exactly one enabled table, use it
  const enabledTables = syncConfig.tables.filter((t) => t.enabled);
  if (enabledTables.length === 1) {
    return enabledTables[0]!.external_table_id;
  }

  return null;
}
