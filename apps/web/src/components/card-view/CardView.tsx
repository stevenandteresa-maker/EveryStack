'use client';

/**
 * CardView — renders records as cards in three layout modes.
 *
 * Uses the same data source as Grid (useGridData hook).
 * Three layouts: single column, grid (2–3 cols), compact list.
 * Supports grouping via GroupHeader sections.
 *
 * @see docs/reference/tables-and-views.md § Card View
 */

import { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { RecordCard } from './RecordCard';
import { CardViewToolbar } from './CardViewToolbar';
import { GroupHeader } from '@/components/grid/GroupHeader';
import { computeGroups, type GroupNode } from '@/components/grid/use-grouping';
import { GridSkeleton } from '@/components/grid/GridSkeleton';
import { GridEmptyState } from '@/components/grid/GridEmptyState';
import { RecordCount } from '@/components/grid/RecordCount';
import type { GridField, GridRecord, ViewConfig, CardLayout, GroupLevel, SortLevel } from '@/lib/types/grid';
import type { GridToolbarProps } from '@/components/grid/GridToolbar';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardViewProps {
  records: GridRecord[];
  fields: GridField[];
  viewConfig: ViewConfig;
  totalCount: number;
  isLoading: boolean;
  error: Error | null;

  // Card view state
  layout: CardLayout;
  cardColumns: 2 | 3;
  visibleFields: GridField[];

  // Card view actions
  onSetLayout: (layout: CardLayout) => void;
  onSetCardColumns: (columns: 2 | 3) => void;

  // Record actions
  onExpandRecord: (recordId: string) => void;
  onSaveField: (recordId: string, fieldId: string, value: unknown) => void;

  // Grouping & sorting
  groups: GroupLevel[];
  sorts: SortLevel[];
  collapsedGroups: Set<string>;
  onToggleGroupCollapsed: (groupKey: string) => void;

  // Toolbar props (pass-through for shared controls)
  toolbarProps: Omit<GridToolbarProps, 'density' | 'onSetDensity'>;
  /** Field IDs that are hidden due to field-level permissions. */
  hiddenFieldIds?: Set<string>;
}

// ---------------------------------------------------------------------------
// Layout class maps
// ---------------------------------------------------------------------------

function getGridClasses(layout: CardLayout, columns: 2 | 3): string {
  if (layout === 'single_column') {
    return 'grid grid-cols-1 gap-4 max-w-3xl mx-auto';
  }
  if (layout === 'compact_list') {
    return 'grid grid-cols-1 gap-2';
  }
  // Grid layout
  return cn(
    'grid gap-4',
    columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  );
}

// ---------------------------------------------------------------------------
// Grouped card rendering
// ---------------------------------------------------------------------------

interface GroupedCardsProps {
  groups: GroupNode[];
  fields: GridField[];
  allFields: GridField[];
  visibleFields: GridField[];
  layout: CardLayout;
  cardColumns: 2 | 3;
  collapsedGroups: Set<string>;
  onToggleGroupCollapsed: (groupKey: string) => void;
  onExpandRecord: (recordId: string) => void;
  onSaveField: (recordId: string, fieldId: string, value: unknown) => void;
}

const GroupedCards = memo(function GroupedCards({
  groups,
  fields,
  allFields,
  visibleFields,
  layout,
  cardColumns,
  collapsedGroups,
  onToggleGroupCollapsed,
  onExpandRecord,
  onSaveField,
}: GroupedCardsProps) {
  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isCollapsed = collapsedGroups.has(group.key);
        const groupField = allFields.find((f) => f.id === group.fieldId);

        return (
          <div key={group.key}>
            <GroupHeader
              group={group}
              field={groupField}
              isCollapsed={isCollapsed}
              totalWidth={0}
              onToggleCollapse={onToggleGroupCollapsed}
              style={{ width: '100%' }}
            />

            {!isCollapsed && (
              <div className={cn('p-3', getGridClasses(layout, cardColumns))}>
                {group.records.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    fields={visibleFields}
                    layout={layout}
                    onExpandRecord={onExpandRecord}
                    onSaveField={onSaveField}
                  />
                ))}
              </div>
            )}

            {/* Render nested groups */}
            {!isCollapsed && group.children && group.children.length > 0 && (
              <div className="ml-4">
                <GroupedCards
                  groups={group.children}
                  fields={fields}
                  allFields={allFields}
                  visibleFields={visibleFields}
                  layout={layout}
                  cardColumns={cardColumns}
                  collapsedGroups={collapsedGroups}
                  onToggleGroupCollapsed={onToggleGroupCollapsed}
                  onExpandRecord={onExpandRecord}
                  onSaveField={onSaveField}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// CardView component
// ---------------------------------------------------------------------------

export const CardView = memo(function CardView({
  records,
  fields,
  viewConfig: _viewConfig,
  totalCount,
  isLoading,
  error,
  layout,
  cardColumns,
  visibleFields,
  onSetLayout,
  onSetCardColumns,
  onExpandRecord,
  onSaveField,
  groups,
  sorts,
  collapsedGroups,
  onToggleGroupCollapsed,
  toolbarProps,
  hiddenFieldIds,
}: CardViewProps) {
  const t = useTranslations('card_view');

  // Filter out permission-hidden fields from visible fields
  const effectiveVisibleFields = useMemo(() => {
    if (!hiddenFieldIds || hiddenFieldIds.size === 0) return visibleFields;
    return visibleFields.filter((f) => !hiddenFieldIds.has(f.id));
  }, [visibleFields, hiddenFieldIds]);

  // Compute groups from records if grouping is active
  const groupTree = useMemo(() => {
    if (groups.length === 0) return null;
    return computeGroups(records, groups, fields, sorts, {
      emptyLabel: t('grouping_empty_value'),
    });
  }, [records, groups, fields, sorts, t]);

  if (isLoading) {
    return <GridSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-red-600">{t('error')}</p>
      </div>
    );
  }

  const hasGrouping = groups.length > 0 && groupTree != null;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <CardViewToolbar
        {...toolbarProps}
        density="medium"
        onSetDensity={() => {
          /* Card view does not use row density — no-op */
        }}
        cardLayout={layout}
        onSetCardLayout={onSetLayout}
        cardColumns={cardColumns}
        onSetCardColumns={onSetCardColumns}
      />

      {/* Card content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {records.length === 0 ? (
          <GridEmptyState />
        ) : hasGrouping ? (
          <GroupedCards
            groups={groupTree}
            fields={fields}
            allFields={fields}
            visibleFields={effectiveVisibleFields}
            layout={layout}
            cardColumns={cardColumns}
            collapsedGroups={collapsedGroups}
            onToggleGroupCollapsed={onToggleGroupCollapsed}
            onExpandRecord={onExpandRecord}
            onSaveField={onSaveField}
          />
        ) : (
          <div className={getGridClasses(layout, cardColumns)}>
            {records.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                fields={effectiveVisibleFields}
                layout={layout}
                onExpandRecord={onExpandRecord}
                onSaveField={onSaveField}
              />
            ))}
          </div>
        )}
      </div>

      {/* Record count footer */}
      <RecordCount
        filteredCount={records.length}
        totalCount={totalCount}
        isFiltered={records.length !== totalCount}
      />
    </div>
  );
});
