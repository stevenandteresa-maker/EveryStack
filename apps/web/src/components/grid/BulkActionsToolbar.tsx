'use client';

/**
 * BulkActionsToolbar — appears when 2+ rows are selected.
 * Actions: Delete, Edit field value, Duplicate, Copy, Clear selection.
 *
 * @see docs/reference/tables-and-views.md § Selection & Bulk Actions
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { X, Trash2, Pencil, Copy, CopyPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BulkActionsToolbarProps {
  selectedCount: number;
  fields: GridField[];
  /** When true, compress to icon-only strip (used when Record View is open) */
  compact?: boolean;
  onDelete: () => void;
  onBulkUpdateField: (fieldId: string, value: unknown) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onClearSelection: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkActionsToolbar({
  selectedCount,
  fields,
  compact = false,
  onDelete,
  onBulkUpdateField,
  onDuplicate,
  onCopy,
  onClearSelection,
}: BulkActionsToolbarProps) {
  const t = useTranslations('grid.bulk');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editFieldId, setEditFieldId] = useState<string>('');
  const [editValue, setEditValue] = useState('');
  const [editPopoverOpen, setEditPopoverOpen] = useState(false);

  const editableFields = fields.filter((f) => !f.readOnly && !f.isSystem);

  const handleDeleteClick = useCallback(() => {
    if (selectedCount >= 2) {
      setShowDeleteDialog(true);
    }
  }, [selectedCount]);

  const handleDeleteConfirm = useCallback(() => {
    onDelete();
    setShowDeleteDialog(false);
  }, [onDelete]);

  const handleEditApply = useCallback(() => {
    if (!editFieldId) return;
    onBulkUpdateField(editFieldId, editValue || null);
    setEditPopoverOpen(false);
    setEditFieldId('');
    setEditValue('');
  }, [editFieldId, editValue, onBulkUpdateField]);

  const handleDuplicate = useCallback(() => {
    onDuplicate();
    toast(t('duplicated', { count: selectedCount }));
  }, [onDuplicate, t, selectedCount]);

  const handleCopy = useCallback(() => {
    onCopy();
    toast(t('copied'));
  }, [onCopy, t]);

  if (selectedCount < 2) return null;

  // Compact mode: icon-only strip with selection count badge
  if (compact) {
    return (
      <>
        <div
          className="flex items-center gap-1 px-2 py-1 border-b"
          style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          role="toolbar"
          aria-label={t('toolbar_label')}
        >
          {/* Selection count badge */}
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-blue-600 text-white text-xs font-medium">
            {selectedCount}
          </span>

          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDeleteClick}
            aria-label={t('delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {/* Duplicate */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleDuplicate}
            aria-label={t('duplicate')}
          >
            <CopyPlus className="h-3.5 w-3.5" />
          </Button>

          {/* Copy */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleCopy}
            aria-label={t('copy')}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>

          <div className="flex-1" />

          {/* Clear selection */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onClearSelection}
            aria-label={t('clear_selection')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Bulk delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('delete_title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('delete_description', { count: selectedCount })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('delete_cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDeleteConfirm}
              >
                {t('delete_confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b"
        style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
        role="toolbar"
        aria-label={t('toolbar_label')}
      >
        {/* Selection count */}
        <span className="text-sm font-medium text-blue-700">
          {t('selected_count', { count: selectedCount })}
        </span>

        <div className="flex items-center gap-1 ml-2">
          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('delete')}
          </Button>

          {/* Edit field value */}
          <Popover open={editPopoverOpen} onOpenChange={setEditPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('edit_field')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <div className="flex flex-col gap-2">
                <Select value={editFieldId} onValueChange={setEditFieldId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t('pick_field')} />
                  </SelectTrigger>
                  <SelectContent>
                    {editableFields.map((field) => (
                      <SelectItem key={field.id} value={field.id} className="text-xs">
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 text-xs"
                  placeholder={t('new_value')}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditApply();
                  }}
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleEditApply}
                  disabled={!editFieldId}
                >
                  {t('apply')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Duplicate */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleDuplicate}
          >
            <CopyPlus className="h-3.5 w-3.5" />
            {t('duplicate')}
          </Button>

          {/* Copy */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
            {t('copy')}
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear selection */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onClearSelection}
          aria-label={t('clear_selection')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_description', { count: selectedCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteConfirm}
            >
              {t('delete_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
