'use client';

/**
 * PinnedMessagesPanel — overlay panel listing pinned messages.
 *
 * Accessible via 📌 icon in thread header.
 * Pinned messages sorted by pinned_at DESC (most recent first).
 * Click a pin → scroll to original message in thread.
 *
 * @see docs/reference/communications.md § Pinned Messages
 */

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Pin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ThreadMessage } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PinnedMessagesPanelProps {
  threadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onScrollToMessage: (messageId: string) => void;
  /** Injectable for testing */
  fetchPinned?: (threadId: string) => Promise<ThreadMessage[]>;
}

// ---------------------------------------------------------------------------
// Default fetcher
// ---------------------------------------------------------------------------

async function defaultFetchPinned(threadId: string): Promise<ThreadMessage[]> {
  const { getPinnedMessagesAction } = await import(
    '@/actions/thread-queries'
  );
  return getPinnedMessagesAction({ threadId });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PinnedMessagesPanel({
  threadId,
  isOpen,
  onClose,
  onScrollToMessage,
  fetchPinned = defaultFetchPinned,
}: PinnedMessagesPanelProps) {
  const t = useTranslations('thread');

  const { data: pinnedMessages = [], isLoading } = useQuery({
    queryKey: ['pinned-messages', threadId],
    queryFn: () => (threadId ? fetchPinned(threadId) : Promise.resolve([])),
    enabled: isOpen && !!threadId,
  });

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-background"
      data-testid="pinned-messages-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4" />
          <h4 className="text-sm font-semibold">{t('pinnedTitle')}</h4>
        </div>
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

      {/* Pinned list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <PinnedSkeleton />
        ) : pinnedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            {t('noPinnedMessages')}
          </div>
        ) : (
          pinnedMessages.map((msg) => (
            <PinnedMessageRow
              key={msg.id}
              message={msg}
              onClick={() => {
                onClose();
                onScrollToMessage(msg.id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pinned message row
// ---------------------------------------------------------------------------

function PinnedMessageRow({
  message,
  onClick,
}: {
  message: ThreadMessage;
  onClick: () => void;
}) {
  const content =
    typeof message.content === 'string'
      ? message.content
      : extractTextPreview(message.content);

  const pinnedDate = message.pinnedAt
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }).format(new Date(message.pinnedAt))
    : '';

  return (
    <button
      type="button"
      className="w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors"
      onClick={onClick}
      data-testid="pinned-message-row"
    >
      <div className="flex items-center gap-2 mb-1">
        <Pin className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {message.authorId?.slice(0, 8) ?? 'System'}
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{pinnedDate}</span>
      </div>
      <p className="text-sm line-clamp-2">{content}</p>
    </button>
  );
}

function extractTextPreview(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const node = content as Record<string, unknown>;
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return (node.content as unknown[])
      .map(extractTextPreview)
      .filter(Boolean)
      .join(' ')
      .slice(0, 200);
  }
  return '';
}

function PinnedSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-3 py-3 border-b">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
