'use client';

/**
 * LinkPicker — Dialog + Command (cmdk) search for linking records.
 *
 * Layout: search input at top, recent section (when no active search),
 * search results below. Supports single-link and multi-link modes.
 *
 * @see docs/reference/cross-linking.md § Link Picker UX
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLinkPicker } from './use-link-picker';
import { LinkPickerSearchResults } from './link-picker-search-results';
import {
  searchLinkableRecords,
  getRecentLinkedRecords,
  getCrossLinkDefinition,
} from '@/data/cross-links';
import { resolveLinkedRecordPermissions } from '@/data/cross-link-resolution';
import { getFieldsByTable } from '@/data/fields';
import type { DbRecord, Field, CrossLink } from '@everystack/shared/db';
import type { SearchResult } from '@/data/cross-links';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkPickerProps {
  tenantId: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkPicker({ tenantId, userId }: LinkPickerProps) {
  const t = useTranslations('link_picker');
  const picker = useLinkPicker();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentRecords, setRecentRecords] = useState<DbRecord[]>([]);
  const [definition, setDefinition] = useState<CrossLink | null>(null);
  const [cardFields, setCardFields] = useState<Field[]>([]);
  const [permittedFieldIds, setPermittedFieldIds] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const [isSearching, startSearch] = useTransition();

  const PAGE_SIZE = 100;

  // Load definition, recent records, card fields, and permissions when picker opens
  useEffect(() => {
    if (!picker.isOpen || !picker.crossLinkId) return;

    const crossLinkId = picker.crossLinkId;

    const loadInitialData = async () => {
      const def = await getCrossLinkDefinition(tenantId, crossLinkId);
      if (!def) return;
      setDefinition(def);

      // Load recent records and card fields in parallel
      const [recent, targetFields, permitted] = await Promise.all([
        getRecentLinkedRecords(tenantId, crossLinkId, userId),
        getFieldsByTable(tenantId, def.targetTableId),
        resolveLinkedRecordPermissions(tenantId, userId, def, def.targetTableId),
      ]);

      setRecentRecords(recent);

      // Filter target fields to only card_fields
      const cardFieldIds = def.cardFields as string[];
      if (cardFieldIds.length > 0) {
        setCardFields(targetFields.filter((f) => cardFieldIds.includes(f.id)));
      } else {
        setCardFields(targetFields);
      }

      setPermittedFieldIds(permitted);
    };

    loadInitialData();
  }, [picker.isOpen, picker.crossLinkId, tenantId, userId]);

  // Search handler — called when query changes or on initial load
  const performSearch = useCallback(
    (searchQuery: string, searchOffset: number, append: boolean) => {
      if (!picker.crossLinkId) return;
      const crossLinkId = picker.crossLinkId;

      startSearch(async () => {
        const searchResults = await searchLinkableRecords(
          tenantId,
          crossLinkId,
          searchQuery,
          { limit: PAGE_SIZE, offset: searchOffset },
        );
        if (append) {
          setResults((prev) => [...prev, ...searchResults]);
        } else {
          setResults(searchResults);
        }
        setHasMore(searchResults.length === PAGE_SIZE);
      });
    },
    [picker.crossLinkId, tenantId],
  );

  // Re-search when query changes
  useEffect(() => {
    if (!picker.isOpen || !picker.crossLinkId) return;
    offsetRef.current = 0;
    performSearch(query, 0, false);
  }, [query, picker.isOpen, picker.crossLinkId, performSearch]);

  // Load more for scroll-to-load pagination
  const handleLoadMore = useCallback(() => {
    const nextOffset = offsetRef.current + PAGE_SIZE;
    offsetRef.current = nextOffset;
    performSearch(query, nextOffset, true);
  }, [query, performSearch]);

  // Handle dialog close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        picker.close();
        setQuery('');
        setResults([]);
        setRecentRecords([]);
        offsetRef.current = 0;
        setDefinition(null);
      }
    },
    [picker],
  );

  // Build recent section as SearchResult[] for consistent rendering
  const recentAsResults: SearchResult[] = useMemo(() => {
    if (!definition) return [];
    return recentRecords.map((record) => ({
      record,
      displayValue: String(
        record.canonicalData[definition.targetDisplayFieldId] ?? '',
      ),
    }));
  }, [recentRecords, definition]);

  // Selected record labels for multi-mode pills
  const selectedLabels = useMemo(() => {
    if (picker.mode !== 'multi' || picker.selectedIds.size === 0) return [];
    const labels: Array<{ id: string; label: string }> = [];
    const allItems = [...recentAsResults, ...results];
    for (const id of picker.selectedIds) {
      const item = allItems.find((r) => r.record.id === id);
      labels.push({
        id,
        label: item?.displayValue || id.slice(0, 8),
      });
    }
    return labels;
  }, [picker.selectedIds, picker.mode, recentAsResults, results]);

  const showRecent = query.trim().length === 0 && recentAsResults.length > 0;

  return (
    <Dialog open={picker.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="text-base font-semibold">
            {definition?.name ?? t('title')}
          </DialogTitle>
        </DialogHeader>

        <Command shouldFilter={false} className="rounded-none border-0">
          <CommandInput
            placeholder={t('search_placeholder')}
            value={query}
            onValueChange={setQuery}
          />

          {/* Selected pills in multi mode */}
          {picker.mode === 'multi' && selectedLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 py-2">
              {selectedLabels.map((item) => (
                <Badge
                  key={item.id}
                  variant="outline"
                  className="gap-1 pr-1 text-xs"
                >
                  <span className="max-w-[120px] truncate">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => picker.toggleSelected(item.id)}
                    className="rounded-sm hover:bg-muted"
                    aria-label={t('remove_selected', { name: item.label })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <CommandList className="max-h-none">
            {/* Recent section — only when no active search */}
            {showRecent && (
              <>
                <CommandGroup heading={t('recent')}>
                  <LinkPickerSearchResults
                    results={recentAsResults}
                    cardFields={cardFields}
                    permittedFieldIds={permittedFieldIds}
                    selectedIds={picker.selectedIds}
                    mode={picker.mode}
                    onSelect={picker.select}
                    hasMore={false}
                    onLoadMore={() => {}}
                    isLoading={false}
                  />
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Search results */}
            <CommandGroup heading={showRecent ? t('all_records') : undefined}>
              {!isSearching && results.length === 0 && query.trim().length > 0 && (
                <CommandEmpty>{t('no_results')}</CommandEmpty>
              )}
              <LinkPickerSearchResults
                results={results}
                cardFields={cardFields}
                permittedFieldIds={permittedFieldIds}
                selectedIds={picker.selectedIds}
                mode={picker.mode}
                onSelect={picker.select}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                isLoading={isSearching}
              />
            </CommandGroup>
          </CommandList>
        </Command>

        {/* Footer — only in multi mode */}
        {picker.mode === 'multi' && (
          <DialogFooter className="border-t px-4 py-3">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={picker.confirm}
              disabled={picker.selectedIds.size === 0 || picker.isPending}
            >
              {t('done', { count: picker.selectedIds.size })}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
