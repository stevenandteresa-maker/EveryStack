'use client';

/**
 * UndoResolveToast — Shows a Sonner toast after a conflict is resolved,
 * with an 8-second undo window.
 *
 * Usage:
 *   showUndoResolveToast({ undoToken, onUndo, onUndoSuccess, onUndoExpired });
 *
 * The toast auto-dismisses after 8 seconds. If the user clicks "Undo"
 * within that window, undoConflictResolution is called.
 *
 * @see docs/reference/sync-engine.md § Optimistic Resolution + Undo (lines 733–745)
 */

import type { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { undoConflictResolution } from '@/actions/sync-conflict-resolve';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Toast duration matching the Redis TTL (8 seconds). */
const TOAST_DURATION_MS = 8_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UndoResolveToastOptions {
  /** The undo token returned by resolveConflict. */
  undoToken: string;
  /** Called after a successful undo to re-add the conflict to the store. */
  onUndoSuccess?: () => void;
  /** Called when undo fails (token expired). */
  onUndoExpired?: () => void;
}

// ---------------------------------------------------------------------------
// Toast trigger (not a component — call this function)
// ---------------------------------------------------------------------------

/**
 * Show an undo toast for a resolved conflict.
 *
 * This is a plain function, not a React component. Call it from an event
 * handler after resolveConflict succeeds.
 */
export function showUndoResolveToast(
  options: UndoResolveToastOptions,
  t: ReturnType<typeof useTranslations<'sync_conflicts'>>,
): void {
  const { undoToken, onUndoSuccess, onUndoExpired } = options;

  toast.success(t('resolve_success'), {
    duration: TOAST_DURATION_MS,
    action: {
      label: t('undo'),
      onClick: async () => {
        try {
          const result = await undoConflictResolution({ undoToken });
          if (result.success) {
            toast.success(t('undo_success'));
            onUndoSuccess?.();
          } else {
            toast.error(t('undo_expired'));
            onUndoExpired?.();
          }
        } catch {
          toast.error(t('undo_expired'));
          onUndoExpired?.();
        }
      },
    },
  });
}
