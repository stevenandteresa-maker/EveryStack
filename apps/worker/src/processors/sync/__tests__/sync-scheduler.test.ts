import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';
import type { Queue } from 'bullmq';
import type { IncrementalSyncJobData } from '@everystack/shared/queue';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockDbSelect,
  mockDbFrom,
  mockDbWhere,
  mockLoggerInstance,
} = vi.hoisted(() => {
  const mockDbWhere = vi.fn().mockResolvedValue([]);
  const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
  const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));
  const mockLoggerInstance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  return { mockDbSelect, mockDbFrom, mockDbWhere, mockLoggerInstance };
});

vi.mock('@everystack/shared/db', () => ({
  dbRead: {
    select: mockDbSelect,
    from: mockDbFrom,
  },
  baseConnections: {
    id: 'id',
    tenantId: 'tenant_id',
    platform: 'platform',
    syncStatus: 'sync_status',
    syncConfig: 'sync_config',
  },
  tables: {
    id: 'id',
    workspaceId: 'workspace_id',
  },
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''),
    { identifier: (name: string) => name },
  ),
  inArray: vi.fn(),
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn(),
}));

vi.mock('@everystack/shared/logging', () => ({
  workerLogger: mockLoggerInstance,
  realtimeLogger: mockLoggerInstance,
  createLogger: vi.fn(() => mockLoggerInstance),
  createChildLogger: vi.fn(() => mockLoggerInstance),
  generateTraceId: vi.fn(() => 'trace-123'),
  runWithTraceContext: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
  generateSpanId: vi.fn(() => 'span-123'),
  getTraceId: vi.fn(() => 'trace-123'),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  getPollingInterval,
  getSyncDispatchMode,
  resolveTableVisibility,
  getSocketIoRoomSize,
  getLastPollTime,
  setLastPollTime,
  hasActiveWebhook,
  registerAirtableWebhook,
  runSchedulerTick,
  SCHEDULER_INTERVAL_MS,
} from '../sync-scheduler';
import { POLLING_INTERVALS } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRedis(): Redis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    scard: vi.fn().mockResolvedValue(0),
  } as unknown as Redis;
}

function createMockQueue(): Queue<IncrementalSyncJobData> {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  } as unknown as Queue<IncrementalSyncJobData>;
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getPollingInterval', () => {
  it('returns ACTIVE_VIEWING (30s) for active visibility', () => {
    expect(getPollingInterval('airtable', 'active', false)).toBe(POLLING_INTERVALS.ACTIVE_VIEWING);
    expect(getPollingInterval('notion', 'active', false)).toBe(POLLING_INTERVALS.ACTIVE_VIEWING);
  });

  it('returns TAB_OPEN_NOT_VISIBLE (5min) for background visibility', () => {
    expect(getPollingInterval('airtable', 'background', false)).toBe(POLLING_INTERVALS.TAB_OPEN_NOT_VISIBLE);
    expect(getPollingInterval('notion', 'background', false)).toBe(POLLING_INTERVALS.TAB_OPEN_NOT_VISIBLE);
  });

  it('returns WORKSPACE_INACTIVE (30min) for inactive visibility', () => {
    expect(getPollingInterval('airtable', 'inactive', false)).toBe(POLLING_INTERVALS.WORKSPACE_INACTIVE);
    expect(getPollingInterval('notion', 'inactive', false)).toBe(POLLING_INTERVALS.WORKSPACE_INACTIVE);
  });

  it('returns null (EVENT_DRIVEN) for airtable with active webhook', () => {
    expect(getPollingInterval('airtable', 'active', true)).toBeNull();
    expect(getPollingInterval('airtable', 'background', true)).toBeNull();
    expect(getPollingInterval('airtable', 'inactive', true)).toBeNull();
  });

  it('ignores webhooks for non-airtable platforms', () => {
    expect(getPollingInterval('notion', 'active', true)).toBe(POLLING_INTERVALS.ACTIVE_VIEWING);
    expect(getPollingInterval('smartsuite', 'inactive', true)).toBe(POLLING_INTERVALS.WORKSPACE_INACTIVE);
  });
});

describe('getSyncDispatchMode', () => {
  it('returns skip for converted statuses', () => {
    expect(getSyncDispatchMode('converted')).toBe('skip');
    expect(getSyncDispatchMode('converted_finalized')).toBe('skip');
  });

  it('returns shadow_only for converted_dual_write', () => {
    expect(getSyncDispatchMode('converted_dual_write')).toBe('shadow_only');
  });

  it('returns skip for inactive statuses', () => {
    expect(getSyncDispatchMode('paused')).toBe('skip');
    expect(getSyncDispatchMode('error')).toBe('skip');
    expect(getSyncDispatchMode('auth_required')).toBe('skip');
  });

  it('returns normal for active status', () => {
    expect(getSyncDispatchMode('active')).toBe('normal');
  });
});

describe('resolveTableVisibility', () => {
  let redis: Redis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  it('returns active when table room has members', async () => {
    (redis.scard as ReturnType<typeof vi.fn>).mockResolvedValueOnce(2);
    const result = await resolveTableVisibility(redis, 'tenant-1', 'table-1', 'ws-1');
    expect(result).toBe('active');
  });

  it('returns background when workspace room has members but table room is empty', async () => {
    (redis.scard as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0) // table room
      .mockResolvedValueOnce(3); // workspace room
    const result = await resolveTableVisibility(redis, 'tenant-1', 'table-1', 'ws-1');
    expect(result).toBe('background');
  });

  it('returns inactive when no rooms have members', async () => {
    (redis.scard as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const result = await resolveTableVisibility(redis, 'tenant-1', 'table-1', 'ws-1');
    expect(result).toBe('inactive');
  });

  it('checks correct Socket.io room key patterns', async () => {
    await resolveTableVisibility(redis, 'tenant-1', 'table-1', 'ws-1');
    expect(redis.scard).toHaveBeenCalledWith('socket.io#/#t:tenant-1:table:table-1#');
    expect(redis.scard).toHaveBeenCalledWith('socket.io#/#t:tenant-1:workspace:ws-1#');
  });
});

describe('getSocketIoRoomSize', () => {
  it('returns the scard count from Redis', async () => {
    const redis = createMockRedis();
    (redis.scard as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    const size = await getSocketIoRoomSize(redis, 'my-room');
    expect(size).toBe(5);
    expect(redis.scard).toHaveBeenCalledWith('socket.io#/#my-room#');
  });
});

describe('getLastPollTime / setLastPollTime', () => {
  let redis: Redis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  it('returns 0 when no previous poll exists', async () => {
    const result = await getLastPollTime(redis, 'conn-1', 'table-1');
    expect(result).toBe(0);
    expect(redis.get).toHaveBeenCalledWith('sync:last_poll:conn-1:table-1');
  });

  it('returns stored timestamp when exists', async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue('1709000000000');
    const result = await getLastPollTime(redis, 'conn-1', 'table-1');
    expect(result).toBe(1709000000000);
  });

  it('sets timestamp with 2-hour TTL', async () => {
    const now = 1709000000000;
    await setLastPollTime(redis, 'conn-1', 'table-1', now);
    expect(redis.set).toHaveBeenCalledWith(
      'sync:last_poll:conn-1:table-1',
      '1709000000000',
      'EX',
      7200,
    );
  });
});

describe('hasActiveWebhook', () => {
  it('returns true when webhook ID and registered_at are present', () => {
    const config = {
      polling_interval_seconds: 300,
      tables: [],
      webhooks: {
        airtable_webhook_id: 'wh-123',
        webhook_registered_at: '2026-01-01T00:00:00Z',
      },
    };
    expect(hasActiveWebhook(config as never)).toBe(true);
  });

  it('returns false when no webhook config', () => {
    const config = { polling_interval_seconds: 300, tables: [] };
    expect(hasActiveWebhook(config)).toBe(false);
  });

  it('returns false when webhook ID is missing', () => {
    const config = {
      polling_interval_seconds: 300,
      tables: [],
      webhooks: { webhook_registered_at: '2026-01-01T00:00:00Z' },
    };
    expect(hasActiveWebhook(config as never)).toBe(false);
  });
});

describe('registerAirtableWebhook', () => {
  const logger = createMockLogger();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns webhook ID on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'wh-new-123',
        macSecretBase64: 'secret',
        expirationTime: '2026-12-31T00:00:00Z',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await registerAirtableWebhook(
      'token-123',
      'app123',
      'https://example.com/webhook',
      logger as never,
    );

    expect(result).toEqual({ webhookId: 'wh-new-123', cursor: '0' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.airtable.com/v0/bases/app123/webhooks',
      expect.objectContaining({ method: 'POST' }),
    );

    vi.unstubAllGlobals();
  });

  it('returns null on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    const result = await registerAirtableWebhook(
      'token-123',
      'app123',
      'https://example.com/webhook',
      logger as never,
    );

    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await registerAirtableWebhook(
      'token-123',
      'app123',
      'https://example.com/webhook',
      logger as never,
    );

    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('SCHEDULER_INTERVAL_MS', () => {
  it('is 30 seconds', () => {
    expect(SCHEDULER_INTERVAL_MS).toBe(30_000);
  });
});

describe('POLLING_INTERVALS', () => {
  it('has correct values', () => {
    expect(POLLING_INTERVALS.ACTIVE_VIEWING).toBe(30_000);
    expect(POLLING_INTERVALS.TAB_OPEN_NOT_VISIBLE).toBe(300_000);
    expect(POLLING_INTERVALS.WORKSPACE_INACTIVE).toBe(1_800_000);
    expect(POLLING_INTERVALS.EVENT_DRIVEN).toBeNull();
  });
});

describe('runSchedulerTick', () => {
  let redis: Redis;
  let queue: Queue<IncrementalSyncJobData>;
  const logger = createMockLogger();

  beforeEach(() => {
    redis = createMockRedis();
    queue = createMockQueue();
    vi.clearAllMocks();
  });

  it('returns zeroes when no connections exist', async () => {
    // getAllActiveConnections returns empty (default mock)
    const result = await runSchedulerTick(redis, queue, logger as never);
    expect(result).toEqual({ evaluated: 0, dispatched: 0, skipped: 0 });
  });

  it('skips converted connections', async () => {
    // First call: getAllActiveConnections, second call: resolveWorkspaceIds
    mockDbWhere
      .mockResolvedValueOnce([
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          platform: 'airtable',
          syncStatus: 'converted',
          syncConfig: { tables: [{ enabled: true, es_table_id: 'tbl-1', external_table_id: 'ext-1' }] },
        },
      ])
      .mockResolvedValueOnce([]); // resolveWorkspaceIds

    const result = await runSchedulerTick(redis, queue, logger as never);
    expect(result.skipped).toBe(1);
    expect(result.dispatched).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('dispatches sync when enough time has elapsed for active table', async () => {
    mockDbWhere
      .mockResolvedValueOnce([
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          platform: 'notion',
          syncStatus: 'active',
          syncConfig: {
            polling_interval_seconds: 300,
            tables: [{ enabled: true, es_table_id: 'tbl-1', external_table_id: 'ext-1' }],
          },
        },
      ])
      .mockResolvedValueOnce([{ id: 'tbl-1', workspaceId: 'ws-1' }]); // resolveWorkspaceIds

    // Table room has 1 member → active visibility → 30s interval
    (redis.scard as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
    // Last poll was 60s ago (well past 30s threshold)
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(String(Date.now() - 60_000));

    const result = await runSchedulerTick(redis, queue, logger as never);
    expect(result.dispatched).toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      'incremental-sync',
      expect.objectContaining({
        tenantId: 'tenant-1',
        connectionId: 'conn-1',
        jobType: 'incremental',
      }),
      expect.any(Object),
    );
  });

  it('does not dispatch when not enough time has elapsed', async () => {
    mockDbWhere
      .mockResolvedValueOnce([
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          platform: 'notion',
          syncStatus: 'active',
          syncConfig: {
            polling_interval_seconds: 300,
            tables: [{ enabled: true, es_table_id: 'tbl-1', external_table_id: 'ext-1' }],
          },
        },
      ])
      .mockResolvedValueOnce([{ id: 'tbl-1', workspaceId: 'ws-1' }]);

    // No room members → inactive → 30 min interval
    (redis.scard as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    // Last poll was 5 minutes ago (less than 30 min threshold)
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(String(Date.now() - 300_000));

    const result = await runSchedulerTick(redis, queue, logger as never);
    expect(result.dispatched).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('skips event-driven tables with active webhooks', async () => {
    mockDbWhere
      .mockResolvedValueOnce([
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          platform: 'airtable',
          syncStatus: 'active',
          syncConfig: {
            polling_interval_seconds: 300,
            tables: [{ enabled: true, es_table_id: 'tbl-1', external_table_id: 'ext-1' }],
            webhooks: {
              airtable_webhook_id: 'wh-123',
              webhook_registered_at: '2026-01-01T00:00:00Z',
            },
          },
        },
      ])
      .mockResolvedValueOnce([{ id: 'tbl-1', workspaceId: 'ws-1' }]);

    const result = await runSchedulerTick(redis, queue, logger as never);
    expect(result.skipped).toBe(1);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('skips tables with no workspace mapping', async () => {
    mockDbWhere
      .mockResolvedValueOnce([
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          platform: 'notion',
          syncStatus: 'active',
          syncConfig: {
            polling_interval_seconds: 300,
            tables: [{ enabled: true, es_table_id: 'tbl-orphan', external_table_id: 'ext-1' }],
          },
        },
      ])
      .mockResolvedValueOnce([]); // No workspace found

    const result = await runSchedulerTick(redis, queue, logger as never);
    expect(result.dispatched).toBe(0);
  });

  it('skips disabled tables', async () => {
    mockDbWhere
      .mockResolvedValueOnce([
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          platform: 'notion',
          syncStatus: 'active',
          syncConfig: {
            polling_interval_seconds: 300,
            tables: [{ enabled: false, es_table_id: 'tbl-1', external_table_id: 'ext-1' }],
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await runSchedulerTick(redis, queue, logger as never);
    expect(result.dispatched).toBe(0);
    expect(result.evaluated).toBe(0);
  });
});
