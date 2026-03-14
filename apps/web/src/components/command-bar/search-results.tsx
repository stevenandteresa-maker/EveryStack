'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { FileText, Table2, Layout } from 'lucide-react';
import {
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import type { SearchResult, NavigationResult } from '@/lib/command-bar/types';

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
}

const DEBOUNCE_MS = 200;

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
  searchRecordsFn,
  searchTablesAndViewsFn,
}: CommandBarSearchResultsProps) {
  const t = useTranslations('commandBar');
  const router = useRouter();

  const [records, setRecords] = useState<SearchResult[]>([]);
  const [navResults, setNavResults] = useState<NavigationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0);

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

  // Group navigation results
  const tables = useMemo(
    () => navResults.filter((r) => r.entity_type === 'table'),
    [navResults],
  );
  const views = useMemo(
    () => navResults.filter((r) => r.entity_type === 'view'),
    [navResults],
  );

  const hasResults = records.length > 0 || navResults.length > 0;

  // Handlers
  const handleRecordSelect = (result: SearchResult) => {
    router.push(
      `/workspace/${workspaceId}/table/${result.table_id}/record/${result.record_id}`,
    );
    onSelect?.();
  };

  const handleTableSelect = (result: NavigationResult) => {
    router.push(`/workspace/${workspaceId}/table/${result.entity_id}`);
    onSelect?.();
  };

  const handleViewSelect = (result: NavigationResult) => {
    router.push(`/workspace/${workspaceId}/view/${result.entity_id}`);
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
