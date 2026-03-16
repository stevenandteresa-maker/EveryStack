'use client';

/**
 * ThreadSearchBar — in-thread search triggered by Cmd+F.
 *
 * Renders a compact search bar at the top of the thread panel.
 * Highlights matched text and scrolls to first match.
 * Escape closes the search bar.
 *
 * @see docs/reference/communications.md § In-thread search
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { UseThreadSearchResult } from './use-thread-search';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadSearchBarProps {
  search: UseThreadSearchResult;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadSearchBar({
  search,
  isOpen,
  onClose,
}: ThreadSearchBarProps) {
  const t = useTranslations('thread');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        search.setQuery('');
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          search.prevMatch();
        } else {
          search.nextMatch();
        }
      }
    },
    [search, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30"
      data-testid="thread-search-bar"
    >
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        ref={inputRef}
        type="text"
        value={search.query}
        onChange={(e) => search.setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('searchPlaceholder')}
        className="h-7 text-sm"
        data-testid="thread-search-input"
      />

      {/* Match count */}
      {search.query && (
        <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid="thread-search-count">
          {search.totalMatches > 0
            ? t('searchCount', {
                current: search.activeMatchIndex + 1,
                total: search.totalMatches,
              })
            : t('searchNoResults')}
        </span>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={search.prevMatch}
          disabled={search.totalMatches === 0}
          aria-label={t('searchPrev')}
          data-testid="thread-search-prev"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={search.nextMatch}
          disabled={search.totalMatches === 0}
          aria-label={t('searchNext')}
          data-testid="thread-search-next"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Close */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => {
          search.setQuery('');
          onClose();
        }}
        aria-label={t('searchClose')}
        data-testid="thread-search-close"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
