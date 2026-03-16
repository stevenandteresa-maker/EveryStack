'use client';

/**
 * ThreadMessageList — virtualized, auto-scrolling message list.
 *
 * Uses TanStack Virtual for efficient rendering of large threads.
 * Auto-scrolls to bottom on new messages unless user has scrolled up.
 * Loads older messages on scroll-to-top (reverse pagination).
 *
 * @see docs/reference/communications.md § Record Thread
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ThreadMessage } from '@everystack/shared/db';
import type { JSONContent } from '@tiptap/core';
import type { ReactionsMap } from '@/components/chat/EmojiReactions';
import { MessageItem } from '@/components/chat/MessageItem';
import { SharedNoteMessage } from './SharedNoteMessage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadMessageListProps {
  messages: ThreadMessage[];
  currentUserId: string;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onEdit?: (messageId: string, content: unknown) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onSave?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  /** Users currently typing */
  typingUsers?: string[];
  /** Highlight positions from search */
  highlightMessageIds?: Set<string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ESTIMATED_MESSAGE_HEIGHT = 72;
const SCROLL_THRESHOLD = 100;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadMessageList({
  messages,
  currentUserId,
  isLoading,
  hasMore,
  onLoadMore,
  onEdit,
  onDelete,
  onPin,
  onSave,
  onReply,
  onReactionToggle,
  typingUsers = [],
  highlightMessageIds,
}: ThreadMessageListProps) {
  const t = useTranslations('thread');
  const parentRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const prevMessageCountRef = useRef(messages.length);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_MESSAGE_HEIGHT,
    overscan: 5,
  });

  // Detect user scroll position
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsUserScrolledUp(distFromBottom > SCROLL_THRESHOLD);

    // Load more when scrolled to top
    if (el.scrollTop === 0 && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore]);

  // Auto-scroll to bottom on new messages (unless user scrolled up)
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && !isUserScrolledUp) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isUserScrolledUp, virtualizer]);

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      });
    }
    // Only on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
      data-testid="thread-message-list"
    >
      {/* Load more indicator */}
      {hasMore && (
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground py-2 hover:underline"
          onClick={onLoadMore}
          data-testid="thread-load-more"
        >
          {t('loadMore')}
        </button>
      )}

      {/* Virtualized container */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const message = messages[virtualRow.index];
          if (!message) return null;

          const isHighlighted = highlightMessageIds?.has(message.id);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className={isHighlighted ? 'bg-yellow-100/60 rounded' : undefined}
              >
                {message.sourceNoteId ? (
                  <SharedNoteMessage>
                    <MessageItemAdapter
                      message={message}
                      currentUserId={currentUserId}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onPin={onPin}
                      onSave={onSave}
                      onReply={onReply}
                      onReactionToggle={onReactionToggle}
                    />
                  </SharedNoteMessage>
                ) : (
                  <MessageItemAdapter
                    message={message}
                    currentUserId={currentUserId}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPin={onPin}
                    onSave={onSave}
                    onReply={onReply}
                    onReactionToggle={onReactionToggle}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div
          className="px-4 py-2 text-xs text-muted-foreground"
          data-testid="typing-indicator"
        >
          <span>{formatTypingText(typingUsers, t)}</span>
          <TypingDots />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageItem adapter — maps DB ThreadMessage to MessageItem's interface
// ---------------------------------------------------------------------------

function MessageItemAdapter({
  message,
  currentUserId,
  onEdit,
  onDelete,
  onPin,
  onSave,
  onReply,
  onReactionToggle,
}: {
  message: ThreadMessage;
  currentUserId: string;
  onEdit?: (messageId: string, content: unknown) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onSave?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
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
      onEdit={onEdit ? (id, content) => onEdit(id, content) : undefined}
      onDelete={onDelete}
      onPin={onPin}
      onSave={onSave}
      onReply={onReply}
      onReactionToggle={onReactionToggle}
    />
  );
}

// ---------------------------------------------------------------------------
// Typing indicator helpers
// ---------------------------------------------------------------------------

function formatTypingText(
  users: string[],
  t: ReturnType<typeof useTranslations>,
): string {
  if (users.length === 1) {
    return t('typingOne', { name: users[0] ?? '' });
  }
  if (users.length === 2) {
    return t('typingTwo', { name1: users[0] ?? '', name2: users[1] ?? '' });
  }
  return t('typingMany', { count: users.length });
}

function TypingDots() {
  return (
    <span className="inline-flex ml-1" aria-hidden="true">
      <span className="animate-bounce inline-block w-1 h-1 rounded-full bg-muted-foreground mx-px" style={{ animationDelay: '0ms' }} />
      <span className="animate-bounce inline-block w-1 h-1 rounded-full bg-muted-foreground mx-px" style={{ animationDelay: '150ms' }} />
      <span className="animate-bounce inline-block w-1 h-1 rounded-full bg-muted-foreground mx-px" style={{ animationDelay: '300ms' }} />
    </span>
  );
}
