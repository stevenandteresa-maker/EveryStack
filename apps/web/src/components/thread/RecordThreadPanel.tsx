'use client';

/**
 * RecordThreadPanel — 25% width panel that opens alongside the Record View
 * from the header chat icon.
 *
 * Contains: ThreadTabBar, ThreadLensBar, ThreadMessageList (virtualized),
 * ThreadSearchBar, PinnedMessagesPanel, ChatEditor input, typing indicator.
 *
 * @see docs/reference/communications.md § Record Thread
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pin, Search, X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatEditor } from '@/components/chat/ChatEditor';
import { ThreadTabBar, type ThreadTab } from './ThreadTabBar';
import { ThreadLensBar } from './ThreadLensBar';
import { ClientVisibleBanner } from './ClientVisibleBanner';
import { ThreadMessageList } from './ThreadMessageList';
import { ThreadSearchBar } from './ThreadSearchBar';
import { PinnedMessagesPanel } from './PinnedMessagesPanel';
import { useThread, type LensFilter } from './use-thread';
import { useThreadSearch } from './use-thread-search';
import { useTypingIndicator } from './use-typing-indicator';
import type { JSONContent } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecordThreadPanelProps {
  recordId: string;
  tenantId: string;
  socket: Socket | null;
  currentUserId: string;
  currentUserName?: string;
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
  currentUserName = '',
  internalThreadId,
  clientThreadId,
  onClose,
}: RecordThreadPanelProps) {
  void _recordId;
  void _tenantId;
  const t = useTranslations('thread');
  const [activeTab, setActiveTab] = useState<ThreadTab>('internal');
  const [lensFilter, setLensFilter] = useState<LensFilter>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);

  const clientThreadEnabled = clientThreadId !== null;
  const activeThreadId =
    activeTab === 'client' ? clientThreadId : internalThreadId;

  // Reset lens when switching tabs
  const handleTabChange = useCallback((tab: ThreadTab) => {
    setActiveTab(tab);
    setLensFilter(undefined);
  }, []);

  // Reset tab to internal if client thread becomes disabled
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
    editMessage,
    deleteMessage,
  } = useThread({
    threadId: activeThreadId,
    socket,
    currentUserId,
    lensFilter,
  });

  const { typingUsers, startTyping } = useTypingIndicator({
    threadId: activeThreadId,
    socket,
    currentUserId,
    currentUserName,
  });

  const search = useThreadSearch({
    threadId: activeThreadId,
    messages,
    allLoaded: !hasMore,
  });

  const highlightMessageIds = useMemo(
    () => new Set(search.results.map((m) => m.id)),
    [search.results],
  );

  // Cmd+F handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        // Only intercept when panel is focused
        const panel = document.querySelector('[data-testid="record-thread-panel"]');
        if (panel?.contains(document.activeElement) || panel === document.activeElement) {
          e.preventDefault();
          setSearchOpen(true);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSend = useCallback(
    (content: JSONContent) => {
      void sendMessage(content);
    },
    [sendMessage],
  );

  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <div
      className="relative flex flex-col h-full border-l bg-background"
      style={{ width: '25%', minWidth: '280px' }}
      role="complementary"
      aria-label={t('panelLabel')}
      data-testid="record-thread-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label={t('searchPlaceholder')}
            data-testid="thread-search-toggle"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPinnedOpen(!pinnedOpen)}
            aria-label={t('pinnedButton')}
            data-testid="thread-pinned-toggle"
          >
            <Pin className="h-4 w-4" />
          </Button>
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
      </div>

      {/* Search bar */}
      <ThreadSearchBar
        search={search}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* Tab bar */}
      <ThreadTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        clientThreadEnabled={clientThreadEnabled}
      />

      {/* Lens bar */}
      <ThreadLensBar activeLens={lensFilter} onLensChange={setLensFilter} />

      {/* Message list — virtualized */}
      {isLoading ? (
        <div className="flex-1 px-3 py-2">
          <ThreadSkeleton />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {t('noMessages')}
        </div>
      ) : (
        <ThreadMessageList
          messages={messages}
          currentUserId={currentUserId}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onEdit={(id, content) => void editMessage(id, content)}
          onDelete={(id) => void deleteMessage(id)}
          typingUsers={typingUsers}
          highlightMessageIds={highlightMessageIds}
        />
      )}

      {/* Client visible banner (only in client tab) */}
      {activeTab === 'client' && <ClientVisibleBanner />}

      {/* Chat input */}
      <div className="border-t p-2" onKeyDown={() => startTyping()}>
        <ChatEditor
          onSend={handleSend}
          placeholder={
            activeTab === 'client'
              ? t('clientInputPlaceholder')
              : t('internalInputPlaceholder')
          }
        />
      </div>

      {/* Pinned messages overlay */}
      <PinnedMessagesPanel
        threadId={activeThreadId}
        isOpen={pinnedOpen}
        onClose={() => setPinnedOpen(false)}
        onScrollToMessage={handleScrollToMessage}
      />
    </div>
  );
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
