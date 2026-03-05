/**
 * API Key CRUD — Data access functions for Platform API key lifecycle.
 *
 * - createApiKey: generates key, stores hash, writes audit log in same tx
 * - listApiKeys: returns safe display fields (never keyHash)
 * - revokeApiKey: sets revoked status, writes audit log in same tx
 * - getApiKeyByHash: cross-tenant lookup by SHA-256 hash (auth middleware)
 *
 * @see docs/reference/platform-api.md § Authentication
 */

import {
  getDbForTenant,
  dbRead,
  eq,
  and,
  desc,
  generateApiKey,
  apiKeyCreateSchema,
  generateUUIDv7,
  writeAuditLog,
  apiKeys,
} from '@everystack/shared/db';
import type { DrizzleTransaction, ApiKeyCreateInput } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface CreateApiKeyResult {
  id: string;
  name: string;
  fullKey: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitTier: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ListApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitTier: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  status: string;
  createdAt: Date;
}

export interface ApiKeyByHashResult {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitTier: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  status: string;
  createdBy: string;
  revokedAt: Date | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// createApiKey
// ---------------------------------------------------------------------------

/**
 * Generate and persist a new API key.
 *
 * Returns the full key ONLY on creation — it is never stored or retrievable
 * after this call. The SHA-256 hash is stored for future authentication.
 * Audit log entry is written within the same transaction.
 */
export async function createApiKey(
  tenantId: string,
  userId: string,
  input: ApiKeyCreateInput,
): Promise<CreateApiKeyResult> {
  const db = getDbForTenant(tenantId, 'write');
  const validated = apiKeyCreateSchema.parse(input);

  const environment = process.env.NODE_ENV === 'production' ? 'live' as const : 'test' as const;
  const { fullKey, keyPrefix, keyHash } = generateApiKey(environment);
  const id = generateUUIDv7();

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(apiKeys)
      .values({
        id,
        tenantId,
        name: validated.name,
        keyHash,
        keyPrefix,
        scopes: validated.scopes,
        rateLimitTier: validated.rateLimitTier,
        expiresAt: validated.expiresAt,
        createdBy: userId,
        status: 'active',
      })
      .returning();

    await writeAuditLog(tx as DrizzleTransaction, {
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'api_key.created',
      entityType: 'api_key',
      entityId: id,
      details: {
        name: validated.name,
        scopes: validated.scopes,
        rateLimitTier: validated.rateLimitTier,
      },
      traceId: getTraceId(),
    });

    return row;
  });

  if (!inserted) {
    throw new Error('Failed to create API key');
  }

  return {
    id: inserted.id,
    name: inserted.name,
    fullKey,
    keyPrefix: inserted.keyPrefix,
    scopes: inserted.scopes as string[],
    rateLimitTier: inserted.rateLimitTier,
    expiresAt: inserted.expiresAt,
    createdAt: inserted.createdAt,
  };
}

// ---------------------------------------------------------------------------
// listApiKeys
// ---------------------------------------------------------------------------

/**
 * List all API keys for a tenant.
 *
 * Returns safe display fields only — keyHash is NEVER included.
 * Ordered by createdAt DESC (newest first).
 */
export async function listApiKeys(tenantId: string): Promise<ListApiKeyItem[]> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      rateLimitTier: apiKeys.rateLimitTier,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      status: apiKeys.status,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId))
    .orderBy(desc(apiKeys.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes as string[],
    rateLimitTier: row.rateLimitTier,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    status: row.status,
    createdAt: row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// revokeApiKey
// ---------------------------------------------------------------------------

/**
 * Revoke an API key. Sets status to 'revoked' and records revokedAt.
 *
 * Throws NotFoundError if the key doesn't exist or belongs to a different
 * tenant (404, not 403, to prevent enumeration).
 * Audit log entry is written within the same transaction.
 */
export async function revokeApiKey(
  tenantId: string,
  userId: string,
  keyId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: apiKeys.id, name: apiKeys.name })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('API key not found');
    }

    await tx
      .update(apiKeys)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(eq(apiKeys.id, keyId));

    await writeAuditLog(tx as DrizzleTransaction, {
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'api_key.revoked',
      entityType: 'api_key',
      entityId: keyId,
      details: {
        keyId,
        name: existing.name,
      },
      traceId: getTraceId(),
    });
  });
}

// ---------------------------------------------------------------------------
// getApiKeyByHash
// ---------------------------------------------------------------------------

/**
 * Look up an API key by its SHA-256 hash. Used by auth middleware.
 *
 * Does NOT use getDbForTenant() — queries across all tenants because the
 * tenant is unknown until the key is resolved. Uses the unique (key_hash)
 * index for fast lookup.
 *
 * Returns null if no key matches.
 */
export async function getApiKeyByHash(
  keyHash: string,
): Promise<ApiKeyByHashResult | null> {
  const [row] = await dbRead
    .select({
      id: apiKeys.id,
      tenantId: apiKeys.tenantId,
      name: apiKeys.name,
      keyHash: apiKeys.keyHash,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      rateLimitTier: apiKeys.rateLimitTier,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      status: apiKeys.status,
      createdBy: apiKeys.createdBy,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    keyHash: row.keyHash,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes as string[],
    rateLimitTier: row.rateLimitTier,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    status: row.status,
    createdBy: row.createdBy,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}
