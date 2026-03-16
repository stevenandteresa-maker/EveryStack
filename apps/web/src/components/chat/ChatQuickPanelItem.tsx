'use client';

/**
 * ChatQuickPanelItem — conversation preview row for the Chat Quick Panel.
 *
 * Displays avatar (type-aware), name/record title, last message preview,
 * relative timestamp, and unread count badge.
 *
 * @see docs/reference/communications.md § Chat Quick Panel
 */

import { FileText, MessageSquare, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PresenceIndicator } from '@/components/presence/PresenceIndicator';
import type { PresenceState } from '@/components/presence/use-presence';
import type { ThreadWithLastMessage } from '@/data/threads';

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return '<1m';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Avatar by scope type
// ---------------------------------------------------------------------------

function ScopeAvatar({ scopeType, presenceStatus }: { scopeType: string; presenceStatus?: PresenceState }) {
  const iconClass = 'h-4 w-4 text-[var(--text-tertiary)]';

  const icon = scopeType === 'dm'
    ? <MessageSquare className={iconClass} />
    : scopeType === 'group_dm'
      ? <Users className={iconClass} />
      : <FileText className={iconClass} />;

  return (
    <div className="relative shrink-0">
      <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
        {icon}
      </div>
      {presenceStatus && scopeType === 'dm' && (
        <PresenceIndicator
          status={presenceStatus}
          size="small"
          className="absolute -bottom-0.5 -right-0.5 ring-2 ring-[var(--background)]"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ChatQuickPanelItemProps {
  thread: ThreadWithLastMessage;
  onClick: (thread: ThreadWithLastMessage) => void;
  /** Presence map for showing online status on DM avatars */
  presenceMap?: Record<string, PresenceState>;
}

export function ChatQuickPanelItem({ thread, onClick, presenceMap }: ChatQuickPanelItemProps) {
  const t = useTranslations('chat.quickPanel');

  const displayName = thread.name ?? t('untitledConversation');
  const preview = thread.lastMessage
    ? truncate(thread.lastMessage.content, 60)
    : t('noMessagesYet');
  const timestamp = thread.lastMessage
    ? formatTimeAgo(thread.lastMessage.createdAt)
    : '';
  const hasUnread = thread.unreadCount > 0;

  return (
    <button
      type="button"
      data-testid="chat-quick-panel-item"
      className={cn(
        'w-full text-left px-3 py-2.5 flex items-start gap-3',
        'hover:bg-[var(--muted)] transition-colors rounded-md',
        hasUnread && 'bg-[var(--muted)]/50',
      )}
      onClick={() => onClick(thread)}
      aria-label={t('openConversation', { name: displayName })}
    >
      <ScopeAvatar
        scopeType={thread.scopeType}
        presenceStatus={
          presenceMap && thread.lastMessage
            ? presenceMap[thread.lastMessage.authorId]
            : undefined
        }
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-body-sm truncate',
              hasUnread
                ? 'font-semibold text-[var(--foreground)]'
                : 'text-[var(--text-secondary)]',
            )}
          >
            {displayName}
          </span>
          {timestamp && (
            <span className="shrink-0 text-timestamp text-[var(--text-tertiary)]">
              {timestamp}
            </span>
          )}
        </div>
        <p className="text-caption text-[var(--text-tertiary)] truncate mt-0.5">
          {preview}
        </p>
      </div>

      {hasUnread && (
        <Badge
          data-testid="unread-badge"
          className="shrink-0 mt-1 min-w-[20px] h-5 rounded-full bg-[#0D9488] text-white text-[11px] font-semibold flex items-center justify-center px-1.5"
        >
          {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
        </Badge>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
