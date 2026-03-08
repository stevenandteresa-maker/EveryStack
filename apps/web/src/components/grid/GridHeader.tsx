'use client';

/**
 * GridHeader — renders column headers with field type icon, name,
 * sort/filter indicator placeholders, resize handles, right-click
 * context menu, drag-to-reorder, and column coloring.
 *
 * @see docs/reference/tables-and-views.md § Column Behavior
 */

import { memo, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Header } from '@tanstack/react-table';
import type { EffectiveRole } from '@everystack/shared/auth';
import { roleAtLeast } from '@everystack/shared/auth';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ColumnResizer } from './ColumnResizer';
import { ColumnHeaderMenu } from './ColumnHeaderMenu';
import {
  GRID_TOKENS,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_WIDTH,
  DRAG_HANDLE_WIDTH,
} from './grid-types';
import type { GridRecord, GridField } from '@/lib/types/grid';
import { DATA_COLORS } from '@/lib/design-system/colors';

// ---------------------------------------------------------------------------
// Field type icon map (simple text abbreviations)
// ---------------------------------------------------------------------------

const FIELD_TYPE_ICONS: Record<string, string> = {
  text: 'Aa',
  textarea: 'Aa',
  number: '#',
  currency: '$',
  percent: '%',
  date: 'D',
  datetime: 'DT',
  checkbox: '☑',
  rating: '★',
  single_select: '▾',
  multi_select: '▾▾',
  people: '👤',
  phone: '📞',
  email: '@',
  url: '🔗',
  attachment: '📎',
  linked_record: '↗',
  smart_doc: '📄',
  barcode: '|||',
  duration: '⏱',
};

function getFieldTypeIcon(fieldType: string): string {
  return FIELD_TYPE_ICONS[fieldType] ?? '?';
}

// ---------------------------------------------------------------------------
// Resolve column color background from color name
// ---------------------------------------------------------------------------

function getColumnColorBg(colorName: string | undefined): string | undefined {
  if (!colorName) return undefined;
  const color = DATA_COLORS.find((c) => c.name === colorName);
  return color?.light;
}

// ---------------------------------------------------------------------------
// GridHeader component
// ---------------------------------------------------------------------------

export interface GridHeaderProps {
  headers: Header<GridRecord, unknown>[];
  fields: GridField[];
  frozenFieldIds: string[];
  showAddColumn: boolean;
  addColumnWidth: number;
  userRole: EffectiveRole;
  columnColors: Record<string, string>;
  onSelectColumn: (fieldId: string) => void;
  onStartResize: (fieldId: string, width: number, e: React.MouseEvent) => void;
  onDragStart: (fieldId: string, e: React.DragEvent) => void;
  onDragOver: (fieldId: string, e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (fieldId: string, e: React.DragEvent) => void;
  onFreezeUpTo: (fieldId: string) => void;
  onUnfreeze: () => void;
  onHideField: (fieldId: string) => void;
  onSetColumnColor: (fieldId: string, colorName: string | null) => void;
  onRenameField: (fieldId: string, newName: string) => void;
}

export const GridHeader = memo(function GridHeader({
  headers,
  fields,
  frozenFieldIds,
  showAddColumn,
  addColumnWidth,
  userRole,
  columnColors,
  onSelectColumn,
  onStartResize,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onFreezeUpTo,
  onUnfreeze,
  onHideField,
  onSetColumnColor,
  onRenameField,
}: GridHeaderProps) {
  const t = useTranslations('grid');

  return (
    <div
      className="sticky top-0 z-20 flex"
      role="row"
      style={{ backgroundColor: GRID_TOKENS.panelBg }}
    >
      {/* Drag handle spacer */}
      <div
        className="shrink-0 border-r border-b"
        style={{
          width: DRAG_HANDLE_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
        }}
      />

      {/* Checkbox header */}
      <div
        className="shrink-0 flex items-center justify-center border-r border-b"
        style={{
          width: CHECKBOX_COLUMN_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
        }}
      >
        <Checkbox aria-label={t('checkbox_select_all')} />
      </div>

      {/* Row number header */}
      <div
        className="shrink-0 flex items-center justify-center border-r border-b text-xs font-medium"
        style={{
          width: ROW_NUMBER_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
          color: GRID_TOKENS.textSecondary,
        }}
      >
        #
      </div>

      {/* Data column headers */}
      {headers.map((header) => {
        const field = fields.find((f) => f.id === header.column.id);
        if (!field) return null;

        const isFrozen = frozenFieldIds.includes(field.id);

        return (
          <ColumnHeader
            key={header.id}
            field={field}
            width={header.getSize()}
            isFrozen={isFrozen}
            userRole={userRole}
            columnColors={columnColors}
            onSelect={() => onSelectColumn(field.id)}
            onStartResize={onStartResize}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onFreezeUpTo={onFreezeUpTo}
            onUnfreeze={onUnfreeze}
            onHideField={onHideField}
            onSetColumnColor={onSetColumnColor}
            onRenameField={onRenameField}
          />
        );
      })}

      {/* "+" column header */}
      {showAddColumn && (
        <div
          className="shrink-0 flex items-center justify-center border-r border-b text-xs"
          style={{
            width: addColumnWidth,
            borderColor: GRID_TOKENS.borderDefault,
            color: GRID_TOKENS.textSecondary,
          }}
        >
          <button
            className="flex h-full w-full items-center justify-center hover:bg-slate-200 transition-colors"
            aria-label={t('add_field')}
            type="button"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Individual column header
// ---------------------------------------------------------------------------

interface ColumnHeaderProps {
  field: GridField;
  width: number;
  isFrozen: boolean;
  userRole: EffectiveRole;
  columnColors: Record<string, string>;
  onSelect: () => void;
  onStartResize: (fieldId: string, width: number, e: React.MouseEvent) => void;
  onDragStart: (fieldId: string, e: React.DragEvent) => void;
  onDragOver: (fieldId: string, e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (fieldId: string, e: React.DragEvent) => void;
  onFreezeUpTo: (fieldId: string) => void;
  onUnfreeze: () => void;
  onHideField: (fieldId: string) => void;
  onSetColumnColor: (fieldId: string, colorName: string | null) => void;
  onRenameField: (fieldId: string, newName: string) => void;
}

const ColumnHeader = memo(function ColumnHeader({
  field,
  width,
  isFrozen,
  userRole,
  columnColors,
  onSelect,
  onStartResize,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onFreezeUpTo,
  onUnfreeze,
  onHideField,
  onSetColumnColor,
  onRenameField,
}: ColumnHeaderProps) {
  const t = useTranslations('grid');
  const isManager = roleAtLeast(userRole, 'manager');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(field.name);

  const handleClick = useCallback(() => {
    if (!isRenaming) {
      onSelect();
    }
  }, [onSelect, isRenaming]);

  const handleDoubleClick = useCallback(() => {
    if (isManager) {
      setIsRenaming(true);
      setRenameValue(field.name);
    }
  }, [isManager, field.name]);

  const handleRenameConfirm = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== field.name) {
      onRenameField(field.id, trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, field.name, field.id, onRenameField]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRenameConfirm();
      }
      if (e.key === 'Escape') {
        setIsRenaming(false);
        setRenameValue(field.name);
      }
    },
    [handleRenameConfirm, field.name],
  );

  const colorBg = getColumnColorBg(columnColors[field.id]);

  return (
    <ColumnHeaderMenu
      fieldId={field.id}
      fieldName={field.name}
      isPrimary={field.isPrimary}
      isFrozen={isFrozen}
      userRole={userRole}
      columnColors={columnColors}
      onFreezeUpTo={onFreezeUpTo}
      onUnfreeze={onUnfreeze}
      onHideField={onHideField}
      onSetColumnColor={onSetColumnColor}
      onRenameField={onRenameField}
    >
      <div
        role="columnheader"
        className={cn(
          'shrink-0 flex items-center gap-1.5 px-3 py-2 border-r border-b',
          'text-xs font-medium select-none cursor-pointer relative',
          'hover:bg-slate-200 transition-colors',
          isFrozen && 'sticky z-10',
        )}
        style={{
          width,
          borderColor: GRID_TOKENS.borderDefault,
          color: GRID_TOKENS.textSecondary,
          backgroundColor: colorBg ?? undefined,
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        aria-label={t('header_select_column', { name: field.name })}
        draggable={!field.isPrimary && !isRenaming}
        onDragStart={(e) => onDragStart(field.id, e)}
        onDragOver={(e) => onDragOver(field.id, e)}
        onDragEnd={onDragEnd}
        onDrop={(e) => onDrop(field.id, e)}
      >
        <span className="shrink-0 text-[10px] font-mono opacity-60">
          {getFieldTypeIcon(field.fieldType)}
        </span>

        {isRenaming ? (
          <input
            type="text"
            className="flex-1 min-w-0 border rounded px-1 py-0 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameConfirm}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate">{field.name}</span>
        )}

        {/* Resize handle */}
        <ColumnResizer
          fieldId={field.id}
          width={width}
          onStartResize={onStartResize}
        />
      </div>
    </ColumnHeaderMenu>
  );
});
