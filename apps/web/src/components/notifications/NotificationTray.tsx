'use client';

/**
 * NotificationTray — dropdown panel showing notification list with grouping.
 *
 * 400px wide × 480px max height, right-aligned, scrollable.
 * Groups notifications by group_key within 5-minute proximity.
 *
 * @see docs/reference/communications.md § Bell Icon Delivery
 */

import { useCallback, useRef } from 'react';
import { CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Notification } from '@everystack/shared/db';
import { groupNotifications } from './notification-grouping';
import { NotificationItem } from './NotificationItem';
import { NotificationGroup } from './NotificationGroup';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationTrayProps {
  notifications: Notification[];
  isLoading: boolean;
  hasMore: boolean;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onLoadMore: () => void;
}

export function NotificationTray({
  notifications,
  isLoading,
  hasMore,
  onMarkRead,
  onMarkAllRead,
  onLoadMore,
}: NotificationTrayProps) {
  const t = useTranslations('notifications');
  const scrollRef = useRef<HTMLDivElement>(null);

  const entries = groupNotifications(notifications);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore]);

  return (
    <div
      data-testid="notification-tray"
      className="w-[400px] max-h-[480px] bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-body font-semibold text-[var(--foreground)]">
          {t('title')}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-caption gap-1.5"
          onClick={onMarkAllRead}
          data-testid="mark-all-read"
        >
          <CheckCheck size={14} />
          {t('markAllRead')}
        </Button>
      </div>

      {/* Notification list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {isLoading && entries.length === 0 ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-4 h-4 rounded-full shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-body-sm text-[var(--text-tertiary)]">
            {t('empty')}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry) => {
              if (entry.kind === 'single') {
                return (
                  <NotificationItem
                    key={entry.notification.id}
                    notification={entry.notification}
                    onMarkRead={onMarkRead}
                  />
                );
              }
              return (
                <NotificationGroup
                  key={entry.groupKey}
                  notifications={entry.notifications}
                  onMarkRead={onMarkRead}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
