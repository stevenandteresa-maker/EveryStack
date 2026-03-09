'use client';

/**
 * GroupFooter — per-group aggregation footer row.
 *
 * Renders field-type-appropriate summaries for each column within
 * a group. Uses a lighter background to distinguish from data rows.
 *
 * Aggregation logic is shared with the future SummaryFooter (Prompt 5).
 *
 * @see docs/reference/tables-and-views.md § Grouping
 */

import { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { GRID_TOKENS, DRAG_HANDLE_WIDTH, CHECKBOX_COLUMN_WIDTH, ROW_NUMBER_WIDTH } from './grid-types';
import { GROUP_FOOTER_HEIGHT, GROUP_INDENT_PX, computeAggregation, getDefaultAggregation } from './use-grouping';
import type { GroupNode } from './use-grouping';
import type { GridField, GridRecord } from '@/lib/types/grid';
import { getDefaultColumnWidth } from './grid-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GroupFooterProps {
  group: GroupNode;
  fields: GridField[];
  columnWidths: Record<string, number>;
  totalWidth: number;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GroupFooter = memo(function GroupFooter({
  group,
  fields,
  columnWidths,
  totalWidth,
  style,
}: GroupFooterProps) {
  const t = useTranslations('grid.grouping');

  const indent = group.level * GROUP_INDENT_PX;

  // Collect all records under this group (recursively if nested)
  const allRecords = useMemo(() => collectRecords(group), [group]);

  // Fixed columns width
  const fixedLeftWidth = DRAG_HANDLE_WIDTH + CHECKBOX_COLUMN_WIDTH + ROW_NUMBER_WIDTH;

  return (
    <div
      className="flex items-center border-b"
      style={{
        height: GROUP_FOOTER_HEIGHT,
        width: totalWidth,
        backgroundColor: '#F8FAFC',
        borderColor: GRID_TOKENS.borderDefault,
        ...style,
      }}
      role="row"
      aria-label={t('footer_label', { group: group.label })}
    >
      {/* Fixed left area — show summary label */}
      <div
        className="flex shrink-0 items-center text-xs font-medium"
        style={{
          width: fixedLeftWidth,
          paddingLeft: 12 + indent,
          color: GRID_TOKENS.textSecondary,
        }}
      >
        {t('summary')}
      </div>

      {/* Aggregation cells per field */}
      {fields.map((field) => {
        const width =
          columnWidths[field.id] ??
          getDefaultColumnWidth(field.fieldType, field.isPrimary);
        const aggregationType = getDefaultAggregation(field.fieldType);
        const result = computeAggregation(allRecords, field.id, aggregationType);

        return (
          <div
            key={field.id}
            className="flex shrink-0 items-center truncate px-3 text-xs"
            style={{
              width,
              color: GRID_TOKENS.textSecondary,
            }}
          >
            {result.value}
          </div>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectRecords(group: GroupNode): GridRecord[] {
  if (group.children.length === 0) return group.records;

  const result: GridRecord[] = [];
  for (const child of group.children) {
    result.push(...collectRecords(child));
  }
  return result;
}
