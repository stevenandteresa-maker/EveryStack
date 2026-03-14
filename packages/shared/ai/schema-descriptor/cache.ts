/**
 * SDS 2-Tier Cache — Redis-backed cache for workspace schema descriptors.
 *
 * Tier 1: Unfiltered workspace schema (shared across all users).
 *   Key: cache:t:{tenantId}:sds:{workspaceId}:{schemaHash}
 *
 * Tier 2: Per-user permission-filtered schema.
 *   Key: cache:t:{tenantId}:sds:{workspaceId}:{userId}:{schemaHash}
 *
 * Invalidation is event-driven:
 * - Schema mutations (field/table/link CRUD) → invalidateWorkspace() (clears both tiers)
 * - Permission changes → invalidateUser() (clears that user's Tier 2 only)
 *
 * TTL: 300s on both tiers as backstop; primary invalidation is event-driven.
 *
 * @see docs/reference/schema-descriptor-service.md § Caching Strategy
 * @see docs/reference/permissions.md § Permission Caching Strategy
 */

import { createRedisClient } from '../../redis';
import { createLogger } from '../../logging/logger';
import type { DrizzleClient } from '../../db/client';
import type { WorkspaceDescriptor } from './types';
import { computeSchemaVersionHash } from './schema-hash';
import { buildWorkspaceDescriptor } from './workspace-builder';
import { filterDescriptorByPermissions } from './permission-filter';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SDS_CACHE_TTL = 300; // seconds (5 minutes)

/** Schema mutation events that trigger workspace invalidation. */
export const SCHEMA_MUTATION_EVENTS = [
  'field_created',
  'field_updated',
  'field_deleted',
  'table_created',
  'table_deleted',
  'link_created',
  'link_deleted',
] as const;

/** Permission events that trigger per-user invalidation. */
export const PERMISSION_EVENTS = ['permission_updated'] as const;

// ---------------------------------------------------------------------------
// Logger & Redis — lazy singleton
// ---------------------------------------------------------------------------

const logger = createLogger({ service: 'sds-cache' });

let redisClient: ReturnType<typeof createRedisClient> | null = null;

function getRedis(): ReturnType<typeof createRedisClient> {
  if (!redisClient) {
    redisClient = createRedisClient('sds-cache');
  }
  return redisClient;
}

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

/**
 * Build Tier 1 cache key (unfiltered workspace schema).
 */
export function buildTier1Key(tenantId: string, workspaceId: string, schemaHash: string): string {
  return `cache:t:${tenantId}:sds:${workspaceId}:${schemaHash}`;
}

/**
 * Build Tier 2 cache key (per-user filtered schema).
 */
export function buildTier2Key(
  tenantId: string,
  workspaceId: string,
  userId: string,
  schemaHash: string,
): string {
  return `cache:t:${tenantId}:sds:${workspaceId}:${userId}:${schemaHash}`;
}

// ---------------------------------------------------------------------------
// SchemaDescriptorCache
// ---------------------------------------------------------------------------

export class SchemaDescriptorCache {
  /**
   * Get a permission-filtered WorkspaceDescriptor for a user.
   *
   * Flow:
   * 1. Compute schema version hash
   * 2. Check Tier 2 (per-user). Hit → return.
   * 3. Check Tier 1 (unfiltered). Hit → filter → store Tier 2 → return.
   * 4. Full miss → build workspace descriptor → store Tier 1 → filter → store Tier 2 → return.
   *
   * Returns null only if the Redis read fails AND the build also fails.
   */
  async getWorkspaceDescriptor(
    workspaceId: string,
    userId: string,
    tenantId: string,
    db: DrizzleClient,
  ): Promise<WorkspaceDescriptor | null> {
    const schemaHash = await computeSchemaVersionHash(workspaceId, tenantId, db);
    const redis = getRedis();

    // --- Tier 2 check (per-user filtered) ---
    const tier2Key = buildTier2Key(tenantId, workspaceId, userId, schemaHash);

    try {
      const tier2Cached = await redis.get(tier2Key);
      if (tier2Cached) {
        return JSON.parse(tier2Cached) as WorkspaceDescriptor;
      }
    } catch (error) {
      logger.warn(
        { error, tenantId, workspaceId, userId },
        'SDS Tier 2 cache read failed — falling through',
      );
    }

    // --- Tier 1 check (unfiltered workspace) ---
    const tier1Key = buildTier1Key(tenantId, workspaceId, schemaHash);
    let unfilteredDescriptor: WorkspaceDescriptor | null = null;

    try {
      const tier1Cached = await redis.get(tier1Key);
      if (tier1Cached) {
        unfilteredDescriptor = JSON.parse(tier1Cached) as WorkspaceDescriptor;
      }
    } catch (error) {
      logger.warn(
        { error, tenantId, workspaceId },
        'SDS Tier 1 cache read failed — falling through to build',
      );
    }

    // --- Tier 1 miss → build ---
    if (!unfilteredDescriptor) {
      unfilteredDescriptor = await buildWorkspaceDescriptor(workspaceId, tenantId, db);

      // Store Tier 1
      try {
        await redis.set(tier1Key, JSON.stringify(unfilteredDescriptor), 'EX', SDS_CACHE_TTL);
      } catch (error) {
        logger.warn(
          { error, tenantId, workspaceId },
          'SDS Tier 1 cache write failed — continuing without cache',
        );
      }
    }

    // --- Filter by permissions → Tier 2 ---
    const filteredDescriptor = await filterDescriptorByPermissions(
      unfilteredDescriptor,
      userId,
      tenantId,
      db,
    );

    // Store Tier 2
    try {
      await redis.set(tier2Key, JSON.stringify(filteredDescriptor), 'EX', SDS_CACHE_TTL);
    } catch (error) {
      logger.warn(
        { error, tenantId, workspaceId, userId },
        'SDS Tier 2 cache write failed — continuing without cache',
      );
    }

    return filteredDescriptor;
  }

  /**
   * Invalidate all cached descriptors for a workspace (both tiers).
   *
   * Called on schema mutation events: field/table/link CRUD.
   * Uses SCAN (not KEYS) to avoid blocking Redis on large keyspaces.
   */
  async invalidateWorkspace(workspaceId: string, tenantId: string): Promise<void> {
    try {
      const redis = getRedis();
      const pattern = `cache:t:${tenantId}:sds:${workspaceId}:*`;
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
        { error, tenantId, workspaceId },
        'SDS workspace cache invalidation failed — non-fatal',
      );
    }
  }

  /**
   * Invalidate a specific user's Tier 2 cached descriptors for a workspace.
   *
   * Called on permission_updated events for this user.
   * Uses SCAN (not KEYS) to avoid blocking Redis on large keyspaces.
   */
  async invalidateUser(workspaceId: string, userId: string, tenantId: string): Promise<void> {
    try {
      const redis = getRedis();
      const pattern = `cache:t:${tenantId}:sds:${workspaceId}:${userId}:*`;
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
        { error, tenantId, workspaceId, userId },
        'SDS user cache invalidation failed — non-fatal',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Test utility — allows injecting a mock Redis client
// ---------------------------------------------------------------------------

/** @internal — for tests only */
export function setRedisClient(client: ReturnType<typeof createRedisClient> | null): void {
  redisClient = client;
}
