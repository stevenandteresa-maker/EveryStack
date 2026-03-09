'use client';

/**
 * SortPanel — multi-level sort configuration panel.
 *
 * Allows users to add, remove, reorder, and configure sort levels.
 * Max 3 levels for MVP (soft limit, shows warning at 4+).
 *
 * @see docs/reference/tables-and-views.md § Sorting
 */

import { memo, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical, Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GridField, SortLevel } from '@/lib/types/grid';
import { MAX_SORT_LEVELS } from './use-sort';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SortPanelProps {
  sorts: SortLevel[];
  fields: GridField[];
  onAddSort: (fieldId: string, direction: 'asc' | 'desc') => void;
  onRemoveSort: (fieldId: string) => void;
  onUpdateDirection: (fieldId: string, direction: 'asc' | 'desc') => void;
  onUpdateField: (index: number, fieldId: string) => void;
  onReorderSorts: (fromIndex: number, toIndex: number) => void;
  onClearSorts: () => void;
  isAtLimit: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SortPanel = memo(function SortPanel({
  sorts,
  fields,
  onAddSort,
  onRemoveSort,
  onUpdateDirection,
  onUpdateField,
  onReorderSorts,
  onClearSorts,
  isAtLimit,
}: SortPanelProps) {
  const t = useTranslations('grid.sort_panel');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Fields available for adding a new sort (exclude already-sorted fields)
  const sortedFieldIds = new Set(sorts.map((s) => s.fieldId));
  const availableFields = fields.filter((f) => !sortedFieldIds.has(f.id));

  const handleAddSort = useCallback(() => {
    const firstAvailable = availableFields[0];
    if (firstAvailable) {
      onAddSort(firstAvailable.id, 'asc');
    }
  }, [availableFields, onAddSort]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropIndex(index);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== toIndex) {
        onReorderSorts(dragIndex, toIndex);
      }
      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, onReorderSorts],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  return (
    <div
      className="w-80 rounded-lg border bg-white shadow-lg p-3"
      role="region"
      aria-label={t('title')}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-700">
          {t('title')}
        </span>
        {sorts.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onClearSorts}
          >
            {t('clear_all')}
          </Button>
        )}
      </div>

      {/* Sort levels */}
      {sorts.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">{t('empty')}</p>
      ) : (
        <div className="space-y-1">
          {sorts.map((sort, index) => {
            const field = fields.find((f) => f.id === sort.fieldId);
            // Available fields for this row: current field + unsorted fields
            const rowAvailableFields = fields.filter(
              (f) => f.id === sort.fieldId || !sortedFieldIds.has(f.id),
            );

            return (
              <div
                key={sort.fieldId}
                className={`flex items-center gap-1.5 rounded px-1 py-1 ${
                  dropIndex === index && dragIndex !== index
                    ? 'bg-blue-50'
                    : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {/* Drag handle */}
                <GripVertical
                  className="h-3.5 w-3.5 shrink-0 text-slate-400 cursor-grab"
                  aria-hidden
                />

                {/* Sort level number */}
                <span className="text-[10px] text-slate-400 shrink-0 w-3 text-center">
                  {index + 1}
                </span>

                {/* Field selector */}
                <Select
                  value={sort.fieldId}
                  onValueChange={(value) => onUpdateField(index, value)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                    <SelectValue>
                      {field?.name ?? t('unknown_field')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {rowAvailableFields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Direction toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() =>
                    onUpdateDirection(
                      sort.fieldId,
                      sort.direction === 'asc' ? 'desc' : 'asc',
                    )
                  }
                  aria-label={
                    sort.direction === 'asc'
                      ? t('direction_asc')
                      : t('direction_desc')
                  }
                >
                  {sort.direction === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                </Button>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0 text-slate-400 hover:text-slate-600"
                  onClick={() => onRemoveSort(sort.fieldId)}
                  aria-label={t('remove')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Warning at limit */}
      {isAtLimit && (
        <p className="text-[10px] text-amber-600 mt-1.5">
          {t('limit_warning', { max: MAX_SORT_LEVELS })}
        </p>
      )}

      {/* Add sort button */}
      {availableFields.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 w-full text-xs justify-start gap-1.5"
          onClick={handleAddSort}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('add_sort')}
        </Button>
      )}
    </div>
  );
});
