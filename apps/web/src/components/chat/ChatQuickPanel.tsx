'use client';

/**
 * ChatQuickPanel — unified conversation feed in the sidebar Quick Panel area.
 *
 * Shows all conversations (Record Threads + DMs + Group DMs) sorted by recency.
 * Uses listThreadsForUser from data layer. Real-time: new messages bump
 * conversation to top. Click navigates to RecordThreadPanel or DMConversation.
 *
 * @see docs/reference/communications.md § Chat Quick Panel
 */

import { useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { MessageSquare } from 'lucide-react';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatQuickPanelItem } from './ChatQuickPanelItem';
import type { ThreadWithLastMessage, PaginatedResult } from '@/data/threads';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatQuickPanelProps {
  tenantId: string;
  userId: string;
  socket: Socket | null;
  onOpenRecordThread: (thread: ThreadWithLastMessage) => void;
  onOpenDM: (thread: ThreadWithLastMessage) => void;
  /** Server action to fetch threads (injectable for testing) */
  fetchThreads?: (
    opts?: { cursor?: string; limit?: number },
  ) => Promise<PaginatedResult<ThreadWithLastMessage>>;
}

// ---------------------------------------------------------------------------
// Default fetcher (server action)
// ---------------------------------------------------------------------------

async function defaultFetchThreads(
  opts?: { cursor?: string; limit?: number },
): Promise<PaginatedResult<ThreadWithLastMessage>> {
  const { listThreadsForUserAction } = await import('@/actions/threads');
  return listThreadsForUserAction(opts);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatQuickPanel({
  tenantId,
  userId,
  socket,
  onOpenRecordThread,
  onOpenDM,
  fetchThreads = defaultFetchThreads,
}: ChatQuickPanelProps) {
  const t = useTranslations('chat.quickPanel');
  const queryClient = useQueryClient();

  const queryKey = ['chat-quick-panel', tenantId, userId];

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      return fetchThreads({
        cursor: pageParam as string | undefined,
        limit: 30,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const threads = data?.pages.flatMap((p) => p.items) ?? [];

  // Real-time: new message bumps conversation to top
  useEffect(() => {
    if (!socket || !userId) return;

    const room = `user:${userId}:threads`;
    socket.emit('join', room);

    function handleNewMessage(payload: {
      threadId: string;
      content: string;
      authorId: string;
      createdAt: string;
    }) {
      queryClient.setQueryData(queryKey, (old: typeof data) => {
        if (!old) return old;

        const allItems = old.pages.flatMap((p) => p.items);
        const existingIdx = allItems.findIndex((t) => t.id === payload.threadId);

        if (existingIdx >= 0) {
          // Move existing thread to top with updated last message
          const thread = allItems[existingIdx]!;
          const updated: ThreadWithLastMessage = {
            ...thread,
            updatedAt: new Date(payload.createdAt),
            lastMessage: {
              content: payload.content,
              authorId: payload.authorId,
              createdAt: new Date(payload.createdAt),
            },
            unreadCount: thread.unreadCount + 1,
          };
          const remaining = allItems.filter((_, i) => i !== existingIdx);
          const newItems = [updated, ...remaining];

          return {
            ...old,
            pages: [
              { items: newItems, nextCursor: old.pages[old.pages.length - 1]?.nextCursor ?? null },
            ],
          };
        }

        // New thread — refetch to get full data
        void queryClient.invalidateQueries({ queryKey });
        return old;
      });
    }

    socket.on(REALTIME_EVENTS.MESSAGE_NEW, handleNewMessage);

    return () => {
      socket.off(REALTIME_EVENTS.MESSAGE_NEW, handleNewMessage);
      socket.emit('leave', room);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, userId, tenantId, queryClient]);

  // Click handler: route to correct view based on scope type
  const handleItemClick = useCallback(
    (thread: ThreadWithLastMessage) => {
      if (thread.scopeType === 'record') {
        onOpenRecordThread(thread);
      } else {
        // dm or group_dm
        onOpenDM(thread);
      }
    },
    [onOpenRecordThread, onOpenDM],
  );

  // Scroll-to-bottom load more
  const handleScrollEnd = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      className="flex flex-col h-full"
      data-testid="chat-quick-panel"
      role="region"
      aria-label={t('title')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <h3 className="text-body-sm font-semibold text-[var(--sidebar-text)]">
          {t('title')}
        </h3>
      </div>

      {/* Conversation list */}
      {isLoading ? (
        <QuickPanelSkeleton />
      ) : threads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <MessageSquare className="h-8 w-8 text-[var(--sidebar-text-muted)]" />
          <p className="text-body-sm text-[var(--sidebar-text-muted)]">
            {t('empty')}
          </p>
        </div>
      ) : (
        <ScrollArea
          className="flex-1"
          onScrollCapture={(e) => {
            const target = e.currentTarget;
            const scrollEl = target.querySelector('[data-radix-scroll-area-viewport]');
            if (!scrollEl) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollEl;
            if (scrollHeight - scrollTop - clientHeight < 100) {
              handleScrollEnd();
            }
          }}
        >
          <div className="py-1" data-testid="chat-quick-panel-list">
            {threads.map((thread) => (
              <ChatQuickPanelItem
                key={thread.id}
                thread={thread}
                onClick={handleItemClick}
              />
            ))}
            {isFetchingNextPage && <QuickPanelItemSkeleton />}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function QuickPanelSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-2" data-testid="chat-quick-panel-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <QuickPanelItemSkeleton key={i} />
      ))}
    </div>
  );
}

function QuickPanelItemSkeleton() {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-3.5 w-24 mb-1" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}
