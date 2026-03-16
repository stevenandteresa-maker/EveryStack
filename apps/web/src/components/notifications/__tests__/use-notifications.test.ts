// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { Notification } from '@everystack/shared/db';
import { useNotifications } from '../use-notifications';

// ---------------------------------------------------------------------------
// Mock server actions
// ---------------------------------------------------------------------------

vi.mock('@/actions/notifications', () => ({
  markNotificationReadAction: vi.fn().mockResolvedValue(undefined),
  markAllReadAction: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeNotification(
  overrides: Partial<Notification> & { id: string },
): Notification {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    type: 'mention',
    title: 'Test notification',
    body: null,
    sourceType: 'thread_message',
    sourceThreadId: null,
    sourceMessageId: null,
    sourceRecordId: null,
    actorId: null,
    groupKey: null,
    read: false,
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock socket
// ---------------------------------------------------------------------------

function createMockSocket() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(handler);
    }),
    emit: vi.fn(),
    _simulateEvent(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((h) => h(...args));
    },
  };
}

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNotifications', () => {
  const existingNotifs = [
    makeNotification({ id: 'n1', title: 'First' }),
    makeNotification({ id: 'n2', title: 'Second' }),
  ];

  let fetchNotifications: (
    opts?: { cursor?: string; limit?: number },
  ) => Promise<{ items: Notification[]; nextCursor: string | null }>;
  let fetchUnreadCount: () => Promise<number>;

  beforeEach(() => {
    fetchNotifications = vi.fn<
      (opts?: { cursor?: string; limit?: number }) => Promise<{ items: Notification[]; nextCursor: string | null }>
    >().mockResolvedValue({
      items: existingNotifs,
      nextCursor: null,
    });
    fetchUnreadCount = vi.fn<() => Promise<number>>().mockResolvedValue(2);
  });

  it('loads notifications and unread count on mount', async () => {
    const { result } = renderHook(
      () =>
        useNotifications({
          tenantId: 'tenant-1',
          userId: 'user-1',
          socket: null,
          fetchNotifications,
          fetchUnreadCount,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
  });

  it('prepends new notification from socket event', async () => {
    const socket = createMockSocket();

    const { result } = renderHook(
      () =>
        useNotifications({
          tenantId: 'tenant-1',
          userId: 'user-1',
          socket: socket as never,
          fetchNotifications,
          fetchUnreadCount,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
    });

    // Simulate new notification via socket
    const newNotif = makeNotification({ id: 'n3', title: 'New one' });

    act(() => {
      socket._simulateEvent(REALTIME_EVENTS.NOTIFICATION_NEW, newNotif);
    });

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(3);
    });

    expect(result.current.notifications[0]!.id).toBe('n3');
    expect(result.current.unreadCount).toBe(3);
  });

  it('joins and leaves notification room on socket', async () => {
    const socket = createMockSocket();

    const { unmount } = renderHook(
      () =>
        useNotifications({
          tenantId: 'tenant-1',
          userId: 'user-1',
          socket: socket as never,
          fetchNotifications,
          fetchUnreadCount,
        }),
      { wrapper: createWrapper() },
    );

    expect(socket.emit).toHaveBeenCalledWith('join', 'user:user-1:notifications');
    expect(socket.on).toHaveBeenCalledWith(
      REALTIME_EVENTS.NOTIFICATION_NEW,
      expect.any(Function),
    );

    unmount();

    expect(socket.off).toHaveBeenCalledWith(
      REALTIME_EVENTS.NOTIFICATION_NEW,
      expect.any(Function),
    );
    expect(socket.emit).toHaveBeenCalledWith('leave', 'user:user-1:notifications');
  });

  it('optimistically marks single notification as read', async () => {
    const { result } = renderHook(
      () =>
        useNotifications({
          tenantId: 'tenant-1',
          userId: 'user-1',
          socket: null,
          fetchNotifications,
          fetchUnreadCount,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
    });

    await act(async () => {
      await result.current.markRead('n1');
    });

    // Optimistic: count decremented
    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });
    // Optimistic: notification marked read
    const updated = result.current.notifications.find((n) => n.id === 'n1');
    expect(updated?.read).toBe(true);
  });

  it('optimistically marks all notifications as read', async () => {
    const { result } = renderHook(
      () =>
        useNotifications({
          tenantId: 'tenant-1',
          userId: 'user-1',
          socket: null,
          fetchNotifications,
          fetchUnreadCount,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
    });

    await act(async () => {
      await result.current.markAllRead();
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });
});
