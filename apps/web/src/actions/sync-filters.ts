'use server';

/**
 * Server Actions — Post-setup sync filter management.
 *
 * - updateSyncFilter: change a table's sync filter and enqueue re-sync
 * - enableSyncTable: re-enable a disabled table
 * - disableSyncTable: disable a table (keeps existing records)
 * - estimateFilteredRecordCount: server-side filter translation + estimate
 *
 * @see docs/reference/sync-engine.md § Sync Filters
 */

import { z } from 'zod';
import { requireRole } from '@everystack/shared/auth';
import {
  canSyncRecords,
  FilterRuleSchema,
  translateFilterToFormula,
  estimateAirtableRecordCount,
} from '@everystack/shared/sync';
import type { SyncConfig, FilterRule } from '@everystack/shared/sync';
import {
  getDbForTenant,
  eq,
  and,
  syncedFieldMappings,
  fields as fieldsTable,
} from '@everystack/shared/db';
import { encryptTokens, decryptTokens } from '@everystack/shared/crypto';
import {
  refreshAirtableToken,
} from '@everystack/shared/sync';
import type { AirtableTokens } from '@everystack/shared/sync';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import {
  getConnectionWithTokens,
  updateConnectionTokens,
} from '@/data/sync-connections';
import { getSyncConfig, updateSyncConfig } from '@/data/sync-setup';
import { getQueue } from '@/lib/queue';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateSyncFilterSchema = z.object({
  connectionId: z.string().uuid(),
  tableId: z.string().min(1),
  newFilter: z.array(FilterRuleSchema),
});

const enableSyncTableSchema = z.object({
  connectionId: z.string().uuid(),
  tableId: z.string().min(1),
  filter: z.array(FilterRuleSchema).optional(),
});

const disableSyncTableSchema = z.object({
  connectionId: z.string().uuid(),
  tableId: z.string().min(1),
});

const estimateFilteredSchema = z.object({
  connectionId: z.string().uuid(),
  baseId: z.string().min(1),
  tableId: z.string().min(1),
  filters: z.array(FilterRuleSchema),
});

// ---------------------------------------------------------------------------
// Token refresh threshold — 5 minutes
// ---------------------------------------------------------------------------

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Shared helper: resolve + auto-refresh access token
// ---------------------------------------------------------------------------

async function resolveAccessToken(
  tenantId: string,
  connectionId: string,
): Promise<string> {
  const connection = await getConnectionWithTokens(tenantId, connectionId);

  if (!connection.oauthTokens) {
    throw new Error('Connection has no OAuth tokens');
  }

  let tokens = decryptTokens<Record<string, unknown>>(
    connection.oauthTokens,
  ) as unknown as AirtableTokens;

  if (tokens.expires_at - Date.now() < REFRESH_THRESHOLD_MS) {
    tokens = await refreshAirtableToken(tokens.refresh_token);

    const tokenRecord: Record<string, unknown> = { ...tokens };
    const encrypted = encryptTokens(tokenRecord);
    await updateConnectionTokens(tenantId, connectionId, encrypted);
  }

  return tokens.access_token;
}

// ---------------------------------------------------------------------------
// updateSyncFilter
// ---------------------------------------------------------------------------

/**
 * Update the sync filter for a specific table, store previous filter
 * for undo support, and enqueue a re-sync job.
 */
export async function updateSyncFilter(
  input: z.input<typeof updateSyncFilterSchema>,
): Promise<{ jobId: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'update');

  const { connectionId, tableId, newFilter } = updateSyncFilterSchema.parse(input);

  try {
    const syncConfig = await getSyncConfig(tenantId, connectionId);
    if (!syncConfig) {
      throw new Error('Sync config not found for this connection');
    }

    const tableIndex = syncConfig.tables.findIndex(
      (t) => t.external_table_id === tableId,
    );
    if (tableIndex === -1) {
      throw new Error('Table not found in sync config');
    }

    const tableConfig = syncConfig.tables[tableIndex]!;

    // Store current filter as previous for undo
    const updatedTable = {
      ...tableConfig,
      previous_sync_filter: tableConfig.sync_filter,
      sync_filter: newFilter.length > 0 ? newFilter : null,
    };

    const updatedConfig: SyncConfig = {
      ...syncConfig,
      tables: syncConfig.tables.map((t, i) =>
        i === tableIndex ? updatedTable : t,
      ),
    };

    // Server-side quota re-check
    const totalEstimated = updatedConfig.tables
      .filter((t) => t.enabled)
      .reduce((sum, t) => sum + t.estimated_record_count, 0);

    const quotaCheck = await canSyncRecords(tenantId, totalEstimated);
    if (!quotaCheck.allowed) {
      throw new Error(
        `Quota exceeded: ${quotaCheck.overageCount} records over limit (${quotaCheck.remaining} remaining)`,
      );
    }

    await updateSyncConfig(tenantId, userId, connectionId, updatedConfig);

    const queue = getQueue('sync');
    const job = await queue.add(
      'sync.initial',
      {
        tenantId,
        connectionId,
        traceId: getTraceId() ?? '',
        triggeredBy: userId,
      },
      { priority: 1 },
    );

    return { jobId: job.id ?? connectionId };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// enableSyncTable
// ---------------------------------------------------------------------------

/**
 * Re-enable a previously disabled table and enqueue an initial sync.
 */
export async function enableSyncTable(
  input: z.input<typeof enableSyncTableSchema>,
): Promise<{ jobId: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'update');

  const { connectionId, tableId, filter } = enableSyncTableSchema.parse(input);

  try {
    const syncConfig = await getSyncConfig(tenantId, connectionId);
    if (!syncConfig) {
      throw new Error('Sync config not found for this connection');
    }

    const tableIndex = syncConfig.tables.findIndex(
      (t) => t.external_table_id === tableId,
    );
    if (tableIndex === -1) {
      throw new Error('Table not found in sync config');
    }

    const tableConfig = syncConfig.tables[tableIndex]!;
    const updatedTable = {
      ...tableConfig,
      enabled: true,
      ...(filter !== undefined ? { sync_filter: filter.length > 0 ? filter : null } : {}),
    };

    const updatedConfig: SyncConfig = {
      ...syncConfig,
      tables: syncConfig.tables.map((t, i) =>
        i === tableIndex ? updatedTable : t,
      ),
    };

    await updateSyncConfig(tenantId, userId, connectionId, updatedConfig);

    const queue = getQueue('sync');
    const job = await queue.add('sync.initial', {
      tenantId,
      connectionId,
      traceId: getTraceId() ?? '',
      triggeredBy: userId,
    });

    return { jobId: job.id ?? connectionId };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// disableSyncTable
// ---------------------------------------------------------------------------

/**
 * Disable a table — existing records are kept but no further syncing occurs.
 */
export async function disableSyncTable(
  input: z.input<typeof disableSyncTableSchema>,
): Promise<{ disabled: boolean }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'update');

  const { connectionId, tableId } = disableSyncTableSchema.parse(input);

  try {
    const syncConfig = await getSyncConfig(tenantId, connectionId);
    if (!syncConfig) {
      throw new Error('Sync config not found for this connection');
    }

    const tableIndex = syncConfig.tables.findIndex(
      (t) => t.external_table_id === tableId,
    );
    if (tableIndex === -1) {
      throw new Error('Table not found in sync config');
    }

    const updatedConfig: SyncConfig = {
      ...syncConfig,
      tables: syncConfig.tables.map((t, i) =>
        i === tableIndex ? { ...t, enabled: false } : t,
      ),
    };

    await updateSyncConfig(tenantId, userId, connectionId, updatedConfig);

    return { disabled: true };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// estimateFilteredRecordCount
// ---------------------------------------------------------------------------

/**
 * Translate FilterRule[] to an Airtable formula server-side (using field
 * mappings for ES ID → external field name), estimate the filtered count,
 * and return quota info.
 */
export async function estimateFilteredRecordCount(
  input: z.input<typeof estimateFilteredSchema>,
): Promise<{
  count: number;
  isExact: boolean;
  quotaRemaining: number;
  quotaAllowed: boolean;
}> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'read');

  const { connectionId, baseId, tableId, filters } =
    estimateFilteredSchema.parse(input);

  try {
    // Build field map: ES field ID → external field name
    const db = getDbForTenant(tenantId, 'read');
    const mappings = await db
      .select({
        fieldId: syncedFieldMappings.fieldId,
        externalFieldId: syncedFieldMappings.externalFieldId,
      })
      .from(syncedFieldMappings)
      .where(
        and(
          eq(syncedFieldMappings.tenantId, tenantId),
          eq(syncedFieldMappings.baseConnectionId, connectionId),
        ),
      );

    // We also need external field names — get them from the fields table
    const fieldIds = mappings.map((m) => m.fieldId);
    const fieldNameMap = new Map<string, string>();

    if (fieldIds.length > 0) {
      const fieldRows = await db
        .select({
          id: fieldsTable.id,
          name: fieldsTable.name,
        })
        .from(fieldsTable)
        .where(
          and(
            eq(fieldsTable.tenantId, tenantId),
          ),
        );

      // Build ES field ID → external field ID map first
      const esIdToExternalId = new Map<string, string>();
      for (const m of mappings) {
        esIdToExternalId.set(m.fieldId, m.externalFieldId);
      }

      // For Airtable, we need external field names (not IDs) for the formula.
      // The field name in the fields table is the external field name at sync time.
      for (const row of fieldRows) {
        const externalId = esIdToExternalId.get(row.id);
        if (externalId) {
          // Use the field name as the Airtable column name for formulas
          fieldNameMap.set(row.id, row.name);
        }
      }
    }

    // Translate filters to Airtable formula
    const filterFormula = translateFilterToFormula(
      filters as FilterRule[],
      fieldNameMap,
    );

    // Get access token and estimate count
    const accessToken = await resolveAccessToken(tenantId, connectionId);
    const estimate = await estimateAirtableRecordCount(
      accessToken,
      baseId,
      tableId,
      filterFormula || undefined,
    );

    // Check quota
    const quotaCheck = await canSyncRecords(tenantId, estimate.count);

    return {
      count: estimate.count,
      isExact: estimate.isExact,
      quotaRemaining: quotaCheck.remaining,
      quotaAllowed: quotaCheck.allowed,
    };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
