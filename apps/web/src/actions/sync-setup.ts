'use server';

/**
 * Server Actions — Sync Setup Wizard (table listing, record count, quota, save + enqueue)
 *
 * These actions power the 3-step Sync Setup Wizard. All require admin role
 * on the 'connection' resource.
 *
 * @see docs/reference/sync-engine.md § Table Selection Model
 */

import { z } from 'zod';
import { requireRole } from '@everystack/shared/auth';
import {
  listAirtableTables,
  estimateAirtableRecordCount,
  refreshAirtableToken,
  canSyncRecords,
  SyncConfigSchema,
  getNotionDatabaseSchema,
  estimateNotionRecordCount,
} from '@everystack/shared/sync';
import type {
  AirtableTokens,
  AirtableTableMeta,
  NotionTokens,
  NotionDatabaseMeta,
  SyncConfig,
  SyncQuotaCheck,
} from '@everystack/shared/sync';
import { encryptTokens, decryptTokens } from '@everystack/shared/crypto';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import {
  getConnectionWithTokens,
  updateConnectionTokens,
} from '@/data/sync-connections';
import { updateSyncConfig } from '@/data/sync-setup';
import { getQueue } from '@/lib/queue';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const listTablesSchema = z.object({
  connectionId: z.string().uuid(),
  baseId: z.string().min(1),
});

const recordCountSchema = z.object({
  connectionId: z.string().uuid(),
  baseId: z.string().min(1),
  tableId: z.string().min(1),
  filterFormula: z.string().optional(),
});

const checkQuotaSchema = z.object({
  estimatedCount: z.number().int().min(0),
});

const saveSyncConfigSchema = z.object({
  connectionId: z.string().uuid(),
  syncConfig: SyncConfigSchema,
});

const notionDatabaseSchemaInput = z.object({
  connectionId: z.string().uuid(),
  databaseId: z.string().min(1),
});

const notionRecordCountInput = z.object({
  connectionId: z.string().uuid(),
  databaseId: z.string().min(1),
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
  platform: 'airtable' | 'notion' = 'airtable',
): Promise<string> {
  const connection = await getConnectionWithTokens(tenantId, connectionId);

  if (!connection.oauthTokens) {
    throw new Error('Connection has no OAuth tokens');
  }

  // Notion tokens don't expire — no refresh needed
  if (platform === 'notion') {
    const tokens = decryptTokens<Record<string, unknown>>(
      connection.oauthTokens,
    ) as unknown as NotionTokens;
    return tokens.access_token;
  }

  // Airtable tokens may need refresh
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
// listTablesInBase
// ---------------------------------------------------------------------------

/**
 * List all tables and their fields for a connected Airtable base.
 */
export async function listTablesInBase(
  input: z.input<typeof listTablesSchema>,
): Promise<{ tables: AirtableTableMeta[] }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'read');

  const { connectionId, baseId } = listTablesSchema.parse(input);

  try {
    const accessToken = await resolveAccessToken(tenantId, connectionId);
    const tables = await listAirtableTables(accessToken, baseId);
    return { tables };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// fetchEstimatedRecordCount
// ---------------------------------------------------------------------------

/**
 * Estimate the record count for a single table, optionally filtered.
 */
export async function fetchEstimatedRecordCount(
  input: z.input<typeof recordCountSchema>,
): Promise<{ count: number; isExact: boolean }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'read');

  const { connectionId, baseId, tableId, filterFormula } =
    recordCountSchema.parse(input);

  try {
    const accessToken = await resolveAccessToken(tenantId, connectionId);
    return await estimateAirtableRecordCount(
      accessToken,
      baseId,
      tableId,
      filterFormula,
    );
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// checkQuotaForSync
// ---------------------------------------------------------------------------

/**
 * Check whether the tenant's quota allows syncing the estimated record count.
 */
export async function checkQuotaForSync(
  input: z.input<typeof checkQuotaSchema>,
): Promise<SyncQuotaCheck> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'read');

  const { estimatedCount } = checkQuotaSchema.parse(input);

  try {
    return await canSyncRecords(tenantId, estimatedCount);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// saveSyncConfigAndStartSync
// ---------------------------------------------------------------------------

/**
 * Save sync configuration, re-validate quota, and enqueue the initial sync job.
 */
export async function saveSyncConfigAndStartSync(
  input: z.input<typeof saveSyncConfigSchema>,
): Promise<{ jobId: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'update');

  const { connectionId, syncConfig } = saveSyncConfigSchema.parse(input);

  try {
    // Re-check quota server-side before saving
    const totalEstimated = syncConfig.tables
      .filter((t: SyncConfig['tables'][number]) => t.enabled)
      .reduce((sum: number, t: SyncConfig['tables'][number]) => sum + t.estimated_record_count, 0);

    const quotaCheck = await canSyncRecords(tenantId, totalEstimated);
    if (!quotaCheck.allowed) {
      throw new Error(
        `Quota exceeded: ${quotaCheck.overageCount} records over limit (${quotaCheck.remaining} remaining)`,
      );
    }

    // Save sync config
    await updateSyncConfig(tenantId, userId, connectionId, syncConfig);

    // Enqueue initial sync job
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
// Notion-specific: getNotionDatabaseProperties
// ---------------------------------------------------------------------------

/**
 * Retrieve property schema for a Notion database.
 * Equivalent to `listTablesInBase` but for a single Notion database.
 * In Notion, each database is a "table", and properties are "fields".
 */
export async function getNotionDatabaseProperties(
  input: z.input<typeof notionDatabaseSchemaInput>,
): Promise<{ database: NotionDatabaseMeta }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'read');

  const { connectionId, databaseId } = notionDatabaseSchemaInput.parse(input);

  try {
    const accessToken = await resolveAccessToken(tenantId, connectionId, 'notion');
    const database = await getNotionDatabaseSchema(accessToken, databaseId);
    return { database };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// Notion-specific: fetchNotionEstimatedRecordCount
// ---------------------------------------------------------------------------

/**
 * Estimate the record count for a Notion database.
 * Notion does not expose a direct count API — paginates to estimate.
 */
export async function fetchNotionEstimatedRecordCount(
  input: z.input<typeof notionRecordCountInput>,
): Promise<{ count: number; isExact: boolean }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'read');

  const { connectionId, databaseId } = notionRecordCountInput.parse(input);

  try {
    const accessToken = await resolveAccessToken(tenantId, connectionId, 'notion');
    return await estimateNotionRecordCount(accessToken, databaseId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
