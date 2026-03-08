'use client';

/**
 * FailuresTab — Displays sync failures for a connection with
 * retry/skip actions per failure and bulk operations.
 *
 * Wired into the Sync Settings Dashboard (Prompt 10).
 *
 * @see docs/reference/sync-engine.md § Partial Failure Recovery
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { SyncFailureWithRecord } from '@/data/sync-failures';
import {
  retrySyncFailureAction,
  skipSyncFailureAction,
  bulkRetrySyncFailuresAction,
  bulkSkipSyncFailuresAction,
} from '@/actions/sync-failure-actions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FailuresTabProps {
  /** Base connection ID for bulk operations. */
  baseConnectionId: string;
  /** List of sync failures with record display names. */
  failures: SyncFailureWithRecord[];
  /** Called after a mutation to refresh data. */
  onMutate?: () => void;
}

// ---------------------------------------------------------------------------
// Error code → human-readable key mapping
// ---------------------------------------------------------------------------

const ERROR_CODE_I18N_MAP: Record<string, string> = {
  validation: 'error_validation',
  schema_mismatch: 'error_schema_mismatch',
  payload_too_large: 'error_payload_too_large',
  platform_rejected: 'error_platform_rejected',
  unknown: 'error_unknown',
} as const;

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

function getStatusVariant(status: string): 'default' | 'warning' | 'error' | 'success' | 'outline' {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'requires_manual_resolution':
      return 'error';
    case 'resolved':
      return 'success';
    case 'skipped':
      return 'default';
    default:
      return 'outline';
  }
}

// ---------------------------------------------------------------------------
// SyncFailureRow (inline, not exported separately per playbook target files)
// ---------------------------------------------------------------------------

interface SyncFailureRowProps {
  failure: SyncFailureWithRecord;
  onRetry: (failureId: string) => void;
  onSkip: (failureId: string) => void;
  isPending: boolean;
}

function SyncFailureRow({ failure, onRetry, onSkip, isPending }: SyncFailureRowProps) {
  const t = useTranslations('sync_failures_tab');

  const isActionable = failure.status === 'pending' || failure.status === 'requires_manual_resolution';
  const errorDescriptionKey = ERROR_CODE_I18N_MAP[failure.errorCode] ?? 'error_unknown';

  return (
    <Card data-testid={`sync-failure-row-${failure.id}`}>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          {/* Record name */}
          <p className="truncate text-[14px] font-medium text-foreground">
            {failure.recordDisplayName ?? failure.platformRecordId ?? t('unknown_record')}
          </p>

          {/* Error description */}
          <p className="mt-1 text-[13px] text-muted-foreground">
            {failure.errorMessage ?? t(errorDescriptionKey)}
          </p>

          {/* Metadata row: status badge + retry count + timestamp */}
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={getStatusVariant(failure.status)} className="text-[11px]">
              {t(`status_${failure.status}`)}
            </Badge>
            {failure.retryCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {t('retry_count', { count: failure.retryCount })}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {t('direction_label', { direction: failure.direction })}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        {isActionable && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => onRetry(failure.id)}
              disabled={isPending}
              data-testid={`retry-failure-${failure.id}`}
            >
              {t('retry')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSkip(failure.id)}
              disabled={isPending}
              data-testid={`skip-failure-${failure.id}`}
            >
              {t('skip')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FailuresTab
// ---------------------------------------------------------------------------

export function FailuresTab({ baseConnectionId, failures, onMutate }: FailuresTabProps) {
  const t = useTranslations('sync_failures_tab');
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingFailures = failures.filter(
    (f) => f.status === 'pending' || f.status === 'requires_manual_resolution',
  );
  const hasPending = pendingFailures.length > 0;

  const handleRetry = (failureId: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await retrySyncFailureAction({ failureId });
        onMutate?.();
      } catch {
        setActionError(t('retry_error'));
      }
    });
  };

  const handleSkip = (failureId: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await skipSyncFailureAction({ failureId });
        onMutate?.();
      } catch {
        setActionError(t('skip_error'));
      }
    });
  };

  const handleBulkRetry = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        await bulkRetrySyncFailuresAction({ baseConnectionId });
        onMutate?.();
      } catch {
        setActionError(t('retry_error'));
      }
    });
  };

  const handleBulkSkip = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        await bulkSkipSyncFailuresAction({ baseConnectionId });
        onMutate?.();
      } catch {
        setActionError(t('skip_error'));
      }
    });
  };

  // Empty state
  if (failures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12" data-testid="failures-tab-empty">
        <p className="text-[14px] text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="failures-tab">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-foreground">
          {t('failure_count', { count: pendingFailures.length })}
        </p>
      </div>

      {/* Error banner */}
      {actionError && (
        <p className="text-[13px] text-red-600" role="alert" data-testid="failures-action-error">
          {actionError}
        </p>
      )}

      {/* Failure list */}
      <ScrollArea className="max-h-[480px]">
        <div className="flex flex-col gap-2">
          {failures.map((failure) => (
            <SyncFailureRow
              key={failure.id}
              failure={failure}
              onRetry={handleRetry}
              onSkip={handleSkip}
              isPending={isPending}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Bulk actions */}
      {hasPending && (
        <div className="flex items-center gap-2 border-t pt-4">
          <Button
            variant="default"
            size="sm"
            onClick={handleBulkRetry}
            disabled={isPending}
            data-testid="bulk-retry-failures"
          >
            {t('retry_all')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBulkSkip}
            disabled={isPending}
            data-testid="bulk-skip-failures"
          >
            {t('skip_all')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function FailuresTabSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
      ))}
    </div>
  );
}
