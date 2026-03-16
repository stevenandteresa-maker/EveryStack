'use client';

/**
 * NotificationBell — bell icon with real-time unread badge.
 *
 * Click opens the NotificationTray dropdown. Badge hidden when count is 0.
 *
 * @see docs/reference/communications.md § Bell Icon Delivery
 */

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { UseNotificationsResult } from './use-notifications';
import { NotificationTray } from './NotificationTray';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationBellProps {
  hook: UseNotificationsResult;
}

export function NotificationBell({ hook }: NotificationBellProps) {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    markRead,
    markAllRead,
    loadMore,
  } = hook;

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="notification-bell"
        className={cn(
          'relative flex items-center justify-center w-8 h-8 rounded-full',
          'hover:bg-white/20 transition-colors',
          open && 'bg-white/20',
        )}
        onClick={() => setOpen(!open)}
        aria-label={t('bellLabel', { count: unreadCount })}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={18} className="text-white" />

        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className={cn(
              'absolute -top-0.5 -right-0.5',
              'flex items-center justify-center',
              'min-w-[18px] h-[18px] px-1',
              'rounded-full bg-red-600 text-white',
              'text-[10px] font-semibold leading-none',
            )}
          >
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50">
          <NotificationTray
            notifications={notifications}
            isLoading={isLoading}
            hasMore={hasMore}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onLoadMore={loadMore}
          />
        </div>
      )}
    </div>
  );
}
