// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { PermissionUpdatedPayload } from '@everystack/shared/realtime';
import type { FieldPermissionState } from '@everystack/shared/auth';
import {
  PermissionProvider,
  usePermission,
  usePermissionContext,
} from '../PermissionProvider';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const defaultEntries: Array<[string, FieldPermissionState]> = [
  ['field-1', 'read_write'],
  ['field-2', 'read_only'],
  ['field-3', 'hidden'],
];

let fetchCallCount = 0;
let fetchEntries = defaultEntries;

vi.stubGlobal('fetch', vi.fn(() => {
  fetchCallCount++;
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: fetchEntries }),
  });
}));

// ---------------------------------------------------------------------------
// Mock Socket
// ---------------------------------------------------------------------------

function createMockSocket() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler);
    }),
    _simulateEvent: (event: string, payload: unknown) => {
      listeners.get(event)?.forEach((handler) => handler(payload));
    },
  };
}

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

function createWrapper(props: {
  viewId: string;
  userId: string;
  socket: ReturnType<typeof createMockSocket> | null;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        PermissionProvider,
        {
          viewId: props.viewId,
          userId: props.userId,
          socket: props.socket as never,
        },
        children,
      ),
    );
  }

  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PermissionProvider + usePermission', () => {
  beforeEach(() => {
    fetchCallCount = 0;
    fetchEntries = defaultEntries;
    vi.mocked(fetch).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('usePermission returns correct state for a given field', async () => {
    const { Wrapper } = createWrapper({
      viewId: 'view-1',
      userId: 'user-1',
      socket: null,
    });

    const { result } = renderHook(() => usePermission('field-1'), {
      wrapper: Wrapper,
    });

    // While loading, returns 'hidden' (safe default)
    expect(result.current).toBe('hidden');

    await waitFor(() => {
      expect(result.current).toBe('read_write');
    });
  });

  it('usePermission returns hidden while loading (safe default)', () => {
    const { Wrapper } = createWrapper({
      viewId: 'view-1',
      userId: 'user-1',
      socket: null,
    });

    const { result } = renderHook(() => usePermission('field-2'), {
      wrapper: Wrapper,
    });

    expect(result.current).toBe('hidden');
  });

  it('usePermission returns hidden for unknown field IDs', async () => {
    const { Wrapper } = createWrapper({
      viewId: 'view-1',
      userId: 'user-1',
      socket: null,
    });

    const { result } = renderHook(() => usePermission('field-unknown'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      // Even after loading, unknown fields default to hidden
      expect(result.current).toBe('hidden');
    });
  });

  it('usePermissionContext provides getPermission helper', async () => {
    const { Wrapper } = createWrapper({
      viewId: 'view-1',
      userId: 'user-1',
      socket: null,
    });

    const { result } = renderHook(() => usePermissionContext(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getPermission('field-1')).toBe('read_write');
    expect(result.current.getPermission('field-2')).toBe('read_only');
    expect(result.current.getPermission('field-3')).toBe('hidden');
  });

  it('throws when usePermission is used outside PermissionProvider', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }

    expect(() =>
      renderHook(() => usePermission('field-1'), { wrapper: Wrapper }),
    ).toThrow('usePermissionContext must be used within a PermissionProvider');
  });

  it('subscribes to permission.updated events via socket', async () => {
    const socket = createMockSocket();
    const { Wrapper } = createWrapper({
      viewId: 'view-1',
      userId: 'user-1',
      socket,
    });

    renderHook(() => usePermission('field-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(socket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.PERMISSION_UPDATED,
        expect.any(Function),
      );
    });
  });

  it('real-time event triggers re-fetch', async () => {
    const socket = createMockSocket();
    const { Wrapper } = createWrapper({
      viewId: 'view-1',
      userId: 'user-1',
      socket,
    });

    const { result } = renderHook(() => usePermission('field-1'), {
      wrapper: Wrapper,
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current).toBe('read_write');
    });

    const initialCallCount = fetchCallCount;

    // Update response for re-fetch
    fetchEntries = [
      ['field-1', 'read_only'],
      ['field-2', 'read_only'],
      ['field-3', 'hidden'],
    ];

    // Simulate permission.updated event (all users affected)
    const payload: PermissionUpdatedPayload = {
      type: REALTIME_EVENTS.PERMISSION_UPDATED,
      tenantId: 'tenant-1',
      viewId: 'view-1',
      tableId: 'table-1',
    };

    act(() => {
      socket._simulateEvent(REALTIME_EVENTS.PERMISSION_UPDATED, payload);
    });

    // Should have triggered a re-fetch
    await waitFor(() => {
      expect(fetchCallCount).toBeGreaterThan(initialCallCount);
    });

    await waitFor(() => {
      expect(result.current).toBe('read_only');
    });
  });

  it('cleans up socket listener on unmount', async () => {
    const socket = createMockSocket();
    const { Wrapper } = createWrapper({
      viewId: 'view-1',
      userId: 'user-1',
      socket,
    });

    const { unmount } = renderHook(() => usePermission('field-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(socket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.PERMISSION_UPDATED,
        expect.any(Function),
      );
    });

    unmount();

    expect(socket.off).toHaveBeenCalledWith(
      REALTIME_EVENTS.PERMISSION_UPDATED,
      expect.any(Function),
    );
  });
});
