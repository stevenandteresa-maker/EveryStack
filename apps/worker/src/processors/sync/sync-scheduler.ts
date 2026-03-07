/**
 * SyncScheduler — Smart polling with adaptive intervals.
 *
 * Replaces fixed-interval polling with visibility-aware scheduling:
 * - Active (table viewed): 30s polling
 * - Background (workspace open): 5 min polling
 * - Inactive (no connected clients): 30 min polling
 * - Event-driven (Airtable webhooks): no polling
 *
 * Converted tables (sync_status: converted | converted_finalized) are skipped.
 * Dual-write tables dispatch shadow-only sync jobs.
 *
 * The scheduler itself runs as a repeatable BullMQ job every 30 seconds,
 * evaluating all active base_connections and enqueueing sync jobs when
 * enough time has elapsed since the last poll for each table.
 *
 * @see docs/reference/sync-engine.md § Smart Polling & Real-Time Push
 */

import type Redis from 'ioredis';
import type { Queue } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import {
  workerLogger,
  createChildLogger,
  generateTraceId,
} from '@everystack/shared/logging';
import {
  dbRead,
  baseConnections,
  tables as tablesSchema,
  sql,
  inArray,
} from '@everystack/shared/db';
import type { IncrementalSyncJobData } from '@everystack/shared/queue';
import {
  POLLING_INTERVALS,
} from '@everystack/shared/sync';
import type {
  TableVisibility,
  SyncConfig,
  SyncConfigWebhooks,
} from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Redis key prefix for per-table last-poll timestamps. */
const LAST_POLL_PREFIX = 'sync:last_poll';

/** Scheduler run interval — the scheduler itself runs every 30 seconds. */
export const SCHEDULER_INTERVAL_MS = 30_000;

/** Sync statuses that should be skipped entirely (no sync jobs dispatched). */
const SKIP_STATUSES: ReadonlySet<string> = new Set(['converted', 'converted_finalized']);

/** Sync statuses that should dispatch shadow-only sync jobs. */
const SHADOW_ONLY_STATUSES: ReadonlySet<string> = new Set(['converted_dual_write']);

/** Sync statuses that are not eligible for polling (paused, error, auth required). */
const INACTIVE_STATUSES: ReadonlySet<string> = new Set(['paused', 'error', 'auth_required']);

// ---------------------------------------------------------------------------
// Visibility resolution
// ---------------------------------------------------------------------------

/**
 * Determines the visibility state of a table by checking Socket.io room
 * membership via Redis.
 *
 * Socket.io with the Redis adapter stores room membership under a known
 * key pattern. We check:
 * 1. Is anyone in the `table:{tableId}` room? → 'active'
 * 2. Is anyone in the `workspace:{workspaceId}` room? → 'background'
 * 3. Otherwise → 'inactive'
 */
export async function resolveTableVisibility(
  redis: Redis,
  tenantId: string,
  tableId: string,
  workspaceId: string,
): Promise<TableVisibility> {
  // Check if any client is viewing this specific table
  const tableRoom = `t:${tenantId}:table:${tableId}`;
  const tableMembers = await getSocketIoRoomSize(redis, tableRoom);
  if (tableMembers > 0) return 'active';

  // Check if any client is connected to the workspace
  const workspaceRoom = `t:${tenantId}:workspace:${workspaceId}`;
  const workspaceMembers = await getSocketIoRoomSize(redis, workspaceRoom);
  if (workspaceMembers > 0) return 'background';

  return 'inactive';
}

/**
 * Gets the number of members in a Socket.io room via the Redis adapter.
 *
 * The socket.io-redis adapter stores room→socket mappings in Redis sets.
 * The key pattern is: `socket.io#/{namespace}#${roomName}#`
 * Default namespace is '/'.
 */
export async function getSocketIoRoomSize(
  redis: Redis,
  roomName: string,
): Promise<number> {
  const key = `socket.io#/#${roomName}#`;
  const size = await redis.scard(key);
  return size;
}

// ---------------------------------------------------------------------------
// Polling interval resolution
// ---------------------------------------------------------------------------

/**
 * Determines the polling interval for a table based on its visibility state
 * and whether it has an active webhook.
 *
 * @returns Polling interval in milliseconds, or null if event-driven (no polling needed).
 */
export function getPollingInterval(
  platform: string,
  tableVisibility: TableVisibility,
  hasWebhook: boolean,
): number | null {
  // If an active webhook is registered, no polling needed
  if (hasWebhook && platform === 'airtable') {
    return POLLING_INTERVALS.EVENT_DRIVEN;
  }

  switch (tableVisibility) {
    case 'active':
      return POLLING_INTERVALS.ACTIVE_VIEWING;
    case 'background':
      return POLLING_INTERVALS.TAB_OPEN_NOT_VISIBLE;
    case 'inactive':
      return POLLING_INTERVALS.WORKSPACE_INACTIVE;
  }
}

// ---------------------------------------------------------------------------
// Converted table skip logic
// ---------------------------------------------------------------------------

/**
 * Determines the sync dispatch behavior for a connection based on its sync_status.
 *
 * @returns 'normal' | 'shadow_only' | 'skip'
 */
export function getSyncDispatchMode(
  syncStatus: string,
): 'normal' | 'shadow_only' | 'skip' {
  if (SKIP_STATUSES.has(syncStatus)) return 'skip';
  if (SHADOW_ONLY_STATUSES.has(syncStatus)) return 'shadow_only';
  if (INACTIVE_STATUSES.has(syncStatus)) return 'skip';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Redis last-poll tracking
// ---------------------------------------------------------------------------

/**
 * Gets the last poll timestamp for a table from Redis.
 * Returns 0 if no previous poll recorded (first sync should always trigger).
 */
export async function getLastPollTime(
  redis: Redis,
  baseConnectionId: string,
  tableId: string,
): Promise<number> {
  const key = `${LAST_POLL_PREFIX}:${baseConnectionId}:${tableId}`;
  const value = await redis.get(key);
  return value ? Number(value) : 0;
}

/**
 * Sets the last poll timestamp for a table in Redis.
 * TTL is set to 2 hours to auto-cleanup stale entries.
 */
export async function setLastPollTime(
  redis: Redis,
  baseConnectionId: string,
  tableId: string,
  timestamp: number = Date.now(),
): Promise<void> {
  const key = `${LAST_POLL_PREFIX}:${baseConnectionId}:${tableId}`;
  const TWO_HOURS = 7200;
  await redis.set(key, String(timestamp), 'EX', TWO_HOURS);
}

// ---------------------------------------------------------------------------
// Webhook helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a connection has an active Airtable webhook.
 */
export function hasActiveWebhook(
  syncConfig: SyncConfig,
): boolean {
  const webhooks = (syncConfig as SyncConfig & { webhooks?: SyncConfigWebhooks }).webhooks;
  return Boolean(webhooks?.airtable_webhook_id && webhooks?.webhook_registered_at);
}

// ---------------------------------------------------------------------------
// Scheduler — main loop
// ---------------------------------------------------------------------------

/** Shape of a base_connection row as queried by the scheduler. */
interface SchedulerConnection {
  id: string;
  tenantId: string;
  platform: string;
  syncStatus: string;
  syncConfig: unknown;
}

/** Map from es_table_id → workspace_id, resolved in bulk. */
type WorkspaceMap = Map<string, string>;

/**
 * Runs a single scheduler tick: evaluates all active base_connections,
 * resolves visibility for each table, and enqueues sync jobs when
 * enough time has elapsed.
 */
export async function runSchedulerTick(
  redis: Redis,
  syncQueue: Queue<IncrementalSyncJobData>,
  logger: Logger,
): Promise<{ evaluated: number; dispatched: number; skipped: number }> {
  let evaluated = 0;
  let dispatched = 0;
  let skipped = 0;

  // Fetch all active connections across all tenants
  const connections = await getAllActiveConnections();

  // Collect all es_table_ids to resolve workspaces in bulk
  const allTableIds: string[] = [];
  for (const connection of connections) {
    const syncConfig = connection.syncConfig as SyncConfig | undefined;
    if (!syncConfig?.tables) continue;
    for (const t of syncConfig.tables) {
      if (t.enabled && t.es_table_id) allTableIds.push(t.es_table_id);
    }
  }

  const workspaceMap = await resolveWorkspaceIds(allTableIds);

  for (const connection of connections) {
    const dispatchMode = getSyncDispatchMode(connection.syncStatus);

    if (dispatchMode === 'skip') {
      skipped++;
      continue;
    }

    const syncConfig = connection.syncConfig as SyncConfig | undefined;
    if (!syncConfig?.tables) continue;

    const webhookActive = hasActiveWebhook(syncConfig);

    for (const tableConfig of syncConfig.tables) {
      if (!tableConfig.enabled || !tableConfig.es_table_id) continue;
      evaluated++;

      const workspaceId = workspaceMap.get(tableConfig.es_table_id);
      if (!workspaceId) continue;

      // Resolve visibility for this table
      const visibility = await resolveTableVisibility(
        redis,
        connection.tenantId,
        tableConfig.es_table_id,
        workspaceId,
      );

      // Determine polling interval
      const interval = getPollingInterval(
        connection.platform,
        visibility,
        webhookActive,
      );

      // Event-driven tables don't poll
      if (interval === null) {
        skipped++;
        continue;
      }

      // Check if enough time has elapsed since last poll
      const lastPoll = await getLastPollTime(
        redis,
        connection.id,
        tableConfig.es_table_id,
      );
      const elapsed = Date.now() - lastPoll;

      if (elapsed < interval) continue;

      // Enqueue incremental sync job
      const traceId = generateTraceId();
      await syncQueue.add(
        'incremental-sync',
        {
          tenantId: connection.tenantId,
          connectionId: connection.id,
          jobType: 'incremental',
          traceId,
          triggeredBy: 'scheduler',
        },
        {
          jobId: `sync:${connection.id}:${Date.now()}`,
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      // Update last poll time
      await setLastPollTime(redis, connection.id, tableConfig.es_table_id);
      dispatched++;

      logger.debug(
        {
          connectionId: connection.id,
          tableId: tableConfig.es_table_id,
          visibility,
          interval,
          elapsed,
        },
        'Dispatched incremental sync',
      );
    }
  }

  return { evaluated, dispatched, skipped };
}

/**
 * Resolves workspace IDs for a list of table IDs in bulk.
 */
async function resolveWorkspaceIds(tableIds: string[]): Promise<WorkspaceMap> {
  const map: WorkspaceMap = new Map();
  if (tableIds.length === 0) return map;

  const rows = await dbRead
    .select({
      id: tablesSchema.id,
      workspaceId: tablesSchema.workspaceId,
    })
    .from(tablesSchema)
    .where(inArray(tablesSchema.id, tableIds));

  for (const row of rows) {
    map.set(row.id, row.workspaceId);
  }
  return map;
}

/**
 * Fetches all base_connections that are candidates for polling.
 * Excludes converted/finalized and inactive connections at the query level.
 *
 * Uses `dbRead` directly — the scheduler is a system-level process
 * that scans all tenants, not scoped to a single tenant.
 */
async function getAllActiveConnections(): Promise<SchedulerConnection[]> {
  return dbRead
    .select({
      id: baseConnections.id,
      tenantId: baseConnections.tenantId,
      platform: baseConnections.platform,
      syncStatus: baseConnections.syncStatus,
      syncConfig: baseConnections.syncConfig,
    })
    .from(baseConnections)
    .where(
      sql`${baseConnections.syncStatus} NOT IN ('converted', 'converted_finalized', 'paused', 'error', 'auth_required')`,
    );
}

// ---------------------------------------------------------------------------
// Airtable Webhook Registration
// ---------------------------------------------------------------------------

/**
 * Attempts to register an Airtable webhook for a base connection.
 * Falls back gracefully to polling if registration fails.
 *
 * @returns The webhook ID if registration succeeded, null otherwise.
 */
export async function registerAirtableWebhook(
  accessToken: string,
  baseId: string,
  notificationUrl: string,
  logger: Logger,
): Promise<{ webhookId: string; cursor: string } | null> {
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/bases/${baseId}/webhooks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationUrl,
          specification: {
            options: {
              filters: {
                dataTypes: ['tableData'],
                recordChangeScope: baseId,
              },
            },
          },
        }),
      },
    );

    if (!response.ok) {
      logger.warn(
        { status: response.status, baseId },
        'Airtable webhook registration failed — falling back to polling',
      );
      return null;
    }

    const data = (await response.json()) as { id: string; macSecretBase64: string; expirationTime: string };
    logger.info({ webhookId: data.id, baseId }, 'Airtable webhook registered');

    return { webhookId: data.id, cursor: '0' };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), baseId },
      'Airtable webhook registration error — falling back to polling',
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// SyncScheduler class — manages the scheduling loop
// ---------------------------------------------------------------------------

export class SyncScheduler {
  private readonly redis: Redis;
  private readonly syncQueue: Queue<IncrementalSyncJobData>;
  private readonly logger: Logger;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    redis: Redis,
    syncQueue: Queue<IncrementalSyncJobData>,
  ) {
    this.redis = redis;
    this.syncQueue = syncQueue;
    this.logger = createChildLogger(workerLogger, { service: 'sync-scheduler' });
  }

  /**
   * Starts the scheduler loop, running a tick every SCHEDULER_INTERVAL_MS.
   */
  start(): void {
    if (this.intervalHandle) {
      this.logger.warn('Scheduler already running');
      return;
    }

    this.logger.info(
      { intervalMs: SCHEDULER_INTERVAL_MS },
      'Sync scheduler started',
    );

    // Run first tick immediately
    void this.tick();

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, SCHEDULER_INTERVAL_MS);
  }

  /**
   * Stops the scheduler loop.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.info('Sync scheduler stopped');
    }
  }

  /**
   * Runs a single scheduler tick.
   */
  private async tick(): Promise<void> {
    try {
      const result = await runSchedulerTick(
        this.redis,
        this.syncQueue,
        this.logger,
      );

      if (result.dispatched > 0 || result.skipped > 0) {
        this.logger.info(
          result,
          'Scheduler tick complete',
        );
      }
    } catch (err) {
      this.logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'Scheduler tick failed',
      );
    }
  }
}
