'use client';

/**
 * TablesFiltersTab — Shows synced tables with enable/disable toggles
 * and filter summaries for the Sync Settings Dashboard.
 *
 * @see docs/reference/sync-engine.md § Table Selection & Filters
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SyncConfig } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TablesFiltersTabProps {
  baseConnectionId: string;
  syncConfig: SyncConfig | null;
  onMutate?: () => void;
}

// ---------------------------------------------------------------------------
// TableRow (inline)
// ---------------------------------------------------------------------------

interface TableRowProps {
  table: {
    external_table_id: string;
    external_table_name: string;
    enabled: boolean;
    sync_filter: unknown[] | null;
    estimated_record_count: number;
    synced_record_count: number;
  };
  isChanged: boolean;
  onToggle: (tableId: string) => void;
}

function TableRow({ table, isChanged, onToggle }: TableRowProps) {
  const t = useTranslations('sync_dashboard');

  const filterCount = Array.isArray(table.sync_filter) ? table.sync_filter.length : 0;

  return (
    <Card data-testid={`table-row-${table.external_table_id}`}>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-foreground">
            {table.external_table_name}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-[13px] text-muted-foreground">
              {t('tables_record_count', {
                synced: table.synced_record_count,
                estimated: table.estimated_record_count,
              })}
            </span>
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <Filter className="h-3 w-3" />
              {filterCount > 0
                ? t('tables_filters_applied', { count: filterCount })
                : t('tables_no_filters')}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Edit Filters placeholder */}
          <Button
            variant="default"
            size="sm"
            disabled
            data-testid={`edit-filters-${table.external_table_id}`}
          >
            {t('tables_edit_filters')}
          </Button>

          {/* Enable/Disable toggle */}
          <Button
            variant="default"
            size="sm"
            onClick={() => onToggle(table.external_table_id)}
            className={isChanged ? 'border-amber-500' : ''}
            data-testid={`toggle-table-${table.external_table_id}`}
          >
            {table.enabled ? t('tables_enabled') : t('tables_disabled')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TablesFiltersTab
// ---------------------------------------------------------------------------

export function TablesFiltersTab({
  syncConfig,
  onMutate,
}: TablesFiltersTabProps) {
  const t = useTranslations('sync_dashboard');
  const [isPending, startTransition] = useTransition();
  const [toggledTables, setToggledTables] = useState<Set<string>>(new Set());

  const tables = syncConfig?.tables ?? [];

  const handleToggle = (tableId: string) => {
    setToggledTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const handleSaveResync = () => {
    startTransition(async () => {
      // TODO: call server action to update table config and trigger re-sync
      onMutate?.();
      setToggledTables(new Set());
    });
  };

  // Empty state
  if (!syncConfig || tables.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12"
        data-testid="tables-filters-tab-empty"
      >
        <p className="text-[14px] text-muted-foreground">
          {t('tables_empty')}
        </p>
      </div>
    );
  }

  const hasChanges = toggledTables.size > 0;

  return (
    <div className="flex flex-col gap-4" data-testid="tables-filters-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-foreground">
          {t('tables_count', { count: tables.length })}
        </p>
      </div>

      {/* Table list */}
      <div className="flex flex-col gap-2">
        {tables.map((table) => (
          <TableRow
            key={table.external_table_id}
            table={table}
            isChanged={toggledTables.has(table.external_table_id)}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {/* Save & Re-sync */}
      <div className="flex items-center gap-2 border-t pt-4">
        <Button
          variant="default"
          size="sm"
          onClick={handleSaveResync}
          disabled={!hasChanges || isPending}
          data-testid="save-resync-tables"
        >
          {t('tables_save_resync')}
        </Button>
        {hasChanges && (
          <span className="text-[12px] text-muted-foreground">
            {t('tables_unsaved_changes', { count: toggledTables.size })}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function TablesFiltersTabSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
      ))}
    </div>
  );
}
