'use client';

/**
 * Summary footer state hook for the grid view.
 *
 * Manages the table-wide summary footer configuration, including
 * per-column aggregation type selection. Config persists to
 * views.config.summary_footer.
 *
 * @see docs/reference/tables-and-views.md § Summary Footer Row
 */

import { useCallback, useState } from 'react';
import type { AggregationType } from './aggregation-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SummaryFooterConfig {
  /** Whether the summary footer is visible. */
  enabled: boolean;
  /** Map of fieldId → aggregation type. */
  columns: Record<string, AggregationType>;
}

// ---------------------------------------------------------------------------
// Hook options & return type
// ---------------------------------------------------------------------------

export interface UseSummaryFooterOptions {
  viewId: string;
  initialConfig?: SummaryFooterConfig;
  onPersist: (viewId: string, config: SummaryFooterConfig) => void;
}

export interface UseSummaryFooterReturn {
  config: SummaryFooterConfig;
  setSummaryEnabled: (enabled: boolean) => void;
  setColumnAggregation: (fieldId: string, aggregationType: AggregationType) => void;
  clearColumnAggregation: (fieldId: string) => void;
  isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

export function createDefaultSummaryFooterConfig(): SummaryFooterConfig {
  return { enabled: false, columns: {} };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSummaryFooter({
  viewId,
  initialConfig,
  onPersist,
}: UseSummaryFooterOptions): UseSummaryFooterReturn {
  const [config, setConfig] = useState<SummaryFooterConfig>(
    initialConfig ?? createDefaultSummaryFooterConfig(),
  );

  const setSummaryEnabled = useCallback(
    (enabled: boolean) => {
      setConfig((prev) => {
        const next = { ...prev, enabled };
        onPersist(viewId, next);
        return next;
      });
    },
    [viewId, onPersist],
  );

  const setColumnAggregation = useCallback(
    (fieldId: string, aggregationType: AggregationType) => {
      setConfig((prev) => {
        const next = {
          ...prev,
          columns: { ...prev.columns, [fieldId]: aggregationType },
        };
        onPersist(viewId, next);
        return next;
      });
    },
    [viewId, onPersist],
  );

  const clearColumnAggregation = useCallback(
    (fieldId: string) => {
      setConfig((prev) => {
        const columns = { ...prev.columns };
        delete columns[fieldId];
        const next = { ...prev, columns };
        onPersist(viewId, next);
        return next;
      });
    },
    [viewId, onPersist],
  );

  return {
    config,
    setSummaryEnabled,
    setColumnAggregation,
    clearColumnAggregation,
    isEnabled: config.enabled,
  };
}
