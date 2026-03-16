'use client';

/**
 * useNotifications — manages notification loading, real-time updates,
 * and read state for the notification bell/tray.
 *
 * Uses TanStack Query for server state + Socket.IO for real-time prepend.
 *
 * @see docs/reference/communications.md § Notification Aggregation & Delivery
 */

import { useCallback, useEffect } from 'react';
import { useQueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { Notification } from '@everystack/shared/db';
import {
  markNotificationReadAction,
  markAllReadAction,
} from '@/actions/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseNotificationsOptions {
  tenantId: string;
  userId: string;
  socket: Socket | null;
  /** Server action to fetch notifications (injectable for testing) */
  fetchNotifications?: (
    opts?: { cursor?: string; limit?: number },
  ) => Promise<{ items: Notification[]; nextCursor: string | null }>;
  /** Server action to fetch unread count (injectable for testing) */
  fetchUnreadCount?: () => Promise<number>;
}

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  loadMore: () => void;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Default fetchers (server actions)
// ---------------------------------------------------------------------------

async function defaultFetchNotifications(
  opts?: { cursor?: string; limit?: number },
): Promise<{ items: Notification[]; nextCursor: string | null }> {
  const { getNotificationsAction } = await import('@/actions/notification-queries');
  return getNotificationsAction(opts);
}

async function defaultFetchUnreadCount(): Promise<number> {
  const { getUnreadCountAction } = await import('@/actions/notification-queries');
  return getUnreadCountAction();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications({
  tenantId,
  userId,
  socket,
  fetchNotifications = defaultFetchNotifications,
  fetchUnreadCount = defaultFetchUnreadCount,
}: UseNotificationsOptions): UseNotificationsResult {
  const queryClient = useQueryClient();

  const notificationsQueryKey = ['notifications', tenantId, userId];
  const unreadQueryKey = ['notifications-unread', tenantId, userId];

  // Paginated notification loading
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: notificationsQueryKey,
    queryFn: async ({ pageParam }) => {
      return fetchNotifications({
        cursor: pageParam as string | undefined,
        limit: 20,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const notifications = data?.pages.flatMap((p) => p.items) ?? [];

  // Unread count (Redis-cached on server, 30s stale time on client)
  const { data: unreadCount = 0 } = useQuery({
    queryKey: unreadQueryKey,
    queryFn: fetchUnreadCount,
    staleTime: 30_000,
  });

  // Socket.IO subscription for real-time notifications
  useEffect(() => {
    if (!socket || !userId) return;

    const room = `user:${userId}:notifications`;
    socket.emit('join', room);

    function handleNewNotification(notification: Notification) {
      // Prepend to first page
      queryClient.setQueryData(notificationsQueryKey, (old: typeof data) => {
        if (!old) return old;
        const firstPage = old.pages[0];
        if (!firstPage) return old;
        return {
          ...old,
          pages: [
            { ...firstPage, items: [notification, ...firstPage.items] },
            ...old.pages.slice(1),
          ],
        };
      });

      // Increment unread count
      queryClient.setQueryData(unreadQueryKey, (old: number | undefined) => {
        return (old ?? 0) + 1;
      });
    }

    socket.on(REALTIME_EVENTS.NOTIFICATION_NEW, handleNewNotification);

    return () => {
      socket.off(REALTIME_EVENTS.NOTIFICATION_NEW, handleNewNotification);
      socket.emit('leave', room);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, userId, tenantId, queryClient]);

  // Mark single notification as read
  const markRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      queryClient.setQueryData(notificationsQueryKey, (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) =>
              n.id === notificationId
                ? { ...n, read: true, readAt: new Date().toISOString() as unknown as Date }
                : n,
            ),
          })),
        };
      });
      queryClient.setQueryData(unreadQueryKey, (old: number | undefined) => {
        return Math.max((old ?? 0) - 1, 0);
      });

      await markNotificationReadAction(notificationId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, tenantId, userId],
  );

  // Mark all as read
  const markAllRead = useCallback(async () => {
    // Optimistic update
    queryClient.setQueryData(notificationsQueryKey, (old: typeof data) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((n) => ({
            ...n,
            read: true,
            readAt: new Date().toISOString() as unknown as Date,
          })),
        })),
      };
    });
    queryClient.setQueryData(unreadQueryKey, 0);

    await markAllReadAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, tenantId, userId]);

  return {
    notifications,
    unreadCount,
    isLoading: isLoading || isFetchingNextPage,
    markRead,
    markAllRead,
    loadMore: () => {
      if (hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    hasMore: !!hasNextPage,
  };
}
