'use client';

/**
 * InlineSubTable — embedded mini-grid for Linked Record fields.
 *
 * Renders within Record View when a Linked Record field has
 * `display.style = 'inline_table'`. Shows linked records as
 * an editable table with configured columns.
 *
 * @see docs/reference/tables-and-views.md § Inline Sub-Table Display
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InlineSubTableRow, CreationRow } from './InlineSubTableRow';
import {
  useInlineSubTable,
  type InlineSubTableConfig,
} from './use-inline-sub-table';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import type { DbRecord, Field } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InlineSubTableProps {
  /** Field name for the section header */
  fieldName: string;
  /** Parent record ID */
  recordId: string;
  /** The linked record field ID */
  fieldId: string;
  /** Display config from the field */
  config: InlineSubTableConfig;
  /** Linked records fetched from cross_link_index */
  linkedRecords: DbRecord[];
  /** Fields from the target table */
  targetFields: Field[];
  /** Whether the user can create records (stub: roleAtLeast('manager')) */
  canCreate: boolean;
  /** Whether the user can delete links (stub: roleAtLeast('manager')) */
  canDelete: boolean;
  /** Whether the entire widget is read-only */
  readOnly?: boolean;
  /** Called when a linked record cell is edited */
  onUpdateLinkedRecord?: (
    targetRecordId: string,
    fieldId: string,
    value: unknown,
  ) => void;
  /** Called when a new record should be created and linked */
  onCreateRecord?: (canonicalData: Record<string, unknown>) => void;
  /** Called when a link should be removed */
  onDeleteLink?: (targetRecordId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineSubTable({
  fieldName,
  recordId,
  fieldId,
  config,
  linkedRecords,
  targetFields,
  canCreate,
  canDelete,
  readOnly = false,
  onUpdateLinkedRecord,
  onCreateRecord,
  onDeleteLink,
}: InlineSubTableProps) {
  const t = useTranslations('record_view.inline_sub_table');
  const isMobile = useMediaQuery('(max-width: 767px)');

  const {
    visibleColumns,
    columnWidths,
    filteredRows,
    isExpanded,
    totalCount,
    visibleCount,
    searchQuery,
    isCreating,
    creationRowData,
    setSearchQuery,
    toggleExpanded,
    startCreating,
    cancelCreating,
    updateCreationCell,
    confirmCreation,
    handleCellEdit,
    handleDeleteRow,
  } = useInlineSubTable({
    recordId,
    fieldId,
    config,
    linkedRecords,
    targetFields,
    canCreate: canCreate && config.allow_inline_create && !readOnly,
    canDelete: canDelete && config.allow_inline_delete && !readOnly,
    onCreateRecord,
    onDeleteLink,
    onUpdateLinkedRecord,
  });

  // Calculate total table width (before early return for hooks rules)
  const totalWidth = useMemo(
    () =>
      visibleColumns.reduce(
        (sum, col) => sum + (columnWidths[col.id] ?? 150),
        0,
      ) + (canDelete && config.allow_inline_delete ? 28 : 0),
    [visibleColumns, columnWidths, canDelete, config.allow_inline_delete],
  );

  const showExpand = totalCount > config.max_visible_rows;

  // Mobile: compact summary with action links
  if (isMobile) {
    return (
      <InlineSubTableMobile
        fieldName={fieldName}
        totalCount={totalCount}
        canCreate={canCreate && config.allow_inline_create && !readOnly}
        onAddClick={startCreating}
      />
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {/* Header: field name + search */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
        <span className="text-xs font-medium text-foreground truncate">
          {fieldName}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('item_count', { count: totalCount })}
        </span>
        <div className="flex-1" />
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Column headers */}
      {visibleColumns.length > 0 && (
        <ScrollArea className="overflow-x-auto">
          <div style={{ minWidth: totalWidth }}>
            <div
              className="flex items-center border-b border-border bg-muted/10"
              role="row"
            >
              {visibleColumns.map((column) => (
                <div
                  key={column.id}
                  className="flex items-center px-2 py-1 text-xs font-medium text-muted-foreground border-r border-border last:border-r-0 truncate shrink-0"
                  style={{ width: columnWidths[column.id] ?? 150 }}
                  role="columnheader"
                >
                  {column.name}
                </div>
              ))}
              {canDelete && config.allow_inline_delete && (
                <div className="w-7 shrink-0" />
              )}
            </div>

            {/* Rows */}
            <div role="rowgroup">
              {filteredRows.length === 0 && !isCreating ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  {config.empty_state_text || t('no_items')}
                </div>
              ) : (
                filteredRows.map((record) => (
                  <InlineSubTableRow
                    key={record.id}
                    record={record}
                    columns={visibleColumns}
                    columnWidths={columnWidths}
                    canDelete={
                      canDelete && config.allow_inline_delete && !readOnly
                    }
                    readOnly={readOnly}
                    onCellEdit={handleCellEdit}
                    onDelete={handleDeleteRow}
                  />
                ))
              )}

              {/* Creation row */}
              {isCreating && (
                <CreationRow
                  columns={visibleColumns}
                  columnWidths={columnWidths}
                  data={creationRowData}
                  onCellChange={updateCreationCell}
                  onConfirm={confirmCreation}
                  onCancel={cancelCreating}
                />
              )}
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Footer: add row + expand/collapse */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border">
        {canCreate && config.allow_inline_create && !readOnly && !isCreating && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={startCreating}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('add_row')}
          </Button>
        )}
        <div className="flex-1" />
        {showExpand && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={toggleExpanded}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                {t('show_less')}
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                {t('show_more', { count: totalCount - visibleCount })}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile compact summary
// ---------------------------------------------------------------------------

interface InlineSubTableMobileProps {
  fieldName: string;
  totalCount: number;
  canCreate: boolean;
  onAddClick: () => void;
}

function InlineSubTableMobile({
  fieldName,
  totalCount,
  canCreate,
  onAddClick,
}: InlineSubTableMobileProps) {
  const t = useTranslations('record_view.inline_sub_table');

  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs font-medium text-foreground">{fieldName}</div>
      <div className="text-sm text-muted-foreground mt-1">
        {t('item_count', { count: totalCount })}
      </div>
      <div className="flex gap-2 mt-2">
        <Button variant="outline" size="sm" className="h-8 text-xs">
          {t('view_all')}
        </Button>
        {canCreate && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={onAddClick}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('add')}
          </Button>
        )}
      </div>
    </div>
  );
}
