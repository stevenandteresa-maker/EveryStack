/**
 * Sync Setup — Data access functions for sync configuration lifecycle.
 *
 * - getSyncConfig: read sync_config JSONB from a connection
 * - updateSyncConfig: write sync_config + audit log in same tx
 *
 * @see docs/reference/sync-engine.md § Table Selection Model
 */

import {
  getDbForTenant,
  eq,
  and,
  writeAuditLog,
  baseConnections,
} from '@everystack/shared/db';
import type { DrizzleTransaction } from '@everystack/shared/db';
import type { SyncConfig } from '@everystack/shared/sync';
import { NotFoundError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// getSyncConfig
// ---------------------------------------------------------------------------

/**
 * Read the sync_config JSONB for a connection.
 *
 * Returns null if the connection exists but has no sync_config set yet.
 * Throws NotFoundError if the connection doesn't exist for this tenant.
 */
export async function getSyncConfig(
  tenantId: string,
  connectionId: string,
): Promise<SyncConfig | null> {
  const db = getDbForTenant(tenantId, 'read');

  const [row] = await db
    .select({
      id: baseConnections.id,
      syncConfig: baseConnections.syncConfig,
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
    throw new NotFoundError('Connection not found');
  }

  const config = row.syncConfig as Record<string, unknown> | null;
  if (!config || Object.keys(config).length === 0) {
    return null;
  }

  return config as unknown as SyncConfig;
}

// ---------------------------------------------------------------------------
// updateSyncConfig
// ---------------------------------------------------------------------------

/**
 * Write the sync_config JSONB for a connection and log the change.
 *
 * Throws NotFoundError if the connection doesn't exist for this tenant.
 */
export async function updateSyncConfig(
  tenantId: string,
  userId: string,
  connectionId: string,
  syncConfig: SyncConfig,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: baseConnections.id })
      .from(baseConnections)
      .where(
        and(
          eq(baseConnections.id, connectionId),
          eq(baseConnections.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Connection not found');
    }

    await tx
      .update(baseConnections)
      .set({
        syncConfig: syncConfig as unknown as Record<string, unknown>,
      })
      .where(eq(baseConnections.id, connectionId));

    await writeAuditLog(tx as DrizzleTransaction, {
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'connection.sync_config_updated',
      entityType: 'connection',
      entityId: connectionId,
      details: {
        tableCount: syncConfig.tables.filter((t) => t.enabled).length,
        pollingInterval: syncConfig.polling_interval_seconds,
      },
      traceId: getTraceId(),
    });
  });
}
