'use client';

/**
 * useOptimisticRecord — TanStack Query mutation hook for optimistic cell updates.
 *
 * Immediately updates the query cache with the new value, then calls the
 * updateRecordField Server Action. On error, rolls back to the previous
 * value and shows an error toast.
 *
 * @see docs/reference/tables-and-views.md § Cell Behavior — Optimistic updates
 * @see docs/Playbooks/playbook-phase-3a-i.md § Prompt 6
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { updateRecordField } from '@/actions/record-actions';
import type { GridRecord } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpdateCellParams {
  recordId: string;
  fieldId: string;
  value: unknown;
  tableId: string;
  viewId: string | null;
}

interface GridDataCache {
  records: GridRecord[];
  fields: unknown[];
  viewConfig: unknown;
  totalCount: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOptimisticRecord(tableId: string, viewId: string | null) {
  const queryClient = useQueryClient();
  const t = useTranslations('grid');
  const queryKey = ['grid-data', tableId, viewId];

  const mutation = useMutation({
    mutationFn: async (params: UpdateCellParams) => {
      return updateRecordField({
        recordId: params.recordId,
        viewId: params.viewId ?? '',
        fieldId: params.fieldId,
        value: params.value,
      });
    },

    onMutate: async (params: UpdateCellParams) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<GridDataCache>(queryKey);

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<GridDataCache>(queryKey, {
          ...previousData,
          records: previousData.records.map((record) => {
            if (record.id !== params.recordId) return record;
            const canonical = (record.canonicalData ?? {}) as Record<string, unknown>;
            return {
              ...record,
              canonicalData: {
                ...canonical,
                [params.fieldId]: params.value,
              },
            } as GridRecord;
          }),
        });
      }

      return { previousData };
    },

    onError: (_error, _params, context) => {
      // Roll back to previous value
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error(t('save_error'));
    },

    onSettled: () => {
      // Refetch to ensure server state is in sync
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateCell = useCallback(
    (recordId: string, fieldId: string, value: unknown) => {
      mutation.mutate({
        recordId,
        fieldId,
        value,
        tableId,
        viewId,
      });
    },
    [mutation, tableId, viewId],
  );

  return {
    updateCell,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
