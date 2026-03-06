'use client';

// ---------------------------------------------------------------------------
// ConflictResolutionModal — Dialog-based modal for resolving sync conflicts
// on a single record.
//
// Single-field mode: shows one ConflictFieldRow.
// Multi-field mode: scrollable list of ConflictFieldRow components
//   + ConflictResolutionActions bulk bar.
//
// Resolution decisions are collected in local state and submitted via
// onResolve when the user clicks "Apply Resolutions".
// ---------------------------------------------------------------------------

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConflictFieldRow } from './ConflictFieldRow';
import { ConflictResolutionActions } from './ConflictResolutionActions';
import type {
  ConflictResolutionModalProps,
  ConflictResolution,
} from './conflict-types';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConflictResolutionModal({
  open,
  onOpenChange,
  recordName,
  conflicts,
  onResolve,
}: ConflictResolutionModalProps) {
  const t = useTranslations('sync_conflicts');

  // Track resolutions by conflict id
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(
    () => new Map(),
  );

  const isMultiField = conflicts.length > 1;
  const allResolved = conflicts.length > 0 && conflicts.every((c) => resolutions.has(c.id));

  // Derive platform from first conflict (all conflicts on a record share the same platform)
  const platform = conflicts[0]?.platform ?? 'airtable';

  const handleResolveField = useCallback((resolution: ConflictResolution) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(resolution.conflictId, resolution);
      return next;
    });
  }, []);

  const handleKeepAllLocal = useCallback(() => {
    setResolutions((prev) => {
      const next = new Map(prev);
      for (const conflict of conflicts) {
        if (!next.has(conflict.id)) {
          next.set(conflict.id, { conflictId: conflict.id, choice: 'keep_local' });
        }
      }
      return next;
    });
  }, [conflicts]);

  const handleKeepAllRemote = useCallback(() => {
    setResolutions((prev) => {
      const next = new Map(prev);
      for (const conflict of conflicts) {
        if (!next.has(conflict.id)) {
          next.set(conflict.id, { conflictId: conflict.id, choice: 'keep_remote' });
        }
      }
      return next;
    });
  }, [conflicts]);

  const handleApply = useCallback(() => {
    const resolved = Array.from(resolutions.values());
    onResolve(resolved);
    onOpenChange(false);
  }, [resolutions, onResolve, onOpenChange]);

  // Reset state when modal opens/closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setResolutions(new Map());
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  // Compute modal width based on mode
  const modalClassName = isMultiField
    ? 'max-w-2xl max-h-[85vh]'
    : 'max-w-lg max-h-[85vh]';

  // Header text
  const title = useMemo(() => {
    if (isMultiField) {
      return t('title_multi', { count: conflicts.length, record: recordName });
    }
    return t('title_single', {
      field: conflicts[0]?.fieldName ?? '',
      record: recordName,
    });
  }, [t, isMultiField, conflicts, recordName]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={modalClassName}
        data-testid="conflict-resolution-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        {/* Conflict rows — scrollable in multi-field mode */}
        {isMultiField ? (
          <>
            {/* Bulk actions at top for multi-field */}
            <ConflictResolutionActions
              conflicts={conflicts}
              resolutions={resolutions}
              onKeepAllLocal={handleKeepAllLocal}
              onKeepAllRemote={handleKeepAllRemote}
              platform={platform}
            />

            <ScrollArea className="max-h-[50vh] pr-2" data-testid="conflict-scroll-area">
              <div className="flex flex-col gap-3 py-2">
                {conflicts.map((conflict) => (
                  <ConflictFieldRow
                    key={conflict.id}
                    conflict={conflict}
                    resolution={resolutions.get(conflict.id) ?? null}
                    onResolve={handleResolveField}
                  />
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          /* Single-field mode — just one row, no scroll or bulk bar */
          conflicts.length > 0 && conflicts[0] != null && (
            <ConflictFieldRow
              conflict={conflicts[0]}
              resolution={resolutions.get(conflicts[0].id) ?? null}
              onResolve={handleResolveField}
            />
          )
        )}

        <DialogFooter>
          <Button
            variant="default"
            className="min-h-[44px]"
            onClick={() => handleOpenChange(false)}
            data-testid="conflict-cancel-btn"
          >
            {t('cancel')}
          </Button>
          <Button
            className="min-h-[44px]"
            disabled={!allResolved}
            onClick={handleApply}
            data-testid="conflict-apply-btn"
          >
            {t('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
