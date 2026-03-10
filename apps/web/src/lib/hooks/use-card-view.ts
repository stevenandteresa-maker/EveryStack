'use client';

/**
 * Card view state hook.
 *
 * Manages card-specific state: layout, column count, field config.
 * Persists to views.config for card view type views.
 *
 * @see docs/reference/tables-and-views.md § Card View
 */

import { useCallback, useMemo, useState } from 'react';
import type { CardLayout, GridField, ViewConfig } from '@/lib/types/grid';
import { updateViewConfig } from '@/actions/view-actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCardViewOptions {
  viewId: string | null;
  viewConfig: ViewConfig;
  fields: GridField[];
}

export interface UseCardViewReturn {
  layout: CardLayout;
  setLayout: (layout: CardLayout) => void;
  cardColumns: 2 | 3;
  setCardColumns: (columns: 2 | 3) => void;
  fieldConfig: string[];
  setFieldConfig: (fieldIds: string[]) => void;
  visibleFields: GridField[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_LAYOUT: CardLayout = 'grid';
const DEFAULT_CARD_COLUMNS: 2 | 3 = 2;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCardView({
  viewId,
  viewConfig,
  fields,
}: UseCardViewOptions): UseCardViewReturn {
  const [layout, setLayoutState] = useState<CardLayout>(
    viewConfig.card_layout ?? DEFAULT_LAYOUT,
  );
  const [cardColumns, setCardColumnsState] = useState<2 | 3>(
    viewConfig.card_columns ?? DEFAULT_CARD_COLUMNS,
  );
  const [fieldConfig, setFieldConfigState] = useState<string[]>(
    viewConfig.field_config ?? fields.map((f) => f.id),
  );

  const persist = useCallback(
    (patch: Partial<ViewConfig>) => {
      if (!viewId) return;
      void updateViewConfig({ viewId, configPatch: patch });
    },
    [viewId],
  );

  const setLayout = useCallback(
    (newLayout: CardLayout) => {
      setLayoutState(newLayout);
      persist({ card_layout: newLayout });
    },
    [persist],
  );

  const setCardColumns = useCallback(
    (columns: 2 | 3) => {
      setCardColumnsState(columns);
      persist({ card_columns: columns });
    },
    [persist],
  );

  const setFieldConfig = useCallback(
    (fieldIds: string[]) => {
      setFieldConfigState(fieldIds);
      persist({ field_config: fieldIds });
    },
    [persist],
  );

  // Compute visible fields in configured order, filtering hidden fields
  const hiddenFieldIds = useMemo(
    () => new Set(viewConfig.hidden_fields ?? []),
    [viewConfig.hidden_fields],
  );

  const visibleFields = useMemo(() => {
    const fieldMap = new Map(fields.map((f) => [f.id, f]));
    const ordered: GridField[] = [];

    for (const fieldId of fieldConfig) {
      if (hiddenFieldIds.has(fieldId)) continue;
      const field = fieldMap.get(fieldId);
      if (field) {
        ordered.push(field);
      }
    }

    // Include any fields not in fieldConfig (newly added fields)
    for (const field of fields) {
      if (hiddenFieldIds.has(field.id)) continue;
      if (!fieldConfig.includes(field.id)) {
        ordered.push(field);
      }
    }

    return ordered;
  }, [fields, fieldConfig, hiddenFieldIds]);

  return {
    layout,
    setLayout,
    cardColumns,
    setCardColumns,
    fieldConfig,
    setFieldConfig,
    visibleFields,
  };
}
