'use client';

/**
 * RecordViewCanvas — the field canvas for the Record View overlay.
 *
 * Renders fields in a configurable column grid (up to 4 desktop, 2 mobile).
 * Fields are drag-and-drop rearrangeable and adjustable in column span.
 * Uses FieldRenderer for each field.
 *
 * @see docs/reference/tables-and-views.md § Record View — Layout
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { FieldRenderer } from './FieldRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GridField, GridRecord } from '@/lib/types/grid';
import type { RecordViewLayout } from '@/data/record-view-configs';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecordViewCanvasProps {
  record: GridRecord;
  fields: GridField[];
  layout: RecordViewLayout;
  onFieldSave: (fieldId: string, value: unknown) => void;
  onLayoutChange?: (layout: RecordViewLayout) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordViewCanvas({
  record,
  fields,
  layout,
  onFieldSave,
  onLayoutChange,
  readOnly = false,
}: RecordViewCanvasProps) {
  const t = useTranslations('record_view');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);

  // Build a field map for quick lookup
  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  // Filter layout fields to only those that exist in the fields list
  const layoutFields = layout.fields.filter((lf) => fieldMap.has(lf.fieldId));

  // Determine columns based on screen (CSS handles responsive, but cap at layout.columns)
  const columns = layout.columns;

  // ---------------------------------------------------------------------------
  // Drag-and-drop handlers
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      setDragSourceIndex(index);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const sourceIndexStr = e.dataTransfer.getData('text/plain');
      const sourceIndex = parseInt(sourceIndexStr, 10);

      setDragOverIndex(null);
      setDragSourceIndex(null);

      if (isNaN(sourceIndex) || sourceIndex === dropIndex) return;

      // Reorder fields
      const reordered = [...layout.fields];
      const [moved] = reordered.splice(sourceIndex, 1);
      if (!moved) return;
      reordered.splice(dropIndex, 0, moved);

      onLayoutChange?.({
        ...layout,
        fields: reordered,
      });
    },
    [layout, onLayoutChange],
  );

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
    setDragSourceIndex(null);
  }, []);

  if (layoutFields.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        {t('no_fields')}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div
        className={cn('grid gap-2 p-4')}
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {layoutFields.map((layoutField, index) => {
          const field = fieldMap.get(layoutField.fieldId);
          if (!field) return null;

          const isDragOver = dragOverIndex === index;
          const isDragSource = dragSourceIndex === index;

          return (
            <div
              key={layoutField.fieldId}
              className={cn(
                'relative',
                isDragOver && 'ring-2 ring-accent/50 rounded-md',
                isDragSource && 'opacity-40',
              )}
              style={{
                gridColumn: `span ${Math.min(layoutField.columnSpan, columns)} / span ${Math.min(layoutField.columnSpan, columns)}`,
              }}
              draggable={!readOnly}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <FieldRenderer
                field={field}
                record={record}
                onSave={onFieldSave}
                columnSpan={1}
                readOnly={readOnly}
              />
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
