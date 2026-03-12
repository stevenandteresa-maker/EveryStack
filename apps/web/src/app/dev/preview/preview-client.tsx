'use client';

/**
 * DevPreviewClient — interactive preview of Grid, Card, and Record View.
 *
 * All callbacks are no-ops or local state. No database, no API calls.
 */

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryProvider } from '@/lib/query-provider';

// Dynamic imports to avoid @everystack/shared/db barrel pulling in server-only
// modules (@sentry/node → async_hooks) into the client bundle.
const DataGrid = dynamic(() => import('@/components/grid/DataGrid').then((m) => m.DataGrid), { ssr: false });
const CardView = dynamic(() => import('@/components/card-view/CardView').then((m) => m.CardView), { ssr: false });
const RecordView = dynamic(() => import('@/components/record-view/RecordView').then((m) => m.RecordView), { ssr: false });
import { cn } from '@/lib/utils';
import type { CellPosition } from '@/components/grid/grid-types';
import type { RowDensity, CardLayout, ViewConfig } from '@/lib/types/grid';
import type { GridToolbarProps } from '@/components/grid/GridToolbar';
import {
  MOCK_FIELDS,
  MOCK_RECORDS,
  MOCK_VIEW_CONFIG,
  MOCK_RECORD_VIEW_LAYOUT,
} from './mock-data';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type PreviewTab = 'grid' | 'card' | 'record';

// ---------------------------------------------------------------------------
// No-op helpers
// ---------------------------------------------------------------------------

const noop = () => {};
const noopStr = (_s: string) => {};
const noopStrStr = (_a: string, _b: string) => {};
const noopStrStrNull = (_a: string, _b: string | null) => {};
const noopStrStrAny = (_a: string, _b: string, _c: unknown) => {};

// ---------------------------------------------------------------------------
// Shared toolbar props (all no-op for preview)
// ---------------------------------------------------------------------------

function makeToolbarProps(
  fields: typeof MOCK_FIELDS,
  viewConfig: ViewConfig,
): Omit<GridToolbarProps, 'density' | 'onSetDensity'> {
  return {
    viewName: 'All Deals',
    viewType: 'grid',
    filterOpen: false,
    onFilterOpenChange: noop,
    sortOpen: false,
    onSortOpenChange: noop,
    groupOpen: false,
    onGroupOpenChange: noop,
    colorOpen: false,
    onColorOpenChange: noop,
    hideFieldsOpen: false,
    onHideFieldsOpenChange: noop,
    activeFilterCount: 0,
    activeSortCount: viewConfig.sorts?.length ?? 0,
    activeGroupCount: 0,
    hasColorRules: false,
    hiddenFieldCount: 0,
    sortPanelProps: {
      sorts: viewConfig.sorts ?? [],
      fields,
      onAddSort: noop,
      onRemoveSort: noop,
      onUpdateDirection: noop,
      onUpdateField: noop,
      onReorderSorts: noop,
      onClearSorts: noop,
      isAtLimit: false,
    },
    filterBuilderProps: {
      filters: { logic: 'and' as const, conditions: [], groups: [] },
      fields,
      activeFilterCount: 0,
      onAddCondition: noop,
      onRemoveCondition: noop,
      onUpdateCondition: noop,
      onAddGroup: noop,
      onAddConditionToGroup: noop,
      onRemoveGroup: noop,
      onSetLogic: noop,
      onSetGroupLogic: noop,
      onClearFilters: noop,
    },
    colorRuleBuilderProps: {
      colorRules: { row_rules: [], cell_rules: [] },
      fields,
      onAddRowRule: noop,
      onAddCellRule: noop,
      onUpdateRule: noop,
      onRemoveRule: noop,
      onClearRules: noop,
    },
    hideFieldsPanelProps: {
      fields,
      hiddenFieldIds: new Set<string>(),
      fieldOrder: fields.map((f) => f.id),
      onToggleField: noop,
      onShowAll: noop,
      onHideAll: noop,
      onReorderFields: noop,
    },
    groupPanelProps: {
      groups: [],
      fields,
      onAddGroup: noop,
      onRemoveGroup: noop,
      onUpdateDirection: noop,
      onReorderGroups: noop,
      onClearGroups: noop,
      isAtLimit: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DevPreviewClient() {
  const [tab, setTab] = useState<PreviewTab>('grid');
  const [density, setDensity] = useState<RowDensity>('medium');
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [cardLayout, setCardLayout] = useState<CardLayout>('grid');
  const [cardColumns, setCardColumns] = useState<2 | 3>(3);
  const [recordViewOpen, setRecordViewOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    MOCK_FIELDS.forEach((f) => {
      if (f.isPrimary) widths[f.id] = 280;
      else if (f.fieldType === 'currency') widths[f.id] = 140;
      else if (f.fieldType === 'checkbox') widths[f.id] = 80;
      else if (f.fieldType === 'rating') widths[f.id] = 120;
      else if (f.fieldType === 'date') widths[f.id] = 140;
      else if (f.fieldType === 'email') widths[f.id] = 200;
      else if (f.fieldType === 'phone') widths[f.id] = 180;
      else if (f.fieldType === 'textarea') widths[f.id] = 240;
      else widths[f.id] = 180;
    });
    return widths;
  }, []);

  const columnOrder = useMemo(
    () => MOCK_FIELDS.map((f) => f.id),
    [],
  );

  const visibleFields = useMemo(
    () => MOCK_FIELDS.filter((f) =>
      (MOCK_VIEW_CONFIG.field_config ?? []).includes(f.id),
    ),
    [],
  );

  const recordIds = useMemo(() => MOCK_RECORDS.map((r) => r.id), []);

  const selectedRecord = useMemo(
    () => MOCK_RECORDS.find((r) => r.id === selectedRecordId) ?? null,
    [selectedRecordId],
  );

  const handleExpandRecord = useCallback((recordId: string) => {
    setSelectedRecordId(recordId);
    setRecordViewOpen(true);
  }, []);

  const handleCloseRecordView = useCallback(() => {
    setRecordViewOpen(false);
    setSelectedRecordId(null);
  }, []);

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!selectedRecordId) return;
      const idx = recordIds.indexOf(selectedRecordId);
      const nextIdx = direction === 'next'
        ? Math.min(idx + 1, recordIds.length - 1)
        : Math.max(idx - 1, 0);
      setSelectedRecordId(recordIds[nextIdx] ?? null);
    },
    [selectedRecordId, recordIds],
  );

  const toolbarProps = useMemo(
    () => makeToolbarProps(MOCK_FIELDS, MOCK_VIEW_CONFIG),
    [],
  );

  const tabs: { key: PreviewTab; label: string }[] = [
    { key: 'grid', label: 'Grid View' },
    { key: 'card', label: 'Card View' },
    { key: 'record', label: 'Record View' },
  ];

  return (
    <QueryProvider>
    <TooltipProvider>
      <div className="min-h-screen bg-[var(--content-bg)] flex flex-col">
        {/* Header */}
        <header className="border-b border-[var(--border-default)] bg-[var(--panel-bg)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-h2 text-[var(--text-primary)]">
                Dev Preview
              </h1>
              <p className="text-body-sm text-[var(--text-secondary)] mt-1">
                Visual verification — {MOCK_RECORDS.length} records, {MOCK_FIELDS.length} fields
              </p>
            </div>
            <div className="flex gap-1 rounded-lg bg-[var(--surface-secondary)] p-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-body-sm font-medium transition-colors',
                    tab === t.key
                      ? 'bg-white text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 relative">
          {tab === 'grid' && (
            <div className="h-[calc(100vh-81px)]">
              <DataGrid
                records={MOCK_RECORDS}
                fields={MOCK_FIELDS}
                viewConfig={MOCK_VIEW_CONFIG}
                totalCount={MOCK_RECORDS.length}
                isLoading={false}
                error={null}
                userRole="manager"
                activeCell={activeCell}
                editingCell={editingCell}
                density={density}
                frozenColumnCount={MOCK_VIEW_CONFIG.frozenColumns ?? 1}
                columnWidths={columnWidths}
                columnOrder={columnOrder}
                columnColors={{}}
                hiddenFieldIds={new Set()}
                isSortActive={false}
                sorts={[]}
                filteredFieldIds={new Set()}
                onToggleSort={noopStr}
                onSortAscending={noopStr}
                onSortDescending={noopStr}
                onApplyQuickFilter={noopStrStrAny}
                onClearQuickFilter={noopStr}
                onCellClick={(rowId, fieldId) =>
                  setActiveCell({ rowId, fieldId })
                }
                onCellDoubleClick={(rowId, fieldId) =>
                  setEditingCell({ rowId, fieldId })
                }
                onCellStartReplace={(rowId, fieldId) =>
                  setEditingCell({ rowId, fieldId })
                }
                onCellSave={() => setEditingCell(null)}
                onCellCancel={() => setEditingCell(null)}
                onSelectColumn={noopStr}
                editMode="edit"
                selectedRows={selectedRows}
                selectionAnchor={null}
                selectionRange={null}
                setActiveCell={setActiveCell}
                startEditing={(cell, _mode) => setEditingCell(cell)}
                stopEditing={() => setEditingCell(null)}
                setSelectedRows={setSelectedRows}
                setSelectionAnchor={noop}
                setSelectionRange={noop}
                onColumnResize={noop}
                onColumnResizeEnd={noop}
                onColumnReorder={noop}
                onFreezeUpTo={noopStr}
                onUnfreeze={noop}
                onHideField={noopStr}
                onSetColumnColor={noopStrStrNull}
                onRenameField={noopStrStr}
                onExpandRecord={handleExpandRecord}
                isRecordViewOpen={recordViewOpen}
                viewName="All Deals"
                viewType="grid"
                sortPanelProps={toolbarProps.sortPanelProps}
                filterBuilderProps={toolbarProps.filterBuilderProps}
                colorRuleBuilderProps={toolbarProps.colorRuleBuilderProps}
                hideFieldsPanelProps={toolbarProps.hideFieldsPanelProps}
                groupPanelProps={toolbarProps.groupPanelProps}
                onSetDensity={setDensity}
                colorRules={{ row_rules: [], cell_rules: [] }}
                summaryFooterConfig={{ enabled: false, columns: {} }}
              />
            </div>
          )}

          {tab === 'card' && (
            <div className="p-6">
              <CardView
                records={MOCK_RECORDS}
                fields={MOCK_FIELDS}
                viewConfig={MOCK_VIEW_CONFIG}
                totalCount={MOCK_RECORDS.length}
                isLoading={false}
                error={null}
                layout={cardLayout}
                cardColumns={cardColumns}
                visibleFields={visibleFields}
                onSetLayout={setCardLayout}
                onSetCardColumns={setCardColumns}
                onExpandRecord={handleExpandRecord}
                onSaveField={noopStrStrAny}
                groups={[]}
                sorts={[]}
                collapsedGroups={new Set()}
                onToggleGroupCollapsed={noopStr}
                toolbarProps={toolbarProps}
              />
            </div>
          )}

          {tab === 'record' && (
            <div className="p-6">
              <p className="text-body text-[var(--text-secondary)] mb-4">
                Click any row&apos;s expand icon in Grid View, or click a card in Card View, to open the Record View overlay. Or:
              </p>
              <button
                onClick={() => handleExpandRecord(MOCK_RECORDS[0]!.id)}
                className="px-4 py-2 rounded-md bg-[var(--accent-primary)] text-white text-body-sm font-medium hover:opacity-90 transition-opacity"
              >
                Open Record View (first record)
              </button>
            </div>
          )}

          {/* Record View overlay — always mounted, visibility controlled by isOpen */}
          <RecordView
            isOpen={recordViewOpen}
            record={selectedRecord}
            fields={MOCK_FIELDS}
            layout={MOCK_RECORD_VIEW_LAYOUT}
            tableName="Deals"
            viewName="All Deals"
            tableId="00000000-0000-0000-0000-000000000010"
            viewId={null}
            recordIds={recordIds}
            currentRecordId={selectedRecordId}
            onNavigate={handleNavigate}
            onClose={handleCloseRecordView}
            onLayoutChange={noop}
          />
        </main>
      </div>
    </TooltipProvider>
    </QueryProvider>
  );
}
