'use client';

/**
 * useLinkPicker — hook providing Link Picker actions.
 *
 * Wraps LinkPickerContext with action methods that call server actions
 * for linking/unlinking records.
 *
 * @see docs/reference/cross-linking.md § Link Picker UX
 */

import { useCallback, useContext, useTransition } from 'react';
import { LinkPickerContext } from './link-picker-provider';
import type { LinkPickerMode } from './link-picker-provider';
import { linkRecords, unlinkRecords } from '@/actions/cross-link-actions';

export function useLinkPicker() {
  const ctx = useContext(LinkPickerContext);
  const [isPending, startTransition] = useTransition();

  const open = useCallback(
    (crossLinkId: string, sourceRecordId: string, mode?: LinkPickerMode) => {
      ctx.open(crossLinkId, sourceRecordId, mode);
    },
    [ctx],
  );

  const close = useCallback(() => {
    ctx.close();
  }, [ctx]);

  /**
   * Select a record.
   * - Single mode: immediately link and close.
   * - Multi mode: toggle in selectedIds.
   */
  const select = useCallback(
    (targetRecordId: string) => {
      if (ctx.mode === 'single') {
        if (!ctx.crossLinkId || !ctx.sourceRecordId) return;
        const crossLinkId = ctx.crossLinkId;
        const sourceRecordId = ctx.sourceRecordId;
        startTransition(async () => {
          await linkRecords({
            crossLinkId,
            sourceRecordId,
            targetRecordIds: [targetRecordId],
          });
        });
        ctx.close();
      } else {
        ctx.toggleSelected(targetRecordId);
      }
    },
    [ctx, startTransition],
  );

  /**
   * Confirm selection in multi mode — link all selected records.
   */
  const confirm = useCallback(() => {
    if (!ctx.crossLinkId || !ctx.sourceRecordId || ctx.selectedIds.size === 0) return;
    const crossLinkId = ctx.crossLinkId;
    const sourceRecordId = ctx.sourceRecordId;
    const targetRecordIds = Array.from(ctx.selectedIds);
    startTransition(async () => {
      await linkRecords({
        crossLinkId,
        sourceRecordId,
        targetRecordIds,
      });
    });
    ctx.close();
  }, [ctx, startTransition]);

  /**
   * Remove a linked record (unlink).
   */
  const remove = useCallback(
    (targetRecordId: string) => {
      if (!ctx.crossLinkId || !ctx.sourceRecordId) return;
      const crossLinkId = ctx.crossLinkId;
      const sourceRecordId = ctx.sourceRecordId;
      startTransition(async () => {
        await unlinkRecords({
          crossLinkId,
          sourceRecordId,
          targetRecordIds: [targetRecordId],
        });
      });
    },
    [ctx, startTransition],
  );

  return {
    ...ctx,
    open,
    close,
    select,
    confirm,
    remove,
    isPending,
  };
}
