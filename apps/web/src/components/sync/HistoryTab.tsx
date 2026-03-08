'use client';

/**
 * HistoryTab — Displays sync history table for the Sync Settings Dashboard.
 *
 * Shows daily sync run summaries with success/partial/failed counts.
 *
 * @see docs/reference/sync-engine.md § Sync Connection Status Model
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { SyncHistoryEntry } from '@/data/sync-dashboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HistoryTabProps {
  baseConnectionId: string;
  history: SyncHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Duration formatter
// ---------------------------------------------------------------------------

function formatDuration(ms: number | null, t: ReturnType<typeof useTranslations>): string {
  if (ms === null) return t('history_no_data');
  if (ms < 1000) return t('history_ms', { value: ms });
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return t('history_seconds', { value: seconds });
  const minutes = Math.round(seconds / 60);
  return t('history_minutes', { value: minutes });
}

// ---------------------------------------------------------------------------
// HistoryRow (inline)
// ---------------------------------------------------------------------------

interface HistoryRowProps {
  entry: SyncHistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

function HistoryRow({ entry, isExpanded, onToggle }: HistoryRowProps) {
  const t = useTranslations('sync_dashboard');

  const total = entry.successCount + entry.partialCount + entry.failedCount;
  const hasFailures = entry.failedCount > 0;
  const hasPartial = entry.partialCount > 0;

  return (
    <div data-testid={`history-row-${entry.date}`}>
      {/* Main row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted"
        data-testid={`history-toggle-${entry.date}`}
      >
        {/* Expand/collapse icon */}
        <div className="shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>

        {/* Date */}
        <div className="min-w-[100px]">
          <span className="text-[14px] font-medium text-foreground">
            {entry.date}
          </span>
        </div>

        {/* Success count */}
        <div className="flex min-w-[80px] items-center gap-1">
          <Badge variant="success" className="text-[11px]">
            {entry.successCount}
          </Badge>
          <span className="text-[12px] text-muted-foreground">
            {t('history_success')}
          </span>
        </div>

        {/* Partial count */}
        <div className="flex min-w-[80px] items-center gap-1">
          {hasPartial ? (
            <Badge variant="warning" className="text-[11px]">
              {entry.partialCount}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px]">
              {entry.partialCount}
            </Badge>
          )}
          <span className="text-[12px] text-muted-foreground">
            {t('history_partial')}
          </span>
        </div>

        {/* Failed count */}
        <div className="flex min-w-[80px] items-center gap-1">
          {hasFailures ? (
            <Badge variant="error" className="text-[11px]">
              {entry.failedCount}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px]">
              {entry.failedCount}
            </Badge>
          )}
          <span className="text-[12px] text-muted-foreground">
            {t('history_failed')}
          </span>
        </div>

        {/* Records synced */}
        <div className="min-w-[80px] text-right">
          <span className="text-[13px] text-muted-foreground">
            {entry.totalRecordsSynced.toLocaleString()} {t('history_records')}
          </span>
        </div>

        {/* Avg duration */}
        <div className="min-w-[80px] text-right">
          <span className="text-[13px] text-muted-foreground">
            {formatDuration(entry.averageDurationMs, t)}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div
          className="ml-8 mt-1 rounded-lg border bg-muted p-4"
          data-testid={`history-detail-${entry.date}`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <span className="text-[12px] text-muted-foreground">
                {t('history_total_runs')}
              </span>
              <p className="text-[14px] font-medium text-foreground">{total}</p>
            </div>
            <div>
              <span className="text-[12px] text-muted-foreground">
                {t('history_records_synced')}
              </span>
              <p className="text-[14px] font-medium text-foreground">
                {entry.totalRecordsSynced.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-[12px] text-muted-foreground">
                {t('history_avg_duration')}
              </span>
              <p className="text-[14px] font-medium text-foreground">
                {formatDuration(entry.averageDurationMs, t)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistoryTab
// ---------------------------------------------------------------------------

export function HistoryTab({ history }: HistoryTabProps) {
  const t = useTranslations('sync_dashboard');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  // Empty state
  if (history.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12"
        data-testid="history-tab-empty"
      >
        <p className="text-[14px] text-muted-foreground">
          {t('history_empty')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="history-tab">
      {/* Column headers */}
      <div className="flex items-center gap-4 px-4 text-[12px] font-medium text-muted-foreground">
        <div className="w-4 shrink-0" />
        <div className="min-w-[100px]">{t('history_col_date')}</div>
        <div className="min-w-[80px]">{t('history_col_success')}</div>
        <div className="min-w-[80px]">{t('history_col_partial')}</div>
        <div className="min-w-[80px]">{t('history_col_failed')}</div>
        <div className="min-w-[80px] text-right">{t('history_col_records')}</div>
        <div className="min-w-[80px] text-right">{t('history_col_duration')}</div>
      </div>

      {/* History rows */}
      <div className="flex flex-col gap-1">
        {history.map((entry) => (
          <HistoryRow
            key={entry.date}
            entry={entry}
            isExpanded={expandedDates.has(entry.date)}
            onToggle={() => toggleDate(entry.date)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function HistoryTabSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[56px] w-full rounded-lg" />
      ))}
    </div>
  );
}
