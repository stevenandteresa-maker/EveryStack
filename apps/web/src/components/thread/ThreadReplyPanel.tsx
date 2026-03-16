'use client';

/**
 * ThreadReplyPanel — 360px side panel for threaded replies.
 *
 * Opens when user clicks "N replies · last Xm ago" chip.
 * Shows reply chain with ChatEditor at bottom for composing replies.
 *
 * @see docs/reference/communications.md § Threaded Replies
 */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatEditor } from '@/components/chat/ChatEditor';
import type { ReactionsMap } from '@/components/chat/EmojiReactions';
import { MessageItem } from '@/components/chat/MessageItem';
import { useThread } from './use-thread';
import type { ThreadMessage } from '@everystack/shared/db';
import type { JSONContent } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadReplyPanelProps {
  parentMessage: ThreadMessage;
  threadId: string;
  socket: Socket | null;
  currentUserId: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadReplyPanel({
  parentMessage,
  threadId,
  socket,
  currentUserId,
  onClose,
}: ThreadReplyPanelProps) {
  const t = useTranslations('thread');

  const {
    messages: replies,
    isLoading,
    hasMore,
    loadMore,
    sendMessage,
  } = useThread({
    threadId,
    socket,
    currentUserId,
    fetchMessages: async (tid, opts) => {
      const { getMessagesAction } = await import('@/actions/thread-queries');
      return getMessagesAction({
        threadId: tid,
        parentMessageId: parentMessage.id,
        ...opts,
      });
    },
  });

  const handleSend = useCallback(
    (content: JSONContent) => {
      void sendMessage(content);
    },
    [sendMessage],
  );

  return (
    <div
      className="flex flex-col h-full border-l bg-background"
      style={{ width: '360px' }}
      role="complementary"
      aria-label={t('replyPanelLabel')}
      data-testid="thread-reply-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h4 className="text-sm font-semibold">{t('replyPanelTitle')}</h4>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          aria-label={t('closePanel')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Parent message */}
      <div className="border-b px-1 py-2 bg-muted/30">
        <ParentMessagePreview message={parentMessage} currentUserId={currentUserId} />
      </div>

      {/* Reply chain */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-1">
        {hasMore && (
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground py-1 hover:underline"
            onClick={loadMore}
            data-testid="reply-load-more"
          >
            {t('loadMore')}
          </button>
        )}

        {isLoading ? (
          <ReplySkeleton />
        ) : replies.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
            {t('noReplies')}
          </div>
        ) : (
          replies.map((reply) => (
            <ReplyMessageAdapter
              key={reply.id}
              message={reply}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>

      {/* Reply input */}
      <div className="border-t p-2">
        <ChatEditor
          onSend={handleSend}
          placeholder={t('replyPlaceholder')}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reply chip — used in ThreadMessageList to show reply count
// ---------------------------------------------------------------------------

interface ReplyChipProps {
  replyCount: number;
  lastReplyAt: string;
  onClick: () => void;
}

export function ReplyChip({ replyCount, lastReplyAt, onClick }: ReplyChipProps) {
  const t = useTranslations('thread');
  const timeAgo = formatTimeAgo(lastReplyAt);

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline mt-1"
      onClick={onClick}
      data-testid="reply-chip"
    >
      {t('replyChip', { count: replyCount, time: timeAgo })}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ParentMessagePreview({
  message,
  currentUserId,
}: {
  message: ThreadMessage;
  currentUserId: string;
}) {
  return (
    <MessageItem
      message={{
        id: message.id,
        thread_id: message.threadId,
        author_id: message.authorId ?? '',
        author_name: message.authorId?.slice(0, 8) ?? 'System',
        content: message.content as JSONContent,
        message_type: message.messageType,
        reactions: (message.reactions ?? {}) as ReactionsMap,
        is_edited: !!message.editedAt,
        is_deleted: !!message.archivedAt,
        is_pinned: !!message.pinnedAt,
        created_at: message.createdAt.toISOString?.() ?? String(message.createdAt),
        updated_at: message.createdAt.toISOString?.() ?? String(message.createdAt),
      }}
      currentUserId={currentUserId}
    />
  );
}

function ReplyMessageAdapter({
  message,
  currentUserId,
}: {
  message: ThreadMessage;
  currentUserId: string;
}) {
  return (
    <MessageItem
      message={{
        id: message.id,
        thread_id: message.threadId,
        author_id: message.authorId ?? '',
        author_name: message.authorId?.slice(0, 8) ?? 'System',
        content: message.content as JSONContent,
        message_type: message.messageType,
        reactions: (message.reactions ?? {}) as ReactionsMap,
        is_edited: !!message.editedAt,
        is_deleted: !!message.archivedAt,
        is_pinned: !!message.pinnedAt,
        created_at: message.createdAt.toISOString?.() ?? String(message.createdAt),
        updated_at: message.createdAt.toISOString?.() ?? String(message.createdAt),
      }}
      currentUserId={currentUserId}
    />
  );
}

function ReplySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return '<1m ago';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
