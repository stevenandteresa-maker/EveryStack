'use client';

/**
 * NotificationItem — single notification row in the notification tray.
 *
 * Displays type icon, title, body preview, relative timestamp, and read state.
 * Click marks as read and navigates to source.
 *
 * @see docs/reference/communications.md § Notification Types
 */

import {
  AtSign,
  MessageSquare,
  Reply,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Notification } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Type → icon mapping
// ---------------------------------------------------------------------------

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  mention: AtSign,
  dm: MessageSquare,
  thread_reply: Reply,
  approval_requested: CheckCircle,
  approval_decided: CheckCircle,
  automation_failed: AlertTriangle,
  sync_error: RefreshCw,
  system: Info,
};

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
  return `${diffDays}d`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => Promise<void>;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const Icon = TYPE_ICON_MAP[notification.type] ?? Info;
  const isUnread = !notification.read;

  function getNavigationUrl(): string | null {
    if (notification.sourceThreadId && notification.sourceRecordId) {
      return `/records/${notification.sourceRecordId}?thread=${notification.sourceThreadId}`;
    }
    if (notification.sourceThreadId) {
      return `/threads/${notification.sourceThreadId}`;
    }
    if (notification.sourceRecordId) {
      return `/records/${notification.sourceRecordId}`;
    }
    return null;
  }

  async function handleClick() {
    if (isUnread) {
      await onMarkRead(notification.id);
    }
    const url = getNavigationUrl();
    if (url) {
      router.push(url);
    }
  }

  return (
    <button
      type="button"
      data-testid="notification-item"
      className={cn(
        'w-full text-left px-4 py-3 flex items-start gap-3',
        'hover:bg-[var(--muted)] transition-colors',
        isUnread && 'border-l-2 border-l-[#0D9488]',
        !isUnread && 'border-l-2 border-l-transparent',
      )}
      onClick={handleClick}
      aria-label={t('openNotification', { title: notification.title })}
    >
      <div className="shrink-0 mt-0.5">
        <Icon
          size={16}
          className={cn(
            isUnread ? 'text-[#0D9488]' : 'text-[var(--text-tertiary)]',
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-body-sm truncate',
            isUnread ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--text-secondary)]',
          )}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-caption text-[var(--text-tertiary)] truncate mt-0.5">
            {notification.body}
          </p>
        )}
      </div>

      <span className="shrink-0 text-timestamp text-[var(--text-tertiary)]">
        {formatTimeAgo(notification.createdAt)}
      </span>
    </button>
  );
}
