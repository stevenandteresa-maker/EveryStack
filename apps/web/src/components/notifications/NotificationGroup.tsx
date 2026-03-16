'use client';

/**
 * NotificationGroup — collapsed cluster of notifications sharing a group_key.
 *
 * Shows "Sarah, James, and 2 others commented on {threadName}" when collapsed.
 * Expands to show individual NotificationItem rows on click.
 *
 * @see docs/reference/communications.md § Smart Grouping
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Notification } from '@everystack/shared/db';
import { NotificationItem } from './NotificationItem';

// ---------------------------------------------------------------------------
// Helpers
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
  return `${diffDays}d`;
}

/**
 * Builds the collapsed summary line from notification titles.
 * Extracts actor names from title patterns like "{name} mentioned you..."
 */
function buildGroupSummary(
  notifs: Notification[],
  t: ReturnType<typeof useTranslations>,
): string {
  const titles = notifs.map((n) => n.title);

  if (titles.length <= 2) {
    return titles.join(', ');
  }

  const first = titles[0]!;
  const othersCount = titles.length - 1;
  return t('groupSummary', { first, othersCount });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationGroupProps {
  notifications: Notification[];
  onMarkRead: (id: string) => Promise<void>;
}

export function NotificationGroup({ notifications, onMarkRead }: NotificationGroupProps) {
  const t = useTranslations('notifications');
  const [expanded, setExpanded] = useState(false);
  const hasUnread = notifications.some((n) => !n.read);
  const latestTime = notifications[0]?.createdAt;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  if (expanded) {
    return (
      <div data-testid="notification-group">
        <button
          type="button"
          className={cn(
            'w-full text-left px-4 py-2 flex items-center gap-2',
            'hover:bg-[var(--muted)] transition-colors',
            'text-caption text-[var(--text-tertiary)]',
          )}
          onClick={() => setExpanded(false)}
          aria-label={t('collapseGroup')}
        >
          <Chevron size={14} />
          <span>
            {t('groupCount', { count: notifications.length })}
          </span>
        </button>
        {notifications.map((notif) => (
          <NotificationItem
            key={notif.id}
            notification={notif}
            onMarkRead={onMarkRead}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid="notification-group"
      className={cn(
        'w-full text-left px-4 py-3 flex items-start gap-3',
        'hover:bg-[var(--muted)] transition-colors',
        hasUnread && 'border-l-2 border-l-[#0D9488]',
        !hasUnread && 'border-l-2 border-l-transparent',
      )}
      onClick={() => setExpanded(true)}
      aria-label={t('expandGroup')}
    >
      <div className="shrink-0 mt-0.5">
        <Chevron
          size={16}
          className={hasUnread ? 'text-[#0D9488]' : 'text-[var(--text-tertiary)]'}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-body-sm truncate',
            hasUnread ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--text-secondary)]',
          )}
        >
          {buildGroupSummary(notifications, t)}
        </p>
      </div>

      <span className="shrink-0 text-timestamp text-[var(--text-tertiary)]">
        {latestTime ? formatTimeAgo(latestTime) : ''}
      </span>
    </button>
  );
}
