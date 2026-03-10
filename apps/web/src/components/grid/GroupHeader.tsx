'use client';

/**
 * GroupHeader — collapsible header row for grouped grid views.
 *
 * Shows chevron + field name + field value + record count badge.
 * For Select/Status fields, renders a colored pill matching the option color.
 * Click toggles collapse. Indented 16px per nesting level.
 *
 * @see docs/reference/tables-and-views.md § Grouping
 */

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDataColor, getContrastText } from '@/lib/design-system/colors';
import { GRID_TOKENS } from './grid-types';
import { GROUP_HEADER_HEIGHT, GROUP_INDENT_PX } from './use-grouping';
import type { GroupNode } from './use-grouping';
import type { GridField } from '@/lib/types/grid';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Select option helpers
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
  color?: number;
}

function getSelectOptions(field: GridField | undefined): SelectOption[] {
  if (!field) return [];
  const config = field.config as Record<string, unknown> | null;
  const options = config?.options;
  if (!Array.isArray(options)) return [];
  return options as SelectOption[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GroupHeaderProps {
  group: GroupNode;
  field: GridField | undefined;
  isCollapsed: boolean;
  totalWidth: number;
  onToggleCollapse: (groupKey: string) => void;
  style?: React.CSSProperties;
  /** Whether drag-to-regroup is supported for this group's field type. */
  isDragTarget?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, groupValue: unknown) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GroupHeader = memo(function GroupHeader({
  group,
  field,
  isCollapsed,
  totalWidth,
  onToggleCollapse,
  style,
  isDragTarget,
  onDragOver,
  onDrop,
}: GroupHeaderProps) {
  const t = useTranslations('grid.grouping');

  const indent = group.level * GROUP_INDENT_PX;
  const isSelectField =
    field?.fieldType === 'single_select' || field?.fieldType === 'status';

  // Find matching option for colored pill
  let pillColor: { light: string; saturated: string } | null = null;
  let pillLabel = group.label;

  if (isSelectField && field) {
    const options = getSelectOptions(field);
    const option = options.find((o) => o.value === String(group.value));
    if (option) {
      pillLabel = option.label;
      const colorIndex = option.color ?? 0;
      pillColor = getDataColor(colorIndex);
    }
  }

  const fieldName = field?.name ?? t('unknown_field');

  return (
    <div
      className={cn(
        'flex items-center border-b cursor-pointer select-none',
        isDragTarget && 'ring-2 ring-blue-400 ring-inset',
      )}
      style={{
        height: GROUP_HEADER_HEIGHT,
        width: totalWidth,
        paddingLeft: 12 + indent,
        backgroundColor: GRID_TOKENS.panelBg,
        borderColor: GRID_TOKENS.borderDefault,
        ...style,
      }}
      role="row"
      aria-expanded={!isCollapsed}
      aria-level={group.level + 1}
      onClick={() => onToggleCollapse(group.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleCollapse(group.key);
        }
      }}
      tabIndex={-1}
      onDragOver={isDragTarget ? onDragOver : undefined}
      onDrop={
        isDragTarget
          ? (e) => onDrop?.(e, group.value)
          : undefined
      }
    >
      {/* Collapse chevron */}
      <span className="mr-1.5 flex shrink-0 items-center">
        {isCollapsed ? (
          <ChevronRight
            className="h-4 w-4"
            style={{ color: GRID_TOKENS.textSecondary }}
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className="h-4 w-4"
            style={{ color: GRID_TOKENS.textSecondary }}
            aria-hidden="true"
          />
        )}
      </span>

      {/* Field name */}
      <span
        className="mr-1.5 shrink-0 text-xs font-medium"
        style={{ color: GRID_TOKENS.textSecondary }}
      >
        {fieldName}:
      </span>

      {/* Value — colored pill for Select/Status, plain text otherwise */}
      {pillColor ? (
        <span
          className="mr-2 inline-flex max-w-[200px] items-center truncate rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: pillColor.light,
            color: getContrastText(pillColor.light),
          }}
        >
          {pillLabel}
        </span>
      ) : (
        <span
          className="mr-2 max-w-[200px] truncate text-sm font-medium"
          style={{ color: GRID_TOKENS.textPrimary }}
        >
          {group.label}
        </span>
      )}

      {/* Record count badge */}
      <Badge variant="default" className="shrink-0 text-xs">
        {t('record_count', { count: group.recordCount })}
      </Badge>
    </div>
  );
});
