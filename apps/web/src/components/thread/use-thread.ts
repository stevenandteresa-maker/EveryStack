'use client';

/**
 * useThread — manages message loading, real-time subscriptions, and
 * unread state for a single thread.
 *
 * Uses TanStack Query for server state + Socket.IO for real-time updates.
 *
 * @see docs/reference/communications.md § Record Thread
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { ThreadMessage } from '@everystack/shared/db';
import {
  sendMessage as sendMessageAction,
  editMessageAction,
  deleteMessageAction,
} from '@/actions/threads';
import type { MessageListOpts } from '@/data/thread-messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LensFilter = 'notes' | 'activity' | 'files' | undefined;

interface UseThreadOptions {
  threadId: string | null;
  socket: Socket | null;
  currentUserId: string;
  lensFilter?: LensFilter;
  /** Server action to fetch messages (injectable for testing) */
  fetchMessages?: (
    threadId: string,
    opts?: MessageListOpts,
  ) => Promise<{ items: ThreadMessage[]; nextCursor: string | null }>;
  /** Server action to update last read (injectable for testing) */
  markRead?: (threadId: string) => Promise<void>;
}

interface UseThreadResult {
  messages: ThreadMessage[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  unreadCount: number;
  sendMessage: (content: unknown) => Promise<void>;
  editMessage: (messageId: string, content: unknown) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Default fetchers (server actions)
// ---------------------------------------------------------------------------

async function defaultFetchMessages(
  threadId: string,
  opts?: MessageListOpts,
): Promise<{ items: ThreadMessage[]; nextCursor: string | null }> {
  // Import dynamically to avoid circular deps in tests
  const { getMessagesAction } = await import('@/actions/thread-queries');
  return getMessagesAction({ threadId, ...opts });
}

async function defaultMarkRead(threadId: string): Promise<void> {
  const { markThreadReadAction } = await import('@/actions/thread-queries');
  await markThreadReadAction({ threadId });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useThread({
  threadId,
  socket,
  currentUserId,
  lensFilter,
  fetchMessages = defaultFetchMessages,
  markRead = defaultMarkRead,
}: UseThreadOptions): UseThreadResult {
  const queryClient = useQueryClient();
  const prevThreadIdRef = useRef<string | null>(null);

  const queryKey = ['thread-messages', threadId, lensFilter ?? 'all'];

  // Paginated message loading
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!threadId) return { items: [] as ThreadMessage[], nextCursor: null };
      return fetchMessages(threadId, {
        cursor: pageParam as string | undefined,
        lensFilter: lensFilter,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!threadId,
  });

  // Flatten all pages into a single array
  const messages = data?.pages.flatMap((p) => p.items) ?? [];

  // Unread count query
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['thread-unread', threadId],
    queryFn: async () => {
      if (!threadId) return 0;
      // Unread count is derived from the server — use the thread query
      const { getUnreadCountAction } = await import('@/actions/thread-queries');
      return getUnreadCountAction({ threadId });
    },
    enabled: !!threadId,
  });

  // Mark as read when thread changes
  useEffect(() => {
    if (threadId && threadId !== prevThreadIdRef.current) {
      prevThreadIdRef.current = threadId;
      void markRead(threadId);
      queryClient.setQueryData(['thread-unread', threadId], 0);
    }
  }, [threadId, markRead, queryClient]);

  // Socket.IO subscriptions for real-time updates
  useEffect(() => {
    if (!socket || !threadId) return;

    const room = `thread:${threadId}`;
    socket.emit('join', room);

    function handleNewMessage(message: ThreadMessage) {
      if (message.threadId !== threadId) return;
      // Skip own messages (already handled by optimistic update)
      if (message.authorId === currentUserId) return;

      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;
        const lastPage = old.pages[old.pages.length - 1];
        if (!lastPage) return old;
        return {
          ...old,
          pages: [
            ...old.pages.slice(0, -1),
            { ...lastPage, items: [...lastPage.items, message] },
          ],
        };
      });
    }

    function handleEditMessage(message: ThreadMessage) {
      if (message.threadId !== threadId) return;

      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((m) =>
              m.id === message.id ? message : m,
            ),
          })),
        };
      });
    }

    function handleDeleteMessage(payload: { messageId: string }) {
      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((m) => m.id !== payload.messageId),
          })),
        };
      });
    }

    socket.on(REALTIME_EVENTS.MESSAGE_NEW, handleNewMessage);
    socket.on(REALTIME_EVENTS.MESSAGE_EDIT, handleEditMessage);
    socket.on(REALTIME_EVENTS.MESSAGE_DELETE, handleDeleteMessage);

    return () => {
      socket.off(REALTIME_EVENTS.MESSAGE_NEW, handleNewMessage);
      socket.off(REALTIME_EVENTS.MESSAGE_EDIT, handleEditMessage);
      socket.off(REALTIME_EVENTS.MESSAGE_DELETE, handleDeleteMessage);
      socket.emit('leave', room);
    };
    // queryKey is derived from threadId + lensFilter, both in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, threadId, currentUserId, lensFilter, queryClient]);

  // Actions
  const sendMsg = useCallback(
    async (content: unknown) => {
      if (!threadId) return;
      const message = await sendMessageAction({
        threadId,
        content,
      });
      // Optimistic append
      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;
        const lastPage = old.pages[old.pages.length - 1];
        if (!lastPage) return old;
        return {
          ...old,
          pages: [
            ...old.pages.slice(0, -1),
            { ...lastPage, items: [...lastPage.items, message] },
          ],
        };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threadId, queryClient],
  );

  const editMsg = useCallback(
    async (messageId: string, content: unknown) => {
      const updated = await editMessageAction({ messageId, content });
      if (!updated) return;
      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((m) =>
              m.id === messageId ? updated : m,
            ),
          })),
        };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient],
  );

  const deleteMsg = useCallback(
    async (messageId: string) => {
      await deleteMessageAction({ messageId });
      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((m) => m.id !== messageId),
          })),
        };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient],
  );

  return {
    messages,
    isLoading: isLoading || isFetchingNextPage,
    hasMore: !!hasNextPage,
    loadMore: () => {
      if (hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    unreadCount,
    sendMessage: sendMsg,
    editMessage: editMsg,
    deleteMessage: deleteMsg,
  };
}
