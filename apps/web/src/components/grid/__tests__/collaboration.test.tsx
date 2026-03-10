/**
 * Multi-User Collaboration tests — field-level locking, row presence,
 * and real-time update coalescing.
 *
 * @vitest-environment jsdom
 * @see docs/reference/tables-and-views.md § Multi-User Collaboration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import { useFieldLock, type FieldLockInfo } from '@/lib/hooks/use-field-lock';
import { useRecordPresence, getPresenceColor, PRESENCE_COLORS } from '@/lib/hooks/use-record-presence';
import { useRealtimeUpdates } from '@/lib/hooks/use-realtime-updates';
import { FieldLockIndicator } from '../FieldLockIndicator';
import { RowPresenceIndicator } from '../RowPresenceIndicator';
import { GridCell } from '../GridCell';

// ---------------------------------------------------------------------------
// Mock socket
// ---------------------------------------------------------------------------

function createMockSocket() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  const mockSocket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler);
    }),
    emit: vi.fn(),
    connected: true,
    // Helper to simulate incoming events
    __emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((handler) => handler(...args));
    },
    __listeners: listeners,
  };

  return mockSocket;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001';
const USER_ID = 'user-001';
const USER_NAME = 'Alice';
const AVATAR_URL = 'https://example.com/alice.jpg';
const OTHER_USER_ID = 'user-002';
const OTHER_USER_NAME = 'Bob';
const OTHER_AVATAR = 'https://example.com/bob.jpg';

const otherLockInfo: FieldLockInfo = {
  userId: OTHER_USER_ID,
  userName: OTHER_USER_NAME,
  avatarUrl: OTHER_AVATAR,
  timestamp: Date.now(),
};

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <IntlWrapper>{children}</IntlWrapper>
      </QueryClientProvider>
    );
  }

  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// useFieldLock tests
// ---------------------------------------------------------------------------

describe('useFieldLock', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register event listeners on mount', () => {
    const { Wrapper } = createQueryWrapper();

    renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    expect(mockSocket.on).toHaveBeenCalledWith(
      REALTIME_EVENTS.FIELD_LOCKED,
      expect.any(Function),
    );
    expect(mockSocket.on).toHaveBeenCalledWith(
      REALTIME_EVENTS.FIELD_UNLOCKED,
      expect.any(Function),
    );
    expect(mockSocket.on).toHaveBeenCalledWith(
      REALTIME_EVENTS.FIELD_LOCK_RENEWED,
      expect.any(Function),
    );
  });

  it('should track locks from other users', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    // Simulate another user locking a field
    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.FIELD_LOCKED, {
        recordId: 'rec-1',
        fieldId: 'fld-1',
        lockedBy: otherLockInfo,
      });
    });

    const lock = result.current.getFieldLock('rec-1', 'fld-1');
    expect(lock).not.toBeNull();
    expect(lock!.userId).toBe(OTHER_USER_ID);
    expect(lock!.userName).toBe(OTHER_USER_NAME);
  });

  it('should not show locks from current user', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.FIELD_LOCKED, {
        recordId: 'rec-1',
        fieldId: 'fld-1',
        lockedBy: { ...otherLockInfo, userId: USER_ID },
      });
    });

    expect(result.current.getFieldLock('rec-1', 'fld-1')).toBeNull();
  });

  it('should clear locks on unlock event', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.FIELD_LOCKED, {
        recordId: 'rec-1',
        fieldId: 'fld-1',
        lockedBy: otherLockInfo,
      });
    });

    expect(result.current.getFieldLock('rec-1', 'fld-1')).not.toBeNull();

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.FIELD_UNLOCKED, {
        recordId: 'rec-1',
        fieldId: 'fld-1',
        userId: OTHER_USER_ID,
      });
    });

    expect(result.current.getFieldLock('rec-1', 'fld-1')).toBeNull();
  });

  it('should update timestamp on lock renewal', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    const earlyTimestamp = Date.now() - 30_000;

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.FIELD_LOCKED, {
        recordId: 'rec-1',
        fieldId: 'fld-1',
        lockedBy: { ...otherLockInfo, timestamp: earlyTimestamp },
      });
    });

    const lockBefore = result.current.getFieldLock('rec-1', 'fld-1');
    expect(lockBefore!.timestamp).toBe(earlyTimestamp);

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.FIELD_LOCK_RENEWED, {
        recordId: 'rec-1',
        fieldId: 'fld-1',
        userId: OTHER_USER_ID,
      });
    });

    const lockAfter = result.current.getFieldLock('rec-1', 'fld-1');
    expect(lockAfter!.timestamp).toBeGreaterThan(earlyTimestamp);
  });

  it('should emit field:lock on acquireFieldLock', async () => {
    const { Wrapper } = createQueryWrapper();

    mockSocket.emit.mockImplementation((...args: unknown[]) => {
      const callback = args[2] as ((response: { ok: boolean }) => void) | undefined;
      if (typeof callback === 'function') {
        callback({ ok: true });
      }
    });

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    let acquired = false;
    await act(async () => {
      acquired = await result.current.acquireFieldLock('rec-1', 'fld-1');
    });

    expect(acquired).toBe(true);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'field:lock',
      expect.objectContaining({
        tenantId: TENANT_ID,
        recordId: 'rec-1',
        fieldId: 'fld-1',
        userName: USER_NAME,
      }),
      expect.any(Function),
    );
  });

  it('should return false when lock is held by another user', async () => {
    const { Wrapper } = createQueryWrapper();

    mockSocket.emit.mockImplementation((...args: unknown[]) => {
      const callback = args[2] as ((response: { ok: boolean; lockedBy?: FieldLockInfo }) => void) | undefined;
      if (typeof callback === 'function') {
        callback({ ok: false, lockedBy: otherLockInfo });
      }
    });

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    let acquired = false;
    await act(async () => {
      acquired = await result.current.acquireFieldLock('rec-1', 'fld-1');
    });

    expect(acquired).toBe(false);
  });

  it('should emit field:unlock on releaseFieldLock', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.releaseFieldLock('rec-1', 'fld-1');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'field:unlock',
      expect.objectContaining({
        tenantId: TENANT_ID,
        recordId: 'rec-1',
        fieldId: 'fld-1',
      }),
    );
  });

  it('should emit field:lock_renewed on renewFieldLock', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.renewFieldLock('rec-1', 'fld-1');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'field:lock_renewed',
      expect.objectContaining({
        tenantId: TENANT_ID,
        recordId: 'rec-1',
        fieldId: 'fld-1',
      }),
    );
  });

  it('should return record-level locks for getRecordLocks', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.FIELD_LOCKED, {
        recordId: 'rec-1',
        fieldId: 'fld-1',
        lockedBy: otherLockInfo,
      });
      mockSocket.__emit(REALTIME_EVENTS.FIELD_LOCKED, {
        recordId: 'rec-1',
        fieldId: 'fld-2',
        lockedBy: otherLockInfo, // same user, two fields
      });
    });

    const locks = result.current.getRecordLocks('rec-1');
    // Same user editing 2 fields = 1 unique user
    expect(locks).toHaveLength(1);
    expect(locks[0]!.userId).toBe(OTHER_USER_ID);
  });

  it('should auto-expire stale locks', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: mockSocket as unknown as Parameters<typeof useFieldLock>[0]['socket'],
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.FIELD_LOCKED, {
        recordId: 'rec-1',
        fieldId: 'fld-1',
        lockedBy: { ...otherLockInfo, timestamp: Date.now() - 70_000 }, // already stale
      });
    });

    expect(result.current.getFieldLock('rec-1', 'fld-1')).not.toBeNull();

    // Advance past the stale check interval
    act(() => {
      vi.advanceTimersByTime(11_000);
    });

    expect(result.current.getFieldLock('rec-1', 'fld-1')).toBeNull();
  });

  it('should handle null socket gracefully', async () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useFieldLock({
          socket: null,
          tenantId: TENANT_ID,
          currentUserId: USER_ID,
          currentUserName: USER_NAME,
          currentAvatarUrl: AVATAR_URL,
        }),
      { wrapper: Wrapper },
    );

    let acquired = false;
    await act(async () => {
      acquired = await result.current.acquireFieldLock('rec-1', 'fld-1');
    });
    expect(acquired).toBe(false);

    // These should not throw
    act(() => {
      result.current.releaseFieldLock('rec-1', 'fld-1');
      result.current.renewFieldLock('rec-1', 'fld-1');
    });

    expect(result.current.getFieldLock('rec-1', 'fld-1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useRecordPresence tests
// ---------------------------------------------------------------------------

describe('useRecordPresence', () => {
  it('should return inactive when no locks on record', () => {
    const { Wrapper } = createQueryWrapper();

    const getRecordLocks = vi.fn().mockReturnValue([]);

    const { result } = renderHook(
      () => useRecordPresence({ getRecordLocks }),
      { wrapper: Wrapper },
    );

    const presence = result.current.getRecordPresence('rec-1');
    expect(presence.isActive).toBe(false);
    expect(presence.color).toBe('');
    expect(presence.users).toHaveLength(0);
  });

  it('should return active with color when locks exist', () => {
    const { Wrapper } = createQueryWrapper();

    const getRecordLocks = vi.fn().mockReturnValue([otherLockInfo]);

    const { result } = renderHook(
      () => useRecordPresence({ getRecordLocks }),
      { wrapper: Wrapper },
    );

    const presence = result.current.getRecordPresence('rec-1');
    expect(presence.isActive).toBe(true);
    expect(presence.color).toBeTruthy();
    expect(presence.users).toHaveLength(1);
  });

  it('should assign consistent colors to users', () => {
    const color1 = getPresenceColor('user-abc');
    const color2 = getPresenceColor('user-abc');
    const color3 = getPresenceColor('user-xyz');

    expect(color1).toBe(color2);
    expect(PRESENCE_COLORS).toContain(color1);
    expect(PRESENCE_COLORS).toContain(color3);
  });
});

// ---------------------------------------------------------------------------
// useRealtimeUpdates tests
// ---------------------------------------------------------------------------

describe('useRealtimeUpdates', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not buffer updates from current user', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useRealtimeUpdates({
          socket: mockSocket as unknown as Parameters<typeof useRealtimeUpdates>[0]['socket'],
          currentUserId: USER_ID,
          tableId: 'table-1',
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.RECORD_UPDATED, {
        recordId: 'rec-1',
        tableId: 'table-1',
        tenantId: TENANT_ID,
        canonicalData: { 'fld-1': 'updated' },
        updatedBy: USER_ID, // same user
        updatedAt: new Date().toISOString(),
      });
    });

    expect(result.current.isBuffering).toBe(false);
  });

  it('should buffer updates from other users', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useRealtimeUpdates({
          socket: mockSocket as unknown as Parameters<typeof useRealtimeUpdates>[0]['socket'],
          currentUserId: USER_ID,
          tableId: 'table-1',
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.RECORD_UPDATED, {
        recordId: 'rec-1',
        tableId: 'table-1',
        tenantId: TENANT_ID,
        canonicalData: { 'fld-1': 'updated' },
        updatedBy: OTHER_USER_ID,
        updatedAt: new Date().toISOString(),
      });
    });

    expect(result.current.isBuffering).toBe(true);
  });

  it('should flush after 100ms idle', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useRealtimeUpdates({
          socket: mockSocket as unknown as Parameters<typeof useRealtimeUpdates>[0]['socket'],
          currentUserId: USER_ID,
          tableId: 'table-1',
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.RECORD_UPDATED, {
        recordId: 'rec-1',
        tableId: 'table-1',
        tenantId: TENANT_ID,
        canonicalData: { 'fld-1': 'updated' },
        updatedBy: OTHER_USER_ID,
        updatedAt: new Date().toISOString(),
      });
    });

    expect(result.current.isBuffering).toBe(true);

    act(() => {
      vi.advanceTimersByTime(101);
    });

    expect(result.current.isBuffering).toBe(false);
  });

  it('should flush after 500ms max even with continuous events', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useRealtimeUpdates({
          socket: mockSocket as unknown as Parameters<typeof useRealtimeUpdates>[0]['socket'],
          currentUserId: USER_ID,
          tableId: 'table-1',
        }),
      { wrapper: Wrapper },
    );

    // Send events every 80ms (resetting the idle timer each time)
    for (let i = 0; i < 7; i++) {
      act(() => {
        mockSocket.__emit(REALTIME_EVENTS.RECORD_UPDATED, {
          recordId: `rec-${i}`,
          tableId: 'table-1',
          tenantId: TENANT_ID,
          canonicalData: { 'fld-1': `value-${i}` },
          updatedBy: OTHER_USER_ID,
          updatedAt: new Date().toISOString(),
        });
        vi.advanceTimersByTime(80);
      });
    }

    // After 7 * 80ms = 560ms > 500ms max, should have flushed
    expect(result.current.isBuffering).toBe(false);
  });

  it('should ignore updates for different tables', () => {
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () =>
        useRealtimeUpdates({
          socket: mockSocket as unknown as Parameters<typeof useRealtimeUpdates>[0]['socket'],
          currentUserId: USER_ID,
          tableId: 'table-1',
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.RECORD_UPDATED, {
        recordId: 'rec-1',
        tableId: 'table-2', // different table
        tenantId: TENANT_ID,
        canonicalData: {},
        updatedBy: OTHER_USER_ID,
        updatedAt: new Date().toISOString(),
      });
    });

    expect(result.current.isBuffering).toBe(false);
  });

  it('should apply batch updates to query cache on flush', () => {
    const { Wrapper, queryClient } = createQueryWrapper();

    // Pre-populate the cache
    queryClient.setQueryData(['records', 'table-1'], [
      { id: 'rec-1', canonicalData: { 'fld-1': 'original' }, updatedAt: '2024-01-01' },
      { id: 'rec-2', canonicalData: { 'fld-1': 'untouched' }, updatedAt: '2024-01-01' },
    ]);

    renderHook(
      () =>
        useRealtimeUpdates({
          socket: mockSocket as unknown as Parameters<typeof useRealtimeUpdates>[0]['socket'],
          currentUserId: USER_ID,
          tableId: 'table-1',
        }),
      { wrapper: Wrapper },
    );

    const newUpdatedAt = new Date().toISOString();

    act(() => {
      mockSocket.__emit(REALTIME_EVENTS.RECORD_UPDATED, {
        recordId: 'rec-1',
        tableId: 'table-1',
        tenantId: TENANT_ID,
        canonicalData: { 'fld-1': 'updated-value' },
        updatedBy: OTHER_USER_ID,
        updatedAt: newUpdatedAt,
      });
    });

    // Flush
    act(() => {
      vi.advanceTimersByTime(101);
    });

    const cached = queryClient.getQueryData(['records', 'table-1']) as Array<{
      id: string;
      canonicalData: Record<string, unknown>;
      updatedAt: string;
    }>;

    expect(cached[0]!.canonicalData['fld-1']).toBe('updated-value');
    expect(cached[0]!.updatedAt).toBe(newUpdatedAt);
    // rec-2 should be untouched
    expect(cached[1]!.canonicalData['fld-1']).toBe('untouched');
  });
});

// ---------------------------------------------------------------------------
// FieldLockIndicator component tests
// ---------------------------------------------------------------------------

describe('FieldLockIndicator', () => {
  it('should render avatar when avatarUrl is provided', () => {
    const { container } = render(
      <IntlWrapper>
        <FieldLockIndicator lockInfo={otherLockInfo} />
      </IntlWrapper>,
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  it('should render initials when no avatarUrl', () => {
    render(
      <IntlWrapper>
        <FieldLockIndicator
          lockInfo={{ ...otherLockInfo, avatarUrl: '' }}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('should render tooltip trigger', () => {
    const { container } = render(
      <IntlWrapper>
        <FieldLockIndicator lockInfo={otherLockInfo} />
      </IntlWrapper>,
    );

    // The tooltip trigger wraps the avatar element
    const trigger = container.querySelector('[data-state]');
    expect(trigger).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RowPresenceIndicator component tests
// ---------------------------------------------------------------------------

describe('RowPresenceIndicator', () => {
  it('should render 3px wide colored left border', () => {
    const { container } = render(
      <RowPresenceIndicator color="#3B82F6" height={44} />,
    );

    const indicator = container.firstChild as HTMLDivElement;
    expect(indicator.style.width).toBe('3px');
    expect(indicator.style.height).toBe('44px');
    expect(indicator.style.backgroundColor).toBe('rgb(59, 130, 246)');
  });

  it('should be aria-hidden', () => {
    const { container } = render(
      <RowPresenceIndicator color="#3B82F6" height={44} />,
    );

    const indicator = container.firstChild as HTMLDivElement;
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// GridCell lock integration tests
// ---------------------------------------------------------------------------

describe('GridCell with lock', () => {
  const baseField = {
    id: 'fld-1',
    fieldType: 'text',
    name: 'Title',
    readOnly: false,
    isPrimary: false,
    sortOrder: 0,
    tableId: 'table-1',
    tenantId: TENANT_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    externalFieldId: null,
    config: null,
    archivedAt: null,
  } as unknown as Parameters<typeof GridCell>[0]['field'];

  const baseRecord = {
    id: 'rec-1',
    canonicalData: { 'fld-1': 'Hello' },
    tenantId: TENANT_ID,
    tableId: 'table-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    syncMetadata: null,
    searchVector: null,
    archivedAt: null,
    updatedBy: null,
  } as unknown as Parameters<typeof GridCell>[0]['record'];

  it('should show lock indicator when lockInfo is provided', () => {
    const { container } = render(
      <IntlWrapper>
        <GridCell
          record={baseRecord}
          field={baseField}
          isActive={false}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          lockInfo={otherLockInfo}
        />
      </IntlWrapper>,
    );

    // Check that the cell content is dimmed
    const cellContent = container.querySelector('.opacity-60');
    expect(cellContent).toBeInTheDocument();
  });

  it('should prevent click-to-edit when locked', () => {
    const onDoubleClick = vi.fn();

    render(
      <IntlWrapper>
        <GridCell
          record={baseRecord}
          field={baseField}
          isActive={true}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          onDoubleClick={onDoubleClick}
          lockInfo={otherLockInfo}
        />
      </IntlWrapper>,
    );

    const cell = screen.getByRole('gridcell');
    fireEvent.click(cell);
    fireEvent.click(cell);

    // Double click should NOT trigger edit mode when locked
    expect(onDoubleClick).not.toHaveBeenCalled();
  });

  it('should prevent keyboard replace when locked', () => {
    const onStartReplace = vi.fn();

    render(
      <IntlWrapper>
        <GridCell
          record={baseRecord}
          field={baseField}
          isActive={true}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          onStartReplace={onStartReplace}
          lockInfo={otherLockInfo}
        />
      </IntlWrapper>,
    );

    const cell = screen.getByRole('gridcell');
    fireEvent.keyDown(cell, { key: 'a' });

    expect(onStartReplace).not.toHaveBeenCalled();
  });

  it('should allow editing when no lock', () => {
    const onStartReplace = vi.fn();

    render(
      <IntlWrapper>
        <GridCell
          record={baseRecord}
          field={baseField}
          isActive={true}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          onStartReplace={onStartReplace}
          lockInfo={null}
        />
      </IntlWrapper>,
    );

    const cell = screen.getByRole('gridcell');
    fireEvent.keyDown(cell, { key: 'a' });

    expect(onStartReplace).toHaveBeenCalled();
  });
});
