'use client';

/**
 * RecordThreadPanel — 25% width panel that opens alongside the Record View
 * from the header chat icon.
 *
 * Contains: ThreadTabBar, ThreadLensBar, message list, ChatEditor input.
 *
 * @see docs/reference/communications.md § Record Thread
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatEditor } from '@/components/chat/ChatEditor';
import { ThreadTabBar, type ThreadTab } from './ThreadTabBar';
import { ThreadLensBar } from './ThreadLensBar';
import { ClientVisibleBanner } from './ClientVisibleBanner';
import { SharedNoteMessage } from './SharedNoteMessage';
import { useThread, type LensFilter } from './use-thread';
import type { ThreadMessage } from '@everystack/shared/db';
import type { JSONContent } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecordThreadPanelProps {
  recordId: string;
  tenantId: string;
  socket: Socket | null;
  currentUserId: string;
  /** Thread ID for internal thread (resolved by parent) */
  internalThreadId: string | null;
  /** Thread ID for client thread (null when Client Messaging disabled) */
  clientThreadId: string | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordThreadPanel({
  recordId: _recordId,
  tenantId: _tenantId,
  socket,
  currentUserId,
  internalThreadId,
  clientThreadId,
  onClose,
}: RecordThreadPanelProps) {
  // recordId and tenantId are used in Prompt 15+ for thread navigation/creation
  void _recordId;
  void _tenantId;
  const t = useTranslations('thread');
  const [activeTab, setActiveTab] = useState<ThreadTab>('internal');
  const [lensFilter, setLensFilter] = useState<LensFilter>(undefined);

  const clientThreadEnabled = clientThreadId !== null;
  const activeThreadId =
    activeTab === 'client' ? clientThreadId : internalThreadId;

  // Reset lens when switching tabs
  const handleTabChange = useCallback((tab: ThreadTab) => {
    setActiveTab(tab);
    setLensFilter(undefined);
  }, []);

  // Reset tab to internal if client thread becomes disabled
  // Using state-based sync instead of useEffect to avoid set-state-in-effect lint
  const [trackedClientEnabled, setTrackedClientEnabled] = useState(clientThreadEnabled);
  if (trackedClientEnabled !== clientThreadEnabled) {
    setTrackedClientEnabled(clientThreadEnabled);
    if (!clientThreadEnabled && activeTab === 'client') {
      setActiveTab('internal');
    }
  }

  const {
    messages,
    isLoading,
    hasMore,
    loadMore,
    sendMessage,
  } = useThread({
    threadId: activeThreadId,
    socket,
    currentUserId,
    lensFilter,
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
      style={{ width: '25%', minWidth: '280px' }}
      role="complementary"
      aria-label={t('panelLabel')}
      data-testid="record-thread-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
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

      {/* Tab bar */}
      <ThreadTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        clientThreadEnabled={clientThreadEnabled}
      />

      {/* Lens bar */}
      <ThreadLensBar activeLens={lensFilter} onLensChange={setLensFilter} />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {hasMore && (
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground py-1 hover:underline"
            onClick={loadMore}
            data-testid="thread-load-more"
          >
            {t('loadMore')}
          </button>
        )}

        {isLoading ? (
          <ThreadSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            {t('noMessages')}
          </div>
        ) : (
          messages.map((msg) => (
            <MessageRow key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Client visible banner (only in client tab) */}
      {activeTab === 'client' && <ClientVisibleBanner />}

      {/* Chat input */}
      <div className="border-t p-2">
        <ChatEditor
          onSend={handleSend}
          placeholder={
            activeTab === 'client'
              ? t('clientInputPlaceholder')
              : t('internalInputPlaceholder')
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message row — simple inline render (Prompt 15 adds virtualized list)
// ---------------------------------------------------------------------------

function MessageRow({ message }: { message: ThreadMessage }) {
  const t = useTranslations('chat.messageItem');
  const content =
    typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);

  const body = (
    <div className="text-sm py-1">
      <div className="text-xs text-muted-foreground mb-0.5">
        {message.authorId?.slice(0, 8)}
        {message.editedAt && (
          <span className="ml-1 opacity-60">{t('edited')}</span>
        )}
      </div>
      <div className="whitespace-pre-wrap break-words">{content}</div>
    </div>
  );

  if (message.sourceNoteId) {
    return <SharedNoteMessage>{body}</SharedNoteMessage>;
  }

  return body;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ThreadSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
