'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { FileText, Table2, Layout, Clock } from 'lucide-react';
import {
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { filterRecentItemsByQuery } from './recent-items';
import type { SearchResult, NavigationResult, RecentItem } from '@/lib/command-bar/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandBarSearchResultsProps {
  query: string;
  scopedTableId?: string;
  workspaceId: string;
  tenantId: string;
  userId: string;
  onSelect?: () => void;
  onTrackItem?: (itemType: string, itemId: string, displayName: string, entityContext?: string) => void;
  searchRecordsFn: (
    tenantId: string,
    workspaceId: string,
    query: string,
    opts?: { tableId?: string; userId?: string },
  ) => Promise<SearchResult[]>;
  searchTablesAndViewsFn: (
    tenantId: string,
    workspaceId: string,
    query: string,
    userId: string,
  ) => Promise<NavigationResult[]>;
  getRecentItemsFn?: (
    userId: string,
    tenantId: string,
    limit?: number,
  ) => Promise<RecentItem[]>;
}

const DEBOUNCE_MS = 200;

// ---------------------------------------------------------------------------
// Icon mapping for recent items
// ---------------------------------------------------------------------------

const RECENT_TYPE_ICONS: Record<string, typeof FileText> = {
  record: FileText,
  table: Table2,
  view: Layout,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandBarSearchResults({
  query,
  scopedTableId,
  workspaceId,
  tenantId,
  userId,
  onSelect,
  onTrackItem,
  searchRecordsFn,
  searchTablesAndViewsFn,
  getRecentItemsFn,
}: CommandBarSearchResultsProps) {
  const t = useTranslations('commandBar');
  const router = useRouter();

  const [records, setRecords] = useState<SearchResult[]>([]);
  const [navResults, setNavResults] = useState<NavigationResult[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0);

  // Fetch recent items once for boosting
  useEffect(() => {
    if (!getRecentItemsFn || !userId || !tenantId) return;

    let cancelled = false;
    getRecentItemsFn(userId, tenantId, 20)
      .then((items) => {
        if (!cancelled) setRecentItems(items);
      })
      .catch(() => {
        // Non-blocking
      });

    return () => {
      cancelled = true;
    };
  }, [getRecentItemsFn, userId, tenantId]);

  // Debounced search — all setState calls happen inside the async callback
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    const requestId = ++abortRef.current;

    debounceRef.current = setTimeout(async () => {
      if (!trimmed) {
        if (abortRef.current === requestId) {
          setRecords([]);
          setNavResults([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const [recordResults, navigationResults] = await Promise.all([
          searchRecordsFn(tenantId, workspaceId, trimmed, {
            tableId: scopedTableId,
            userId,
          }),
          searchTablesAndViewsFn(tenantId, workspaceId, trimmed, userId),
        ]);

        if (abortRef.current === requestId) {
          setRecords(recordResults);
          setNavResults(navigationResults);
          setIsLoading(false);
        }
      } catch {
        if (abortRef.current === requestId) {
          setRecords([]);
          setNavResults([]);
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, tenantId, workspaceId, scopedTableId, userId, searchRecordsFn, searchTablesAndViewsFn]);

  // Boosted recent items — filter recents that match the query
  const boostedRecents = useMemo(
    () => filterRecentItemsByQuery(recentItems, query),
    [recentItems, query],
  );

  // Group navigation results
  const tables = useMemo(
    () => navResults.filter((r) => r.entity_type === 'table'),
    [navResults],
  );
  const views = useMemo(
    () => navResults.filter((r) => r.entity_type === 'view'),
    [navResults],
  );

  const hasResults = records.length > 0 || navResults.length > 0 || boostedRecents.length > 0;

  // Handlers with tracking
  const handleRecordSelect = (result: SearchResult) => {
    router.push(
      `/workspace/${workspaceId}/table/${result.table_id}/record/${result.record_id}`,
    );
    onTrackItem?.('record', result.record_id, result.primary_field_value, result.table_name);
    onSelect?.();
  };

  const handleTableSelect = (result: NavigationResult) => {
    router.push(`/workspace/${workspaceId}/table/${result.entity_id}`);
    onTrackItem?.('table', result.entity_id, result.name);
    onSelect?.();
  };

  const handleViewSelect = (result: NavigationResult) => {
    router.push(`/workspace/${workspaceId}/view/${result.entity_id}`);
    onTrackItem?.('view', result.entity_id, result.name, result.parent_name);
    onSelect?.();
  };

  const handleRecentSelect = (item: RecentItem) => {
    switch (item.item_type) {
      case 'record':
        router.push(`/workspace/${workspaceId}/record/${item.item_id}`);
        break;
      case 'table':
        router.push(`/workspace/${workspaceId}/table/${item.item_id}`);
        break;
      case 'view':
        router.push(`/workspace/${workspaceId}/view/${item.item_id}`);
        break;
      default:
        break;
    }
    onTrackItem?.(item.item_type, item.item_id, item.display_name, item.entity_context);
    onSelect?.();
  };

  if (!query.trim()) {
    return null;
  }

  if (!isLoading && !hasResults) {
    return (
      <CommandEmpty data-testid="search-no-results">
        {t('searchNoResults')}
      </CommandEmpty>
    );
  }

  return (
    <>
      {/* Boosted recent items — shown above search results */}
      {boostedRecents.length > 0 && (
        <CommandGroup
          heading={t('recentHeading')}
          data-testid="search-boosted-recents"
        >
          {boostedRecents.map((item) => {
            const Icon = RECENT_TYPE_ICONS[item.item_type] ?? Clock;
            return (
              <CommandItem
                key={`boosted-${item.item_type}-${item.item_id}`}
                value={`boosted-${item.item_type}-${item.item_id}`}
                onSelect={() => handleRecentSelect(item)}
                data-testid={`boosted-recent-${item.item_type}-${item.item_id}`}
              >
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{item.display_name}</span>
                {item.entity_context && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.entity_context}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}

      {boostedRecents.length > 0 && (records.length > 0 || navResults.length > 0) && (
        <CommandSeparator />
      )}

      {records.length > 0 && (
        <CommandGroup
          heading={t('searchRecordsHeading')}
          data-testid="search-records-group"
        >
          {records.map((result) => (
            <CommandItem
              key={result.record_id}
              value={`record-${result.record_id}`}
              onSelect={() => handleRecordSelect(result)}
              data-testid={`search-record-${result.record_id}`}
            >
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">
                {result.primary_field_value}
              </span>
              <Badge variant="outline" className="ml-2 text-xs">
                {result.table_name}
              </Badge>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {records.length > 0 && (tables.length > 0 || views.length > 0) && (
        <CommandSeparator />
      )}

      {tables.length > 0 && (
        <CommandGroup
          heading={t('searchTablesHeading')}
          data-testid="search-tables-group"
        >
          {tables.map((result) => (
            <CommandItem
              key={result.entity_id}
              value={`table-${result.entity_id}`}
              onSelect={() => handleTableSelect(result)}
              data-testid={`search-table-${result.entity_id}`}
            >
              <Table2 className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="truncate">{result.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {views.length > 0 && (
        <CommandGroup
          heading={t('searchViewsHeading')}
          data-testid="search-views-group"
        >
          {views.map((result) => (
            <CommandItem
              key={result.entity_id}
              value={`view-${result.entity_id}`}
              onSelect={() => handleViewSelect(result)}
              data-testid={`search-view-${result.entity_id}`}
            >
              <Layout className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{result.name}</span>
              {result.parent_name && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {result.parent_name}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  );
}
