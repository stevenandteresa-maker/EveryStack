// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import { useSyncConflictStore } from '../../sync-conflict-store';
import type { ConflictMap } from '../../sync-conflict-store';
import { useTableConflicts } from '../use-table-conflicts';

// ---------------------------------------------------------------------------
// Mock Socket
// ---------------------------------------------------------------------------

function createMockSocket() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  return {
    emit: vi.fn(
      (event: string, ...args: unknown[]) => {
        // Auto-acknowledge room:join with { ok: true }
        if (event === 'room:join') {
          const callback = args[args.length - 1];
          if (typeof callback === 'function') {
            callback({ ok: true });
          }
        }
      },
    ),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler);
    }),
    // Test helper: simulate server pushing an event
    _simulateEvent: (event: string, payload: unknown) => {
      listeners.get(event)?.forEach((handler) => handler(payload));
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTableConflicts', () => {
  const mockFetchInitialConflicts = vi.fn<(tableId: string) => Promise<ConflictMap>>();

  beforeEach(() => {
    useSyncConflictStore.setState({ conflicts: {} });
    mockFetchInitialConflicts.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('joins table room and fetches initial conflicts on mount', async () => {
    const socket = createMockSocket();
    const initialConflicts: ConflictMap = {
      'rec-1': {
        'field-1': {
          id: 'c1',
          localValue: 'local',
          remoteValue: 'remote',
          platform: 'airtable',
          createdAt: '2026-01-15T10:00:00.000Z',
        },
      },
    };
    mockFetchInitialConflicts.mockResolvedValue(initialConflicts);

    renderHook(() =>
      useTableConflicts({
        socket: socket as never,
        tableId: 'table-1',
        tenantId: 'tenant-1',
        fetchInitialConflicts: mockFetchInitialConflicts,
      }),
    );

    // Room join emitted
    expect(socket.emit).toHaveBeenCalledWith(
      'room:join',
      'table:table-1',
      expect.any(Function),
    );

    // Wait for async initial fetch
    await vi.waitFor(() => {
      expect(mockFetchInitialConflicts).toHaveBeenCalledWith('table-1');
    });

    await vi.waitFor(() => {
      expect(useSyncConflictStore.getState().conflicts).toEqual(initialConflicts);
    });
  });

  it('registers conflict event listeners', () => {
    const socket = createMockSocket();

    renderHook(() =>
      useTableConflicts({
        socket: socket as never,
        tableId: 'table-1',
        tenantId: 'tenant-1',
        fetchInitialConflicts: mockFetchInitialConflicts,
      }),
    );

    expect(socket.on).toHaveBeenCalledWith(
      REALTIME_EVENTS.SYNC_CONFLICT_DETECTED,
      expect.any(Function),
    );
    expect(socket.on).toHaveBeenCalledWith(
      REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED,
      expect.any(Function),
    );
  });

  it('adds conflict on sync.conflict_detected event', async () => {
    const socket = createMockSocket();

    renderHook(() =>
      useTableConflicts({
        socket: socket as never,
        tableId: 'table-1',
        tenantId: 'tenant-1',
        fetchInitialConflicts: mockFetchInitialConflicts,
      }),
    );

    act(() => {
      socket._simulateEvent(REALTIME_EVENTS.SYNC_CONFLICT_DETECTED, {
        type: REALTIME_EVENTS.SYNC_CONFLICT_DETECTED,
        recordId: 'rec-1',
        fieldId: 'field-1',
        conflictId: 'conflict-1',
        localValue: 'local',
        remoteValue: 'remote',
        platform: 'airtable',
      });
    });

    const conflicts = useSyncConflictStore.getState().conflicts;
    expect(conflicts['rec-1']).toBeDefined();
    expect(conflicts['rec-1']!['field-1']!.id).toBe('conflict-1');
  });

  it('removes conflict on sync.conflict_resolved event', async () => {
    const socket = createMockSocket();

    // Pre-populate a conflict
    useSyncConflictStore.getState().addConflict('rec-1', 'field-1', {
      id: 'conflict-1',
      localValue: 'local',
      remoteValue: 'remote',
      platform: 'airtable',
      createdAt: '2026-01-15T10:00:00.000Z',
    });

    renderHook(() =>
      useTableConflicts({
        socket: socket as never,
        tableId: 'table-1',
        tenantId: 'tenant-1',
        fetchInitialConflicts: mockFetchInitialConflicts,
      }),
    );

    act(() => {
      socket._simulateEvent(REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED, {
        type: REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED,
        recordId: 'rec-1',
        fieldId: 'field-1',
        conflictId: 'conflict-1',
        resolvedValue: 'local',
        resolution: 'resolved_local',
      });
    });

    expect(useSyncConflictStore.getState().conflicts).toEqual({});
  });

  it('cleans up on unmount — leaves room, removes listeners, clears store', async () => {
    const socket = createMockSocket();

    useSyncConflictStore.getState().addConflict('rec-1', 'field-1', {
      id: 'c1',
      localValue: 'local',
      remoteValue: 'remote',
      platform: 'airtable',
      createdAt: '2026-01-15T10:00:00.000Z',
    });

    const { unmount } = renderHook(() =>
      useTableConflicts({
        socket: socket as never,
        tableId: 'table-1',
        tenantId: 'tenant-1',
        fetchInitialConflicts: mockFetchInitialConflicts,
      }),
    );

    unmount();

    // Room left
    expect(socket.emit).toHaveBeenCalledWith('room:leave', 'table:table-1');
    // Listeners removed
    expect(socket.off).toHaveBeenCalledWith(
      REALTIME_EVENTS.SYNC_CONFLICT_DETECTED,
      expect.any(Function),
    );
    expect(socket.off).toHaveBeenCalledWith(
      REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED,
      expect.any(Function),
    );
    // Store cleared
    expect(useSyncConflictStore.getState().conflicts).toEqual({});
  });

  it('does nothing when socket is null', () => {
    renderHook(() =>
      useTableConflicts({
        socket: null,
        tableId: 'table-1',
        tenantId: 'tenant-1',
        fetchInitialConflicts: mockFetchInitialConflicts,
      }),
    );

    expect(mockFetchInitialConflicts).not.toHaveBeenCalled();
  });

  it('does nothing when tableId is null', () => {
    const socket = createMockSocket();

    renderHook(() =>
      useTableConflicts({
        socket: socket as never,
        tableId: null,
        tenantId: 'tenant-1',
        fetchInitialConflicts: mockFetchInitialConflicts,
      }),
    );

    expect(socket.emit).not.toHaveBeenCalled();
  });
});
