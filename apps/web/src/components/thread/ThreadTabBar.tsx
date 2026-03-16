'use client';

/**
 * ThreadTabBar — switches between "Team Notes" (internal thread) and
 * "Client Messages" (client thread, visible when Client Messaging enabled).
 *
 * Active tab has a teal underline indicator.
 *
 * @see docs/reference/communications.md § Record Thread — Two-Thread Model
 */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThreadTab = 'internal' | 'client';

interface ThreadTabBarProps {
  activeTab: ThreadTab;
  onTabChange: (tab: ThreadTab) => void;
  /** Whether Client Messaging is enabled for this record's portal */
  clientThreadEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadTabBar({
  activeTab,
  onTabChange,
  clientThreadEnabled,
}: ThreadTabBarProps) {
  const t = useTranslations('thread');

  return (
    <div
      className="flex border-b"
      role="tablist"
      aria-label={t('tabBarLabel')}
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'internal'}
        className={cn(
          'px-4 py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          activeTab === 'internal'
            ? 'text-foreground border-b-2 border-teal-500'
            : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => onTabChange('internal')}
        data-testid="thread-tab-internal"
      >
        {t('teamNotes')}
      </button>

      {clientThreadEnabled && (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'client'}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            activeTab === 'client'
              ? 'text-foreground border-b-2 border-teal-500'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onTabChange('client')}
          data-testid="thread-tab-client"
        >
          {t('clientMessages')}
        </button>
      )}
    </div>
  );
}
