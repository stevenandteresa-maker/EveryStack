'use client';

/**
 * RecordViewCanvas — the field canvas for the Record View overlay.
 *
 * Renders fields in a configurable column grid (up to 4 desktop, 1 mobile).
 * Fields are drag-and-drop rearrangeable. Supports tab filtering:
 * when a tab is active, only fields assigned to that tab are shown.
 *
 * @see docs/reference/tables-and-views.md § Record View — Layout
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { FieldRenderer } from './FieldRenderer';
import { DEFAULT_TAB_ID } from './RecordViewTabs';
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
  activeTabId?: string;
  onFieldSave: (fieldId: string, value: unknown) => void;
  onLayoutChange?: (layout: RecordViewLayout) => void;
  onNavigateToLinkedRecord?: (recordId: string) => void;
  readOnly?: boolean;
  /** Field IDs that are hidden due to field-level permissions. */
  hiddenFieldIds?: Set<string>;
  /** Field IDs that are read-only due to field-level permissions. */
  readOnlyFieldIds?: Set<string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordViewCanvas({
  record,
  fields,
  layout,
  activeTabId,
  onFieldSave,
  onLayoutChange,
  onNavigateToLinkedRecord,
  readOnly = false,
  hiddenFieldIds,
  readOnlyFieldIds,
}: RecordViewCanvasProps) {
  const t = useTranslations('record_view');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const fieldRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Build a field map for quick lookup
  const fieldMap = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);

  // Filter layout fields: only those in the fields list, not hidden by permissions, and matching the active tab
  const layoutFields = layout.fields.filter((lf) => {
    if (!fieldMap.has(lf.fieldId)) return false;
    if (hiddenFieldIds?.has(lf.fieldId)) return false;
    // Tab filtering: null tab means "default tab", specific tab IDs for custom tabs
    if (activeTabId && activeTabId !== DEFAULT_TAB_ID) {
      return lf.tab === activeTabId;
    }
    // Default tab: show fields with tab === null
    return !lf.tab;
  });

  // Determine columns based on layout config
  const columns = layout.columns;

  // ---------------------------------------------------------------------------
  // Tab key navigation between fields
  // ---------------------------------------------------------------------------

  const handleFieldTab = useCallback(
    (fieldId: string) => {
      const currentIdx = layoutFields.findIndex(
        (lf) => lf.fieldId === fieldId,
      );
      if (currentIdx === -1) return;

      // Find next editable field
      for (let i = currentIdx + 1; i < layoutFields.length; i++) {
        const nextField = layoutFields[i];
        if (!nextField) continue;
        const field = fieldMap.get(nextField.fieldId);
        if (field && !field.readOnly) {
          const el = fieldRefs.current.get(nextField.fieldId);
          if (el) {
            const focusable = el.querySelector<HTMLElement>(
              '[tabindex="0"], [role="button"]',
            );
            focusable?.click();
          }
          return;
        }
      }
    },
    [layoutFields, fieldMap],
  );

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
              ref={(el) => {
                if (el) {
                  fieldRefs.current.set(layoutField.fieldId, el);
                } else {
                  fieldRefs.current.delete(layoutField.fieldId);
                }
              }}
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
                readOnly={readOnly || !!readOnlyFieldIds?.has(field.id)}
                onNavigateToLinkedRecord={onNavigateToLinkedRecord}
                onTab={() => handleFieldTab(layoutField.fieldId)}
              />
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
