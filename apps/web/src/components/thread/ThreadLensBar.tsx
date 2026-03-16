'use client';

/**
 * ThreadLensBar — filter tabs below the thread tab bar.
 *
 * Lenses: All | Notes | Activity | Files
 * Each lens applies a server-side filter to getMessages.
 *
 * @see docs/reference/communications.md § Thread Tab Lenses
 */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { LensFilter } from './use-thread';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadLensBarProps {
  activeLens: LensFilter;
  onLensChange: (lens: LensFilter) => void;
}

// ---------------------------------------------------------------------------
// Lens definitions
// ---------------------------------------------------------------------------

const LENSES: { key: LensFilter; i18nKey: string }[] = [
  { key: undefined, i18nKey: 'lensAll' },
  { key: 'notes', i18nKey: 'lensNotes' },
  { key: 'activity', i18nKey: 'lensActivity' },
  { key: 'files', i18nKey: 'lensFiles' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadLensBar({ activeLens, onLensChange }: ThreadLensBarProps) {
  const t = useTranslations('thread');

  return (
    <div
      className="flex gap-1 px-3 py-1.5 border-b bg-muted/30"
      role="tablist"
      aria-label={t('lensBarLabel')}
    >
      {LENSES.map((lens) => {
        const isActive = activeLens === lens.key;
        return (
          <button
            key={lens.i18nKey}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
            )}
            onClick={() => onLensChange(lens.key)}
            data-testid={`thread-lens-${lens.i18nKey}`}
          >
            {t(lens.i18nKey)}
          </button>
        );
      })}
    </div>
  );
}
