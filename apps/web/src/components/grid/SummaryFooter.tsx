'use client';

/**
 * SummaryFooter — sticky bottom row showing per-column aggregated values.
 *
 * Click a footer cell to pick an aggregation type from a dropdown.
 * The footer respects active filters (aggregates only visible records).
 * When grouping is active, this shows table-wide aggregation; per-group
 * footers show group-specific values independently.
 *
 * @see docs/reference/tables-and-views.md § Summary Footer Row
 */

import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import {
  GRID_TOKENS,
  DRAG_HANDLE_WIDTH,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_WIDTH,
  getDefaultColumnWidth,
} from './grid-types';
import {
  computeAggregation,
  getAggregationOptions,
  getDefaultAggregation,
  type AggregationType,
} from './aggregation-utils';
import type { SummaryFooterConfig } from './use-summary-footer';
import type { GridRecord, GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SUMMARY_FOOTER_HEIGHT = 36;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SummaryFooterProps {
  records: GridRecord[];
  fields: GridField[];
  columnWidths: Record<string, number>;
  totalWidth: number;
  config: SummaryFooterConfig;
  onSetColumnAggregation: (fieldId: string, aggregationType: AggregationType) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SummaryFooter = memo(function SummaryFooter({
  records,
  fields,
  columnWidths,
  totalWidth,
  config,
  onSetColumnAggregation,
}: SummaryFooterProps) {
  const t = useTranslations('grid.summary');

  const fixedLeftWidth = DRAG_HANDLE_WIDTH + CHECKBOX_COLUMN_WIDTH + ROW_NUMBER_WIDTH;

  return (
    <div
      className="sticky bottom-0 z-10 flex items-center border-t"
      style={{
        height: SUMMARY_FOOTER_HEIGHT,
        width: totalWidth,
        backgroundColor: '#F8FAFC',
        borderColor: GRID_TOKENS.borderDefault,
      }}
      role="row"
      aria-label={t('label')}
    >
      {/* Fixed left area — summary label */}
      <div
        className="flex shrink-0 items-center text-xs font-medium"
        style={{
          width: fixedLeftWidth,
          paddingLeft: 12,
          color: GRID_TOKENS.textSecondary,
        }}
      >
        {t('label')}
      </div>

      {/* Aggregation cells per field */}
      {fields.map((field) => {
        const width =
          columnWidths[field.id] ??
          getDefaultColumnWidth(field.fieldType, field.isPrimary);
        const aggregationType =
          config.columns[field.id] ?? getDefaultAggregation(field.fieldType);

        return (
          <SummaryCell
            key={field.id}
            records={records}
            field={field}
            width={width}
            aggregationType={aggregationType}
            onSetAggregation={(type) => onSetColumnAggregation(field.id, type)}
          />
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Summary cell with aggregation picker
// ---------------------------------------------------------------------------

interface SummaryCellProps {
  records: GridRecord[];
  field: GridField;
  width: number;
  aggregationType: AggregationType;
  onSetAggregation: (type: AggregationType) => void;
}

const SummaryCell = memo(function SummaryCell({
  records,
  field,
  width,
  aggregationType,
  onSetAggregation,
}: SummaryCellProps) {
  const t = useTranslations('grid.summary');
  const [pickerOpen, setPickerOpen] = useState(false);

  const result = useMemo(
    () => computeAggregation(records, field.id, aggregationType),
    [records, field.id, aggregationType],
  );

  const options = useMemo(
    () => getAggregationOptions(field.fieldType),
    [field.fieldType],
  );

  const handleSelect = useCallback(
    (type: AggregationType) => {
      onSetAggregation(type);
      setPickerOpen(false);
    },
    [onSetAggregation],
  );

  return (
    <div
      className="relative flex shrink-0 cursor-pointer items-center truncate px-3 text-xs"
      style={{
        width,
        color: GRID_TOKENS.textSecondary,
      }}
      onClick={() => setPickerOpen(!pickerOpen)}
      role="button"
      tabIndex={0}
      aria-label={t('pick_aggregation', { field: field.name })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setPickerOpen(!pickerOpen);
        }
      }}
    >
      <span className="truncate">{result.value || '-'}</span>
      <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />

      {/* Aggregation picker dropdown */}
      {pickerOpen && (
        <div
          className="absolute bottom-full left-0 z-20 mb-1 min-w-[140px] rounded-md border bg-white py-1 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-slate-100"
              style={{
                fontWeight: option === aggregationType ? 600 : 400,
                color: option === aggregationType ? '#0F172A' : GRID_TOKENS.textSecondary,
              }}
              onClick={() => handleSelect(option)}
            >
              {t(`type_${option}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
