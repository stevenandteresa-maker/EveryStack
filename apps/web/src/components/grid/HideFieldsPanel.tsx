'use client';

/**
 * HideFieldsPanel — toggle field visibility, drag-to-reorder, show/hide all.
 *
 * Primary field is always visible (disabled toggle).
 * Hidden fields stored in views.config.hidden_fields.
 *
 * @see docs/reference/tables-and-views.md § Grid Toolbar
 */

import { memo, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HideFieldsPanelProps {
  fields: GridField[];
  hiddenFieldIds: Set<string>;
  fieldOrder: string[];
  onToggleField: (fieldId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onReorderFields: (newOrder: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const HideFieldsPanel = memo(function HideFieldsPanel({
  fields,
  hiddenFieldIds,
  fieldOrder,
  onToggleField,
  onShowAll,
  onHideAll,
  onReorderFields,
}: HideFieldsPanelProps) {
  const t = useTranslations('grid.toolbar');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Order fields by fieldOrder, falling back to sort_order
  const orderedFields = [...fields].sort((a, b) => {
    const aIdx = fieldOrder.indexOf(a.id);
    const bIdx = fieldOrder.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.sortOrder - b.sortOrder;
  });

  const visibleCount = fields.length - hiddenFieldIds.size;
  const allVisible = hiddenFieldIds.size === 0;
  // Count non-primary fields for "all hidden" check
  const nonPrimaryCount = fields.filter((f) => !f.isPrimary).length;
  const allHidden = hiddenFieldIds.size >= nonPrimaryCount;

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      // Don't allow dragging the primary field
      const field = orderedFields[index];
      if (field?.isPrimary) {
        e.preventDefault();
        return;
      }
      setDragIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    [orderedFields],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropIndex(index);
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === targetIndex) {
        handleDragEnd();
        return;
      }

      const newOrder = orderedFields.map((f) => f.id);
      const [moved] = newOrder.splice(dragIndex, 1);
      if (moved) {
        newOrder.splice(targetIndex, 0, moved);
        onReorderFields(newOrder);
      }
      handleDragEnd();
    },
    [dragIndex, orderedFields, onReorderFields, handleDragEnd],
  );

  return (
    <div className="p-3 space-y-2 max-h-80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{t('hide_fields_title')}</span>
        <span className="text-xs text-muted-foreground">
          {t('hide_fields_count', { visible: visibleCount, total: fields.length })}
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs flex-1"
          onClick={onShowAll}
          disabled={allVisible}
        >
          {t('show_all')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs flex-1"
          onClick={onHideAll}
          disabled={allHidden}
        >
          {t('hide_all')}
        </Button>
      </div>

      <Separator />

      {/* Field list */}
      <div className="flex-1 overflow-y-auto space-y-0.5" role="list" aria-label={t('hide_fields_title')}>
        {orderedFields.map((field, index) => {
          const isHidden = hiddenFieldIds.has(field.id);
          const isPrimary = field.isPrimary;
          const isDragging = dragIndex === index;
          const isDropTarget = dropIndex === index;

          return (
            <div
              key={field.id}
              role="listitem"
              className={`flex items-center gap-2 px-1 py-1 rounded text-xs ${
                isDragging ? 'opacity-50' : ''
              } ${isDropTarget ? 'bg-accent/30' : ''} ${
                isPrimary ? 'text-muted-foreground' : ''
              }`}
              draggable={!isPrimary}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, index)}
            >
              {/* Drag handle */}
              <GripVertical
                className={`h-3 w-3 shrink-0 ${isPrimary ? 'invisible' : 'text-muted-foreground cursor-grab'}`}
              />

              {/* Field name */}
              <span className="flex-1 truncate">{field.name}</span>

              {/* Toggle button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onToggleField(field.id)}
                disabled={isPrimary}
                aria-label={
                  isPrimary
                    ? t('primary_always_visible')
                    : isHidden
                      ? t('show_field', { name: field.name })
                      : t('hide_field', { name: field.name })
                }
              >
                {isHidden ? (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
});
