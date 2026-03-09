'use client';

/**
 * RecordView — the overlay for viewing/editing a single record.
 *
 * Slides in from the right at 60% width. Grid stays visible behind
 * a dimmed overlay (bg-black/20). Closes on ✕, Escape, or click-outside.
 *
 * @see docs/reference/tables-and-views.md § Record View
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { RecordViewHeader } from './RecordViewHeader';
import { RecordViewCanvas } from './RecordViewCanvas';
import { Skeleton } from '@/components/ui/skeleton';
import { useOptimisticRecord } from '@/lib/hooks/use-optimistic-record';
import type { GridField, GridRecord } from '@/lib/types/grid';
import type { RecordViewLayout } from '@/data/record-view-configs';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecordViewProps {
  /** Whether the overlay is open */
  isOpen: boolean;
  /** The record to display */
  record: GridRecord | null;
  /** All fields for the table */
  fields: GridField[];
  /** Record View layout config */
  layout: RecordViewLayout | null;
  /** Table name for breadcrumb */
  tableName: string;
  /** View name for breadcrumb */
  viewName: string;
  /** Table ID for optimistic updates */
  tableId: string;
  /** View ID for optimistic updates */
  viewId: string | null;
  /** Ordered record IDs for navigation */
  recordIds: string[];
  /** Current record ID */
  currentRecordId: string | null;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Navigate prev/next */
  onNavigate: (direction: 'prev' | 'next') => void;
  /** Close the overlay */
  onClose: () => void;
  /** Layout changed (drag reorder) */
  onLayoutChange?: (layout: RecordViewLayout) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordView({
  isOpen,
  record,
  fields,
  layout,
  tableName,
  viewName,
  tableId,
  viewId,
  recordIds,
  currentRecordId,
  isLoading = false,
  onNavigate,
  onClose,
  onLayoutChange,
}: RecordViewProps) {
  const t = useTranslations('record_view');
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { updateCell } = useOptimisticRecord(tableId, viewId);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside (on the dimmed overlay)
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the overlay itself, not the panel
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const handleFieldSave = useCallback(
    (fieldId: string, value: unknown) => {
      if (!currentRecordId) return;
      updateCell(currentRecordId, fieldId, value);
    },
    [currentRecordId, updateCell],
  );

  // Calculate navigation state
  const currentIndex = currentRecordId
    ? recordIds.indexOf(currentRecordId)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < recordIds.length - 1;

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-40',
        'bg-black/20',
        'transition-opacity duration-200 ease-out',
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={t('overlay_label')}
    >
      {/* Record View panel */}
      <div
        ref={panelRef}
        className={cn(
          'absolute right-0 top-0 h-full bg-background shadow-xl',
          'flex flex-col',
          'transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{ width: '60%', minWidth: '400px', maxWidth: '1200px' }}
      >
        {isLoading ? (
          <RecordViewSkeleton />
        ) : record && layout ? (
          <>
            <RecordViewHeader
              record={record}
              fields={fields}
              tableName={tableName}
              viewName={viewName}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onNavigate={onNavigate}
              onClose={onClose}
            />
            <RecordViewCanvas
              record={record}
              fields={fields}
              layout={layout}
              onFieldSave={handleFieldSave}
              onLayoutChange={onLayoutChange}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('record_not_found')}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

function RecordViewSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>

      {/* Field skeletons */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1 p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
