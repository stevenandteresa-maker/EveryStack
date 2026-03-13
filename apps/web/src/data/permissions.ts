/**
 * Field permission data access — resolves and caches field-level permissions.
 *
 * Bridges the pure resolution engine (Unit 1) with the database and Redis cache.
 * Loads view, fields, and role context, then delegates to resolveAllFieldPermissions().
 *
 * @see docs/reference/permissions.md § Permission Resolution at Runtime
 * @see packages/shared/auth/permissions/resolve.ts
 */

import { createRedisClient } from '@everystack/shared/redis';
import { webLogger } from '@everystack/shared/logging';
import {
  resolveAllFieldPermissions,
  resolveEffectiveRole,
  viewPermissionsSchema,
} from '@everystack/shared/auth';
import type {
  FieldPermissionMap,
  FieldPermissionState,
  ResolvedPermissionContext,
  ViewPermissions,
} from '@everystack/shared/auth';
import { getViewById } from '@/data/views';
import { getFieldsByTable } from '@/data/fields';
import { getTableById } from '@/data/tables';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PERMISSION_CACHE_KEY_PATTERN = 'cache:t:{tenantId}:perm:{viewId}:{userId}';
export const PERMISSION_CACHE_TTL = 300; // seconds

// ---------------------------------------------------------------------------
// Redis — lazy singleton
// ---------------------------------------------------------------------------

const logger = webLogger;

let redisClient: ReturnType<typeof createRedisClient> | null = null;

function getRedis(): ReturnType<typeof createRedisClient> {
  if (!redisClient) {
    redisClient = createRedisClient('permission-cache');
  }
  return redisClient;
}

/**
 * Build a cache key from the pattern template.
 */
export function buildCacheKey(tenantId: string, viewId: string, userId: string): string {
  return PERMISSION_CACHE_KEY_PATTERN
    .replace('{tenantId}', tenantId)
    .replace('{viewId}', viewId)
    .replace('{userId}', userId);
}

// ---------------------------------------------------------------------------
// Serialization helpers — Map<string, FieldPermissionState> ↔ JSON
// ---------------------------------------------------------------------------

function serializePermissionMap(map: FieldPermissionMap): string {
  const entries: Array<[string, FieldPermissionState]> = [];
  for (const [key, value] of map) {
    entries.push([key, value]);
  }
  return JSON.stringify(entries);
}

function deserializePermissionMap(raw: string): FieldPermissionMap {
  const entries = JSON.parse(raw) as Array<[string, FieldPermissionState]>;
  return new Map(entries);
}

// ---------------------------------------------------------------------------
// getFieldPermissions
// ---------------------------------------------------------------------------

/**
 * Resolve field permissions for a user viewing a specific Table View.
 *
 * 1. Check Redis cache.
 * 2. On miss: load view, fields, role → build context → resolve → cache.
 * 3. Return FieldPermissionMap (field ID → read_write | read_only | hidden).
 */
export async function getFieldPermissions(
  tenantId: string,
  viewId: string,
  userId: string,
): Promise<FieldPermissionMap> {
  const cacheKey = buildCacheKey(tenantId, viewId, userId);

  // 1. Check Redis cache
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return deserializePermissionMap(cached);
    }
  } catch (error) {
    logger.warn(
      { error, tenantId, viewId, userId },
      'Permission cache read failed — falling back to resolution',
    );
  }

  // 2. Cache miss — full resolution
  const view = await getViewById(tenantId, viewId);

  const table = await getTableById(tenantId, view.tableId);

  const tableFields = await getFieldsByTable(tenantId, view.tableId);

  const effectiveRole = await resolveEffectiveRole(userId, tenantId, table.workspace.id);

  if (!effectiveRole) {
    // No access — return all fields as hidden
    const hiddenMap: FieldPermissionMap = new Map();
    for (const field of tableFields) {
      hiddenMap.set(field.id, 'hidden');
    }
    return hiddenMap;
  }

  // Extract view field_overrides from view.config
  const viewConfig = view.config as Record<string, unknown>;
  const fieldOverrides = Array.isArray(viewConfig.columns)
    ? (viewConfig.columns as Array<{ fieldId?: string; visible?: boolean }>)
        .filter((col) => col.visible !== false && col.fieldId)
        .map((col) => col.fieldId as string)
    : tableFields.map((f) => f.id); // No config = all fields visible

  // Parse view permissions JSONB with Zod (defaults to empty arrays)
  const viewPermissions: ViewPermissions = viewPermissionsSchema.parse(
    view.permissions ?? {},
  );

  // Build field-level global permissions map
  const fieldPermissions: Record<string, Record<string, unknown>> = {};
  for (const field of tableFields) {
    fieldPermissions[field.id] = (field.permissions ?? {}) as Record<string, unknown>;
  }

  // Build context and resolve
  const context: ResolvedPermissionContext = {
    userId,
    effectiveRole,
    tableId: view.tableId,
    viewId,
    fieldIds: tableFields.map((f) => f.id),
    viewFieldOverrides: fieldOverrides,
    viewPermissions,
    fieldPermissions,
  };

  const permissionMap = resolveAllFieldPermissions(context);

  // 3. Cache result in Redis
  try {
    const redis = getRedis();
    await redis.set(cacheKey, serializePermissionMap(permissionMap), 'EX', PERMISSION_CACHE_TTL);
  } catch (error) {
    logger.warn(
      { error, tenantId, viewId, userId },
      'Permission cache write failed — continuing without cache',
    );
  }

  return permissionMap;
}

// ---------------------------------------------------------------------------
// invalidatePermissionCache
// ---------------------------------------------------------------------------

/**
 * Invalidate cached permissions.
 *
 * - With userId: delete the specific cache key.
 * - Without userId: SCAN for all user caches for that view and delete them.
 *
 * Uses SCAN (not KEYS) to avoid blocking Redis on large keyspaces.
 */
export async function invalidatePermissionCache(
  tenantId: string,
  viewId: string,
  userId?: string,
): Promise<void> {
  try {
    const redis = getRedis();

    if (userId) {
      const cacheKey = buildCacheKey(tenantId, viewId, userId);
      await redis.del(cacheKey);
      return;
    }

    // Without userId: SCAN for all matching keys
    const pattern = `cache:t:${tenantId}:perm:${viewId}:*`;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    logger.warn(
      { error, tenantId, viewId, userId },
      'Permission cache invalidation failed — non-fatal',
    );
  }
}

// ---------------------------------------------------------------------------
// Test utility — allows injecting a mock Redis client
// ---------------------------------------------------------------------------

/** @internal — for tests only */
export function setRedisClient(client: ReturnType<typeof createRedisClient> | null): void {
  redisClient = client;
}
