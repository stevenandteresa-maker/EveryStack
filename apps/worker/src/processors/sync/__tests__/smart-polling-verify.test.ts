/**
 * Smart Polling Verification
 *
 * Integration checkpoint test: mock different visibility states (active,
 * background, inactive) and confirm correct polling intervals are selected.
 *
 * Verifies the full chain: Socket.io room membership → visibility resolution →
 * polling interval selection → event-driven skip logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  workerLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  generateTraceId: vi.fn(() => 'test-trace-id'),
}));

vi.mock('@everystack/shared/db', () => ({
  dbRead: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
  baseConnections: { id: 'id', tenantId: 'tenant_id', platform: 'platform', syncStatus: 'sync_status', syncConfig: 'sync_config' },
  tables: { id: 'id', workspaceId: 'workspace_id' },
  sql: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock('@everystack/shared/redis', () => ({
  getRedisConfig: vi.fn(() => ({ host: 'localhost', port: 6379 })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  resolveTableVisibility,
  getPollingInterval,
  getSyncDispatchMode,
  getSocketIoRoomSize,
  SCHEDULER_INTERVAL_MS,
} from '../sync-scheduler';
import { POLLING_INTERVALS } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRedis(scardMap: Record<string, number> = {}): Redis {
  return {
    scard: vi.fn((key: string) => Promise.resolve(scardMap[key] ?? 0)),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    eval: vi.fn().mockResolvedValue([0, 5]),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(0),
    zadd: vi.fn().mockResolvedValue(1),
  } as unknown as Redis;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Smart Polling Verification', () => {
  describe('Visibility Resolution', () => {
    it('returns "active" when table room has viewers', async () => {
      const redis = createMockRedis({
        'socket.io#/#t:tenant-1:table:table-1#': 3,
      });

      const visibility = await resolveTableVisibility(redis, 'tenant-1', 'table-1', 'ws-1');
      expect(visibility).toBe('active');
    });

    it('returns "background" when workspace room has members but table room is empty', async () => {
      const redis = createMockRedis({
        'socket.io#/#t:tenant-1:table:table-1#': 0,
        'socket.io#/#t:tenant-1:workspace:ws-1#': 2,
      });

      const visibility = await resolveTableVisibility(redis, 'tenant-1', 'table-1', 'ws-1');
      expect(visibility).toBe('background');
    });

    it('returns "inactive" when no Socket.io rooms have members', async () => {
      const redis = createMockRedis({});

      const visibility = await resolveTableVisibility(redis, 'tenant-1', 'table-1', 'ws-1');
      expect(visibility).toBe('inactive');
    });

    it('prioritizes table room over workspace room', async () => {
      const redis = createMockRedis({
        'socket.io#/#t:tenant-1:table:table-1#': 1,
        'socket.io#/#t:tenant-1:workspace:ws-1#': 5,
      });

      const visibility = await resolveTableVisibility(redis, 'tenant-1', 'table-1', 'ws-1');
      expect(visibility).toBe('active');
    });
  });

  describe('Polling Interval Selection', () => {
    it('active → 30s (ACTIVE_VIEWING)', () => {
      const interval = getPollingInterval('notion', 'active', false);
      expect(interval).toBe(POLLING_INTERVALS.ACTIVE_VIEWING);
      expect(interval).toBe(30_000);
    });

    it('background → 5min (TAB_OPEN_NOT_VISIBLE)', () => {
      const interval = getPollingInterval('notion', 'background', false);
      expect(interval).toBe(POLLING_INTERVALS.TAB_OPEN_NOT_VISIBLE);
      expect(interval).toBe(300_000);
    });

    it('inactive → 30min (WORKSPACE_INACTIVE)', () => {
      const interval = getPollingInterval('notion', 'inactive', false);
      expect(interval).toBe(POLLING_INTERVALS.WORKSPACE_INACTIVE);
      expect(interval).toBe(1_800_000);
    });

    it('airtable with active webhook → null (EVENT_DRIVEN)', () => {
      const interval = getPollingInterval('airtable', 'active', true);
      expect(interval).toBeNull();
    });

    it('notion with webhook flag → still polls (webhooks not supported for Notion)', () => {
      const interval = getPollingInterval('notion', 'active', true);
      expect(interval).toBe(30_000);
    });

    it('smartsuite with webhook flag → still polls (webhooks not supported for SmartSuite)', () => {
      const interval = getPollingInterval('smartsuite', 'background', true);
      expect(interval).toBe(300_000);
    });
  });

  describe('Converted Table Skip Logic', () => {
    it('skip: converted', () => {
      expect(getSyncDispatchMode('converted')).toBe('skip');
    });

    it('skip: converted_finalized', () => {
      expect(getSyncDispatchMode('converted_finalized')).toBe('skip');
    });

    it('shadow_only: converted_dual_write', () => {
      expect(getSyncDispatchMode('converted_dual_write')).toBe('shadow_only');
    });

    it('skip: paused', () => {
      expect(getSyncDispatchMode('paused')).toBe('skip');
    });

    it('skip: error', () => {
      expect(getSyncDispatchMode('error')).toBe('skip');
    });

    it('skip: auth_required', () => {
      expect(getSyncDispatchMode('auth_required')).toBe('skip');
    });

    it('normal: active', () => {
      expect(getSyncDispatchMode('active')).toBe('normal');
    });

    it('normal: syncing', () => {
      expect(getSyncDispatchMode('syncing')).toBe('normal');
    });
  });

  describe('Scheduler Interval', () => {
    it('scheduler tick runs every 30 seconds', () => {
      expect(SCHEDULER_INTERVAL_MS).toBe(30_000);
    });
  });

  describe('End-to-End Visibility → Interval Flow', () => {
    it('simulates 3 tables with different visibility states', async () => {
      const redis = createMockRedis({
        'socket.io#/#t:t1:table:tbl-active#': 2,
        'socket.io#/#t:t1:workspace:ws-1#': 1,
        // tbl-inactive has no room members at all
      });

      // Table 1: actively viewed
      const vis1 = await resolveTableVisibility(redis, 't1', 'tbl-active', 'ws-1');
      expect(vis1).toBe('active');
      expect(getPollingInterval('notion', vis1, false)).toBe(30_000);

      // Table 2: workspace open but table not viewed
      const vis2 = await resolveTableVisibility(redis, 't1', 'tbl-bg', 'ws-1');
      expect(vis2).toBe('background');
      expect(getPollingInterval('notion', vis2, false)).toBe(300_000);

      // Table 3: nobody connected
      const vis3 = await resolveTableVisibility(redis, 't1', 'tbl-inactive', 'ws-other');
      expect(vis3).toBe('inactive');
      expect(getPollingInterval('notion', vis3, false)).toBe(1_800_000);
    });
  });
});
