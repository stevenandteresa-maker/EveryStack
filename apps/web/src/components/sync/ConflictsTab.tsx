'use client';

/**
 * ConflictsTab — Displays pending sync conflicts for a connection
 * with resolution actions for the Sync Settings Dashboard.
 *
 * @see docs/reference/sync-engine.md § Conflict Resolution UX
 */

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// ConflictForDashboard type
// ---------------------------------------------------------------------------

export interface ConflictForDashboard {
  id: string;
  recordId: string;
  fieldId: string;
  recordName: string | null;
  fieldName: string | null;
  localValue: unknown;
  remoteValue: unknown;
  platform: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConflictsTabProps {
  baseConnectionId: string;
  conflicts: ConflictForDashboard[];
  platform: string;
  onMutate?: () => void;
}

// ---------------------------------------------------------------------------
// Value truncation helper
// ---------------------------------------------------------------------------

function truncateValue(value: unknown, maxLength: number = 60): string {
  if (value === null || value === undefined) return '—';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '…';
}

// ---------------------------------------------------------------------------
// ConflictRow (inline)
// ---------------------------------------------------------------------------

interface ConflictRowProps {
  conflict: ConflictForDashboard;
  platform: string;
  isPending: boolean;
  onResolve: (conflictId: string) => void;
}

function ConflictRow({ conflict, platform, isPending, onResolve }: ConflictRowProps) {
  const t = useTranslations('sync_dashboard');

  return (
    <Card data-testid={`conflict-row-${conflict.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Record & field name */}
            <p className="truncate text-[14px] font-medium text-foreground">
              {conflict.recordName ?? t('conflicts_unknown_record')}
              {conflict.fieldName && (
                <span className="ml-1 text-muted-foreground">
                  — {conflict.fieldName}
                </span>
              )}
            </p>

            {/* Values comparison */}
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 text-[11px]">
                  {t('conflicts_local')}
                </Badge>
                <span className="truncate text-[13px] text-muted-foreground">
                  {truncateValue(conflict.localValue)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 text-[11px] capitalize">
                  {platform}
                </Badge>
                <span className="truncate text-[13px] text-muted-foreground">
                  {truncateValue(conflict.remoteValue)}
                </span>
              </div>
            </div>

            {/* Timestamp */}
            <span className="mt-2 block text-[11px] text-muted-foreground">
              {conflict.createdAt}
            </span>
          </div>

          {/* Resolve button */}
          <div className="flex shrink-0 items-center">
            <Button
              variant="default"
              size="sm"
              onClick={() => onResolve(conflict.id)}
              disabled={isPending}
              data-testid={`resolve-conflict-${conflict.id}`}
            >
              <GitCompareArrows className="mr-1 h-3.5 w-3.5" />
              {t('conflicts_resolve')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ConflictsTab
// ---------------------------------------------------------------------------

export function ConflictsTab({
  conflicts,
  platform,
  onMutate,
}: ConflictsTabProps) {
  const t = useTranslations('sync_dashboard');
  const [isPending, startTransition] = useTransition();

  const handleResolve = (_conflictId: string) => {
    // Resolution happens through the ConflictResolutionModal
    // For now, trigger onMutate to refresh
    onMutate?.();
  };

  const handleBulkKeepLocal = () => {
    startTransition(async () => {
      // TODO: call bulk resolve action — keep EveryStack values
      onMutate?.();
    });
  };

  const handleBulkKeepRemote = () => {
    startTransition(async () => {
      // TODO: call bulk resolve action — keep remote values
      onMutate?.();
    });
  };

  // Empty state
  if (conflicts.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12"
        data-testid="conflicts-tab-empty"
      >
        <p className="text-[14px] text-muted-foreground">
          {t('conflicts_empty')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="conflicts-tab">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-foreground">
          {t('conflicts_count', { count: conflicts.length })}
        </p>
      </div>

      {/* Conflict list */}
      <div className="flex flex-col gap-2">
        {conflicts.map((conflict) => (
          <ConflictRow
            key={conflict.id}
            conflict={conflict}
            platform={platform}
            isPending={isPending}
            onResolve={handleResolve}
          />
        ))}
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-2 border-t pt-4">
        <Button
          variant="default"
          size="sm"
          onClick={handleBulkKeepLocal}
          disabled={isPending}
          data-testid="bulk-keep-local"
        >
          {t('conflicts_resolve_all_local')}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleBulkKeepRemote}
          disabled={isPending}
          data-testid="bulk-keep-remote"
        >
          {t('conflicts_resolve_all_remote')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function ConflictsTabSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
      ))}
    </div>
  );
}
