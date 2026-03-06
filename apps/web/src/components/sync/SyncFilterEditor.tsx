'use client';

/**
 * SyncFilterEditor — Post-setup panel for editing sync filters per table.
 *
 * Embeds SyncFilterBuilder (mode="es"), shows current/estimated counts,
 * quota status, and Save & Re-sync / Cancel actions.
 *
 * @see docs/reference/sync-engine.md § Sync Filters
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SyncFilterBuilder } from './SyncFilterBuilder';
import type { FilterField } from './SyncFilterBuilder';
import { updateSyncFilter } from '@/actions/sync-filters';
import { estimateFilteredRecordCount } from '@/actions/sync-filters';
import type { FilterRule } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncFilterEditorProps {
  connectionId: string;
  tableId: string;
  tableName: string;
  currentFilter: FilterRule[] | null;
  syncedRecordCount: number;
  estimatedTotalCount: number;
  fields: FilterField[];
  baseId: string;
  onSave: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncFilterEditor({
  connectionId,
  tableId,
  tableName: _tableName,
  currentFilter,
  syncedRecordCount,
  estimatedTotalCount,
  fields,
  baseId,
  onSave,
  onCancel,
}: SyncFilterEditorProps) {
  const t = useTranslations('sync_filter_editor');

  const [editedFilters, setEditedFilters] = useState<FilterRule[]>(
    currentFilter ?? [],
  );
  const [estimatedAfterChange, setEstimatedAfterChange] = useState<
    number | null
  >(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch estimate when filters change (debounced)
  const fetchEstimate = useCallback(
    async (filters: FilterRule[]) => {
      if (filters.length === 0) {
        setEstimatedAfterChange(estimatedTotalCount);
        setQuotaExceeded(false);
        setIsEstimating(false);
        return;
      }

      setIsEstimating(true);
      try {
        const result = await estimateFilteredRecordCount({
          connectionId,
          baseId,
          tableId,
          filters,
        });
        setEstimatedAfterChange(result.count);
        setQuotaRemaining(result.quotaRemaining);
        setQuotaExceeded(!result.quotaAllowed);
      } catch {
        // Keep previous estimate on error
      } finally {
        setIsEstimating(false);
      }
    },
    [connectionId, baseId, tableId, estimatedTotalCount],
  );

  const handleFilterChange = useCallback(
    (filters: FilterRule[]) => {
      setEditedFilters(filters);
      setSaveError(null);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchEstimate(filters);
      }, 500);
    },
    [fetchEstimate],
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await updateSyncFilter({
        connectionId,
        tableId,
        newFilter: editedFilters,
      });
      onSave();
    } catch {
      setSaveError(t('save_error'));
    } finally {
      setIsSaving(false);
    }
  }, [connectionId, tableId, editedFilters, onSave, t]);

  const isSaveDisabled = isSaving || isEstimating || quotaExceeded;

  return (
    <div className="space-y-4" data-testid="sync-filter-editor">
      {/* Current sync status */}
      <p className="text-sm text-muted-foreground" data-testid="current-sync-status">
        {t('currently_syncing', {
          synced: syncedRecordCount,
          total: estimatedTotalCount,
        })}
      </p>

      {/* Filter builder */}
      <SyncFilterBuilder
        fields={fields}
        filters={editedFilters}
        onChange={handleFilterChange}
        mode="es"
      />

      {/* No filter message */}
      {editedFilters.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('no_filter')}</p>
      )}

      {/* Estimated count after change */}
      {isEstimating && (
        <p className="text-sm text-muted-foreground" data-testid="estimating-status">
          {t('estimating')}
        </p>
      )}
      {!isEstimating && estimatedAfterChange !== null && (
        <p className="text-sm" data-testid="estimated-count">
          {estimatedAfterChange === syncedRecordCount
            ? t('estimated_no_change', { count: estimatedAfterChange })
            : t('estimated_after_change', { count: estimatedAfterChange })}
        </p>
      )}

      {/* Quota info */}
      {quotaRemaining !== null && !quotaExceeded && (
        <p className="text-sm text-muted-foreground" data-testid="quota-remaining">
          {t('quota_remaining', { remaining: quotaRemaining })}
        </p>
      )}
      {quotaExceeded && estimatedAfterChange !== null && quotaRemaining !== null && (
        <p className="text-sm text-destructive" data-testid="quota-exceeded">
          {t('quota_exceeded', {
            overage: estimatedAfterChange - quotaRemaining,
          })}
        </p>
      )}

      {/* Save error */}
      {saveError && (
        <p className="text-sm text-destructive" data-testid="save-error">
          {saveError}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaveDisabled}
          data-testid="save-button"
        >
          {isSaving ? t('estimating') : t('save_and_resync')}
        </Button>
        <Button
          variant="default"
          onClick={onCancel}
          data-testid="cancel-button"
        >
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
