'use client';

/**
 * LinkPickerSearchResults — renders search/recent results in the Link Picker.
 *
 * Displays results with card_fields preview, permission-aware field filtering,
 * and scroll-to-load pagination.
 *
 * @see docs/reference/cross-linking.md § Link Picker UX
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { CommandItem } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import type { DbRecord, Field } from '@everystack/shared/db';
import type { SearchResult } from '@/data/cross-links';
import type { LinkPickerMode } from './link-picker-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkPickerSearchResultsProps {
  results: SearchResult[];
  cardFields: Field[];
  permittedFieldIds: string[];
  selectedIds: Set<string>;
  mode: LinkPickerMode;
  onSelect: (recordId: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkPickerSearchResults({
  results,
  cardFields,
  permittedFieldIds,
  selectedIds,
  mode,
  onSelect,
  hasMore,
  onLoadMore,
  isLoading,
}: LinkPickerSearchResultsProps) {
  const t = useTranslations('link_picker');
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  // Permission-aware card fields: only show fields the user has permission to see
  const visibleCardFields = cardFields.filter((f) =>
    permittedFieldIds.includes(f.id),
  );

  // Scroll-to-load: trigger onLoadMore when near bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMoreRef.current || !hasMore) return;
    const threshold = 100;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      loadingMoreRef.current = true;
      onLoadMore();
    }
  }, [hasMore, onLoadMore]);

  // Reset loading-more flag when results change
  useEffect(() => {
    loadingMoreRef.current = false;
  }, [results.length]);

  if (results.length === 0 && !isLoading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        {t('no_results')}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="max-h-[300px] overflow-y-auto"
    >
      {results.map((result) => (
        <SearchResultItem
          key={result.record.id}
          result={result}
          cardFields={visibleCardFields}
          isSelected={selectedIds.has(result.record.id)}
          mode={mode}
          onSelect={onSelect}
        />
      ))}
      {isLoading && (
        <div className="px-4 py-2 text-center text-xs text-muted-foreground">
          {t('loading')}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SearchResultItem
// ---------------------------------------------------------------------------

interface SearchResultItemProps {
  result: SearchResult;
  cardFields: Field[];
  isSelected: boolean;
  mode: LinkPickerMode;
  onSelect: (recordId: string) => void;
}

function SearchResultItem({
  result,
  cardFields,
  isSelected,
  mode,
  onSelect,
}: SearchResultItemProps) {
  const handleSelect = useCallback(() => {
    onSelect(result.record.id);
  }, [onSelect, result.record.id]);

  return (
    <CommandItem
      value={result.record.id}
      onSelect={handleSelect}
      className="flex items-start gap-3 px-3 py-2"
    >
      {mode === 'multi' && (
        <Checkbox
          checked={isSelected}
          className="mt-0.5 shrink-0"
          aria-hidden
          tabIndex={-1}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {result.displayValue || result.record.id}
        </div>
        {cardFields.length > 0 && (
          <CardFieldsPreview
            record={result.record}
            cardFields={cardFields}
          />
        )}
      </div>
      {mode === 'single' && isSelected && (
        <Check className="h-4 w-4 shrink-0 text-primary" />
      )}
    </CommandItem>
  );
}

// ---------------------------------------------------------------------------
// CardFieldsPreview — renders card_fields for a search result
// ---------------------------------------------------------------------------

interface CardFieldsPreviewProps {
  record: DbRecord;
  cardFields: Field[];
}

function CardFieldsPreview({ record, cardFields }: CardFieldsPreviewProps) {
  return (
    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
      {cardFields.map((field) => {
        const value = record.canonicalData[field.id];
        if (value === undefined || value === null || value === '') return null;

        return (
          <span
            key={field.id}
            className="truncate text-xs text-muted-foreground"
          >
            <span className="font-medium">{field.name}:</span>{' '}
            {formatFieldValue(value)}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Simple formatter for display field values in card previews.
 */
function formatFieldValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}
