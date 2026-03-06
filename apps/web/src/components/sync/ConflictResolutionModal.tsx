'use client';

// ---------------------------------------------------------------------------
// ConflictResolutionModal — Dialog-based modal for resolving sync conflicts
// on a single record.
//
// Single-field mode: shows one ConflictFieldRow.
// Multi-field mode: scrollable list of ConflictFieldRow components
//   + ConflictResolutionActions bulk bar.
//
// Resolution decisions are collected in local state. On "Apply Resolutions",
// each conflict is submitted to the resolveConflict Server Action, the store
// is updated optimistically, and an undo toast is shown.
// ---------------------------------------------------------------------------

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
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
import { resolveConflict } from '@/actions/sync-conflict-resolve';
import { showUndoResolveToast } from './UndoResolveToast';
import { useSyncConflictStore } from '@/lib/sync-conflict-store';
import type {
  ConflictResolutionModalProps,
  ConflictResolution,
} from './conflict-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map UI choice to server action resolution value. */
function toResolutionStatus(
  choice: ConflictResolution['choice'],
): 'resolved_local' | 'resolved_remote' | 'resolved_merged' {
  switch (choice) {
    case 'keep_local':
      return 'resolved_local';
    case 'keep_remote':
      return 'resolved_remote';
    case 'edit':
      return 'resolved_merged';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConflictResolutionModal({
  open,
  onOpenChange,
  recordName,
  conflicts,
  onResolve,
  tableId,
  recordId,
}: ConflictResolutionModalProps) {
  const t = useTranslations('sync_conflicts');
  const removeConflict = useSyncConflictStore((s) => s.removeConflict);
  const addConflict = useSyncConflictStore((s) => s.addConflict);

  // Track resolutions by conflict id
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(
    () => new Map(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleApply = useCallback(async () => {
    const resolved = Array.from(resolutions.values());
    setIsSubmitting(true);

    try {
      // Build a lookup for undo callbacks
      const conflictsById = new Map(conflicts.map((c) => [c.id, c]));

      // Submit each resolution to the server action
      for (const resolution of resolved) {
        const conflict = conflictsById.get(resolution.conflictId);
        if (!conflict) continue;

        const result = await resolveConflict({
          conflictId: resolution.conflictId,
          resolution: toResolutionStatus(resolution.choice),
          mergedValue: resolution.editedValue,
          tableId,
        });

        // Optimistic: remove conflict from store
        removeConflict(recordId, conflict.fieldId);

        // Show undo toast
        showUndoResolveToast(
          {
            undoToken: result.undoToken,
            onUndoSuccess: () => {
              // Re-add conflict to the store on undo
              addConflict(recordId, conflict.fieldId, {
                id: conflict.id,
                localValue: conflict.localValue,
                remoteValue: conflict.remoteValue,
                platform: conflict.platform,
                createdAt: conflict.createdAt,
              });
            },
          },
          t,
        );
      }

      // Notify parent callback
      onResolve(resolved);
      onOpenChange(false);
    } catch {
      toast.error(t('resolve_error'));
    } finally {
      setIsSubmitting(false);
    }
  }, [resolutions, conflicts, tableId, recordId, removeConflict, addConflict, onResolve, onOpenChange, t]);

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
            disabled={!allResolved || isSubmitting}
            onClick={handleApply}
            data-testid="conflict-apply-btn"
          >
            {isSubmitting ? t('applying') : t('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
