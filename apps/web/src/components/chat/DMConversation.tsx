'use client';

/**
 * DMConversation — DM/Group DM conversation view.
 *
 * Uses useThread hook for message loading + real-time delivery.
 * Renders ThreadMessageList + ChatEditor in a persistent thread.
 *
 * @see docs/reference/communications.md § DMs
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Socket } from 'socket.io-client';
import type { JSONContent } from '@tiptap/core';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatEditor } from '@/components/chat/ChatEditor';
import { ThreadMessageList } from '@/components/thread/ThreadMessageList';
import { useThread } from '@/components/thread/use-thread';
import { useTypingIndicator } from '@/components/thread/use-typing-indicator';
import { MessageErrorHandler, type FailedMessage } from '@/components/chat/MessageErrorHandler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DMConversationProps {
  threadId: string;
  tenantId: string;
  socket: Socket | null;
  currentUserId: string;
  currentUserName?: string;
  /** Optional header slot for GroupDMHeader or DM partner info */
  header?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DMConversation({
  threadId,
  tenantId: _tenantId,
  socket,
  currentUserId,
  currentUserName = '',
  header,
}: DMConversationProps) {
  void _tenantId;
  const t = useTranslations('chat.dm');

  const {
    messages,
    isLoading,
    hasMore,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
  } = useThread({
    threadId,
    socket,
    currentUserId,
  });

  const { typingUsers, startTyping } = useTypingIndicator({
    threadId,
    socket,
    currentUserId,
    currentUserName,
  });

  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([]);

  const handleSend = useCallback(
    async (content: JSONContent) => {
      try {
        await sendMessage(content);
      } catch {
        const failed: FailedMessage = {
          id: crypto.randomUUID(),
          content,
          threadId,
          retryCount: 0,
          maxRetries: 3,
          status: 'failed',
        };
        setFailedMessages((prev) => [...prev, failed]);
      }
    },
    [sendMessage, threadId],
  );

  const handleRetry = useCallback(
    async (failedMsg: FailedMessage) => {
      setFailedMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id ? { ...m, status: 'retrying' as const } : m,
        ),
      );
      try {
        await sendMessage(failedMsg.content);
        setFailedMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
      } catch {
        setFailedMessages((prev) =>
          prev.map((m) =>
            m.id === failedMsg.id
              ? { ...m, retryCount: m.retryCount + 1, status: 'failed' as const }
              : m,
          ),
        );
      }
    },
    [sendMessage],
  );

  return (
    <div
      className="flex flex-col h-full bg-background"
      data-testid="dm-conversation"
    >
      {/* Optional header (GroupDMHeader or partner info) */}
      {header}

      {/* Message list */}
      {isLoading ? (
        <div className="flex-1 px-3 py-2">
          <DMSkeleton />
        </div>
      ) : messages.length === 0 && failedMessages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {t('noMessages')}
        </div>
      ) : (
        <>
          <ThreadMessageList
            messages={messages}
            currentUserId={currentUserId}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onEdit={(id, content) => void editMessage(id, content)}
            onDelete={(id) => void deleteMessage(id)}
            typingUsers={typingUsers}
          />
          <MessageErrorHandler
            failedMessages={failedMessages}
            onRetry={handleRetry}
            onDismiss={(id) =>
              setFailedMessages((prev) => prev.filter((m) => m.id !== id))
            }
          />
        </>
      )}

      {/* Chat input */}
      <div className="border-t p-2" onKeyDown={() => startTyping()}>
        <ChatEditor
          onSend={(content) => void handleSend(content)}
          placeholder={t('inputPlaceholder')}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DMSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
