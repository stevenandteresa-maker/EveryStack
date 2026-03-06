/**
 * Sync Connection CRUD — Data access functions for base_connections lifecycle.
 *
 * - getConnectionsForTenant: list all connections (never includes oauthTokens)
 * - getConnectionById: single connection detail (no tokens)
 * - getConnectionWithTokens: internal, returns oauthTokens for decrypt
 * - createConnection: insert + audit log in same tx
 * - updateConnectionBase: update external_base_id/name + audit log
 * - updateConnectionTokens: update oauthTokens (for token refresh)
 *
 * @see docs/reference/sync-engine.md § Connection Management
 */

import {
  getDbForTenant,
  eq,
  and,
  desc,
  generateUUIDv7,
  writeAuditLog,
  baseConnections,
} from '@everystack/shared/db';
import type { DrizzleTransaction } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface ConnectionListItem {
  id: string;
  platform: string;
  externalBaseId: string | null;
  externalBaseName: string | null;
  syncDirection: string;
  syncStatus: string;
  lastSyncAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface ConnectionDetail {
  id: string;
  platform: string;
  externalBaseId: string | null;
  externalBaseName: string | null;
  syncDirection: string;
  conflictResolution: string;
  syncStatus: string;
  syncConfig: Record<string, unknown>;
  health: Record<string, unknown>;
  lastSyncAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionWithTokens extends ConnectionDetail {
  oauthTokens: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// getConnectionsForTenant
// ---------------------------------------------------------------------------

/**
 * List all connections for a tenant.
 *
 * Returns safe display fields only — oauthTokens is NEVER included.
 * Ordered by createdAt DESC (newest first).
 */
export async function getConnectionsForTenant(
  tenantId: string,
): Promise<ConnectionListItem[]> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      id: baseConnections.id,
      platform: baseConnections.platform,
      externalBaseId: baseConnections.externalBaseId,
      externalBaseName: baseConnections.externalBaseName,
      syncDirection: baseConnections.syncDirection,
      syncStatus: baseConnections.syncStatus,
      lastSyncAt: baseConnections.lastSyncAt,
      createdBy: baseConnections.createdBy,
      createdAt: baseConnections.createdAt,
    })
    .from(baseConnections)
    .where(eq(baseConnections.tenantId, tenantId))
    .orderBy(desc(baseConnections.createdAt));

  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    externalBaseId: row.externalBaseId,
    externalBaseName: row.externalBaseName,
    syncDirection: row.syncDirection,
    syncStatus: row.syncStatus,
    lastSyncAt: row.lastSyncAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// getConnectionById
// ---------------------------------------------------------------------------

/**
 * Get a single connection by ID.
 *
 * Throws NotFoundError if the connection doesn't exist or belongs to
 * a different tenant (404, not 403, to prevent enumeration).
 * Never includes oauthTokens.
 */
export async function getConnectionById(
  tenantId: string,
  connectionId: string,
): Promise<ConnectionDetail> {
  const db = getDbForTenant(tenantId, 'read');

  const [row] = await db
    .select({
      id: baseConnections.id,
      platform: baseConnections.platform,
      externalBaseId: baseConnections.externalBaseId,
      externalBaseName: baseConnections.externalBaseName,
      syncDirection: baseConnections.syncDirection,
      conflictResolution: baseConnections.conflictResolution,
      syncStatus: baseConnections.syncStatus,
      syncConfig: baseConnections.syncConfig,
      health: baseConnections.health,
      lastSyncAt: baseConnections.lastSyncAt,
      createdBy: baseConnections.createdBy,
      createdAt: baseConnections.createdAt,
      updatedAt: baseConnections.updatedAt,
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

  return {
    id: row.id,
    platform: row.platform,
    externalBaseId: row.externalBaseId,
    externalBaseName: row.externalBaseName,
    syncDirection: row.syncDirection,
    conflictResolution: row.conflictResolution,
    syncStatus: row.syncStatus,
    syncConfig: row.syncConfig,
    health: row.health,
    lastSyncAt: row.lastSyncAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// getConnectionWithTokens (internal)
// ---------------------------------------------------------------------------

/**
 * Get a connection including its encrypted oauthTokens.
 *
 * Used only by server actions that need to decrypt tokens for API calls.
 * Do NOT expose this return type in any client-facing response.
 */
export async function getConnectionWithTokens(
  tenantId: string,
  connectionId: string,
): Promise<ConnectionWithTokens> {
  const db = getDbForTenant(tenantId, 'read');

  const [row] = await db
    .select({
      id: baseConnections.id,
      platform: baseConnections.platform,
      externalBaseId: baseConnections.externalBaseId,
      externalBaseName: baseConnections.externalBaseName,
      syncDirection: baseConnections.syncDirection,
      conflictResolution: baseConnections.conflictResolution,
      syncStatus: baseConnections.syncStatus,
      syncConfig: baseConnections.syncConfig,
      health: baseConnections.health,
      lastSyncAt: baseConnections.lastSyncAt,
      oauthTokens: baseConnections.oauthTokens,
      createdBy: baseConnections.createdBy,
      createdAt: baseConnections.createdAt,
      updatedAt: baseConnections.updatedAt,
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

  return {
    id: row.id,
    platform: row.platform,
    externalBaseId: row.externalBaseId,
    externalBaseName: row.externalBaseName,
    syncDirection: row.syncDirection,
    conflictResolution: row.conflictResolution,
    syncStatus: row.syncStatus,
    syncConfig: row.syncConfig,
    health: row.health,
    lastSyncAt: row.lastSyncAt,
    oauthTokens: row.oauthTokens,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// createConnection
// ---------------------------------------------------------------------------

/**
 * Create a new sync connection after successful OAuth token exchange.
 *
 * Inserts the row and writes an audit log entry in the same transaction.
 * Returns the connection ID.
 */
export async function createConnection(
  tenantId: string,
  userId: string,
  platform: string,
  encryptedTokens: Record<string, unknown>,
): Promise<string> {
  const db = getDbForTenant(tenantId, 'write');
  const id = generateUUIDv7();

  await db.transaction(async (tx) => {
    await tx
      .insert(baseConnections)
      .values({
        id,
        tenantId,
        platform,
        oauthTokens: encryptedTokens,
        syncStatus: 'active',
        createdBy: userId,
      });

    await writeAuditLog(tx as DrizzleTransaction, {
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'connection.created',
      entityType: 'connection',
      entityId: id,
      details: { platform },
      traceId: getTraceId(),
    });
  });

  return id;
}

// ---------------------------------------------------------------------------
// updateConnectionBase
// ---------------------------------------------------------------------------

/**
 * Update the external base selection for a connection.
 *
 * Called after the user picks a base from the list. Writes audit log in
 * the same transaction.
 */
export async function updateConnectionBase(
  tenantId: string,
  userId: string,
  connectionId: string,
  baseId: string,
  baseName: string,
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
        externalBaseId: baseId,
        externalBaseName: baseName,
      })
      .where(eq(baseConnections.id, connectionId));

    await writeAuditLog(tx as DrizzleTransaction, {
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'connection.base_selected',
      entityType: 'connection',
      entityId: connectionId,
      details: { baseId, baseName },
      traceId: getTraceId(),
    });
  });
}

// ---------------------------------------------------------------------------
// updateConnectionTokens
// ---------------------------------------------------------------------------

/**
 * Update encrypted OAuth tokens for a connection (e.g. after refresh).
 *
 * No audit log for token refreshes — they are automated and high-volume.
 */
export async function updateConnectionTokens(
  tenantId: string,
  connectionId: string,
  encryptedTokens: Record<string, unknown>,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  const [existing] = await db
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

  await db
    .update(baseConnections)
    .set({ oauthTokens: encryptedTokens })
    .where(eq(baseConnections.id, connectionId));
}
