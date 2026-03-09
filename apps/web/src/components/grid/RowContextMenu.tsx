'use client';

/**
 * RowContextMenu — right-click context menu for grid rows.
 *
 * 9 items as specified in tables-and-views.md § Row Right-Click Menu:
 * 1. Expand record (placeholder — 3A-ii)
 * 2. Copy record / Duplicate record / Delete record
 * 3. ── separator ──
 * 4. Insert row above / Insert row below
 * 5. ── separator ──
 * 6. Copy cell value / Paste / Clear cell value
 * 7. ── separator ──
 * 8. Copy record link
 * 9. Print / export this record (placeholder)
 *
 * @see docs/reference/tables-and-views.md lines 221–232
 */

import { useTranslations } from 'next-intl';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RowContextMenuProps {
  children: React.ReactNode;
  recordId: string;
  onExpandRecord: (recordId: string) => void;
  onCopyRecord: (recordId: string) => void;
  onDuplicateRecord: (recordId: string) => void;
  onDeleteRecord: (recordId: string) => void;
  onInsertAbove: (recordId: string) => void;
  onInsertBelow: (recordId: string) => void;
  onCopyCellValue: () => void;
  onPaste: () => void;
  onClearCellValue: () => void;
  onCopyRecordLink: (recordId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RowContextMenu({
  children,
  recordId,
  onExpandRecord,
  onCopyRecord,
  onDuplicateRecord,
  onDeleteRecord,
  onInsertAbove,
  onInsertBelow,
  onCopyCellValue,
  onPaste,
  onClearCellValue,
  onCopyRecordLink,
}: RowContextMenuProps) {
  const t = useTranslations('grid.row_menu');

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* 1. Expand record (placeholder — 3A-ii) */}
        <ContextMenuItem
          disabled
          onSelect={() => onExpandRecord(recordId)}
        >
          {t('expand_record')}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* 2. Copy / Duplicate / Delete */}
        <ContextMenuItem onSelect={() => onCopyRecord(recordId)}>
          {t('copy_record')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onDuplicateRecord(recordId)}>
          {t('duplicate_record')}
        </ContextMenuItem>
        <ContextMenuItem
          className="text-red-600 focus:text-red-600"
          onSelect={() => onDeleteRecord(recordId)}
        >
          {t('delete_record')}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* 4. Insert row above / below */}
        <ContextMenuItem onSelect={() => onInsertAbove(recordId)}>
          {t('insert_above')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onInsertBelow(recordId)}>
          {t('insert_below')}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* 6. Copy cell value / Paste / Clear */}
        <ContextMenuItem onSelect={onCopyCellValue}>
          {t('copy_cell_value')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onPaste}>
          {t('paste')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onClearCellValue}>
          {t('clear_cell_value')}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* 8. Copy record link */}
        <ContextMenuItem onSelect={() => onCopyRecordLink(recordId)}>
          {t('copy_record_link')}
        </ContextMenuItem>

        {/* 9. Print / export (placeholder) */}
        <ContextMenuItem disabled>
          {t('print_export')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
