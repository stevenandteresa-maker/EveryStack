'use client';

/**
 * RecordView — the overlay for viewing/editing a single record.
 *
 * Slides in from the right at 60% width on desktop/tablet.
 * At <768px, renders as a full-screen sheet (single column).
 * Grid stays visible behind a dimmed overlay on larger screens.
 * Closes on ✕, Escape, or click-outside.
 *
 * Supports multi-tab layouts, linked record navigation stack,
 * config picker, and responsive behavior.
 *
 * @see docs/reference/tables-and-views.md § Record View
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { RecordViewHeader } from './RecordViewHeader';
import { RecordViewCanvas } from './RecordViewCanvas';
import { RecordViewTabs, DEFAULT_TAB_ID } from './RecordViewTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useOptimisticRecord } from '@/lib/hooks/use-optimistic-record';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { generateUUIDv7 } from '@everystack/shared/db';
import type { ConfigOption } from './RecordViewConfigPicker';
import type { GridField, GridRecord } from '@/lib/types/grid';
import type { RecordViewLayout, RecordViewTab } from '@/data/record-view-configs';
import type { ReactNode } from 'react';

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
  /** Whether user can go back in linked record stack */
  canGoBack?: boolean;
  /** All saved configs for config picker */
  configs?: ConfigOption[];
  /** Currently active config ID */
  activeConfigId?: string | null;
  /**
   * When true, renders content directly without fixed overlay wrapper.
   * Used inside GridRecordViewLayout for combined grid + record view.
   */
  inline?: boolean;
  /** Whether the thread panel is currently open */
  isThreadOpen?: boolean;
  /** Unread count for the thread badge */
  threadUnreadCount?: number;
  /** Render prop for the thread panel content */
  threadPanel?: ReactNode;
  /** Toggle the Record Thread panel */
  onToggleThread?: () => void;
  /** Navigate prev/next */
  onNavigate: (direction: 'prev' | 'next') => void;
  /** Go back in linked record stack */
  onGoBack?: () => void;
  /** Navigate to a linked record (push stack) */
  onNavigateToLinkedRecord?: (recordId: string) => void;
  /** Switch to a different config */
  onSelectConfig?: (configId: string) => void;
  /** Save current config as new */
  onSaveConfigAsNew?: (name: string) => void;
  /** Close the overlay */
  onClose: () => void;
  /** Layout changed (drag reorder, tab changes) */
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
  canGoBack = false,
  configs,
  activeConfigId,
  inline = false,
  isThreadOpen = false,
  threadUnreadCount = 0,
  threadPanel,
  onToggleThread,
  onNavigate,
  onGoBack,
  onNavigateToLinkedRecord,
  onSelectConfig,
  onSaveConfigAsNew,
  onClose,
  onLayoutChange,
}: RecordViewProps) {
  const t = useTranslations('record_view');
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const { updateCell } = useOptimisticRecord(tableId, viewId);

  // Tab state — reset to default when record/layout changes using state-based sync
  const hasTabs = layout && layout.tabs.length > 0;
  const [activeTabId, setActiveTabId] = useState(DEFAULT_TAB_ID);
  const [trackedRecordId, setTrackedRecordId] = useState(currentRecordId);
  const [trackedLayout, setTrackedLayout] = useState(layout);

  if (trackedRecordId !== currentRecordId || trackedLayout !== layout) {
    setTrackedRecordId(currentRecordId);
    setTrackedLayout(layout);
    setActiveTabId(DEFAULT_TAB_ID);
  }

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

  // Tab management
  const handleAddTab = useCallback(
    (name: string) => {
      if (!layout) return;
      const newTab: RecordViewTab = { id: generateUUIDv7(), name };
      onLayoutChange?.({
        ...layout,
        tabs: [...layout.tabs, newTab],
      });
    },
    [layout, onLayoutChange],
  );

  const handleRenameTab = useCallback(
    (tabId: string, name: string) => {
      if (!layout) return;
      onLayoutChange?.({
        ...layout,
        tabs: layout.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, name } : tab,
        ),
      });
    },
    [layout, onLayoutChange],
  );

  const handleDeleteTab = useCallback(
    (tabId: string) => {
      if (!layout) return;
      // Move fields from deleted tab back to default
      const updatedFields = layout.fields.map((f) =>
        f.tab === tabId ? { ...f, tab: null } : f,
      );
      onLayoutChange?.({
        ...layout,
        tabs: layout.tabs.filter((tab) => tab.id !== tabId),
        fields: updatedFields,
      });
      if (activeTabId === tabId) {
        setActiveTabId(DEFAULT_TAB_ID);
      }
    },
    [layout, onLayoutChange, activeTabId],
  );

  // Calculate navigation state
  const currentIndex = currentRecordId
    ? recordIds.indexOf(currentRecordId)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < recordIds.length - 1;

  // Responsive layout: apply 1-column at mobile
  const responsiveLayout = layout
    ? isMobile
      ? { ...layout, columns: 1 }
      : layout
    : null;

  if (!isOpen) return null;

  // Inline mode: render content directly without overlay wrapper
  // Used inside GridRecordViewLayout for combined layout
  if (inline) {
    const inlineContent = isLoading ? (
      <RecordViewSkeleton />
    ) : record && responsiveLayout ? (
      <>
        <RecordViewHeader
          record={record}
          fields={fields}
          tableName={tableName}
          viewName={viewName}
          hasPrev={hasPrev}
          hasNext={hasNext}
          canGoBack={canGoBack}
          configs={configs}
          activeConfigId={activeConfigId}
          isThreadOpen={isThreadOpen}
          threadUnreadCount={threadUnreadCount}
          onNavigate={onNavigate}
          onGoBack={onGoBack}
          onSelectConfig={onSelectConfig}
          onSaveConfigAsNew={onSaveConfigAsNew}
          onClose={onClose}
          onToggleThread={onToggleThread}
        />
        {hasTabs && (
          <RecordViewTabs
            tabs={layout!.tabs}
            activeTabId={activeTabId}
            onTabChange={setActiveTabId}
            onAddTab={handleAddTab}
            onRenameTab={handleRenameTab}
            onDeleteTab={handleDeleteTab}
          />
        )}
        <RecordViewCanvas
          record={record}
          fields={fields}
          layout={responsiveLayout}
          activeTabId={hasTabs ? activeTabId : undefined}
          onFieldSave={handleFieldSave}
          onLayoutChange={onLayoutChange}
          onNavigateToLinkedRecord={onNavigateToLinkedRecord}
        />
      </>
    ) : (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {t('record_not_found')}
      </div>
    );

    return (
      <div
        className="flex flex-col flex-1 min-h-0 overflow-auto"
        role="region"
        aria-label={t('overlay_label')}
      >
        {inlineContent}
      </div>
    );
  }

  const content = isLoading ? (
    <RecordViewSkeleton />
  ) : record && responsiveLayout ? (
    <>
      <RecordViewHeader
        record={record}
        fields={fields}
        tableName={tableName}
        viewName={viewName}
        hasPrev={hasPrev}
        hasNext={hasNext}
        canGoBack={canGoBack}
        configs={configs}
        activeConfigId={activeConfigId}
        onNavigate={onNavigate}
        onGoBack={onGoBack}
        onSelectConfig={onSelectConfig}
        onSaveConfigAsNew={onSaveConfigAsNew}
        onClose={onClose}
      />
      {hasTabs && (
        <RecordViewTabs
          tabs={layout!.tabs}
          activeTabId={activeTabId}
          onTabChange={setActiveTabId}
          onAddTab={handleAddTab}
          onRenameTab={handleRenameTab}
          onDeleteTab={handleDeleteTab}
        />
      )}
      <RecordViewCanvas
        record={record}
        fields={fields}
        layout={responsiveLayout}
        activeTabId={hasTabs ? activeTabId : undefined}
        onFieldSave={handleFieldSave}
        onLayoutChange={onLayoutChange}
        onNavigateToLinkedRecord={onNavigateToLinkedRecord}
      />
    </>
  ) : (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      {t('record_not_found')}
    </div>
  );

  // Mobile: full-screen sheet
  if (isMobile) {
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
        <div
          ref={panelRef}
          className={cn(
            'absolute inset-0 bg-background',
            'flex flex-col',
            'transition-transform duration-200 ease-out',
            isOpen ? 'translate-y-0' : 'translate-y-full',
          )}
        >
          {content}
        </div>
      </div>
    );
  }

  // Tablet/Desktop: 60% overlay from right
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
          'flex flex-row',
          'transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{ width: '60%', minWidth: '400px', maxWidth: '1200px' }}
      >
        {/* Main content area — shrinks when thread open */}
        <div
          className="flex flex-col min-w-0 overflow-auto"
          style={{ width: isThreadOpen && threadPanel ? '75%' : '100%' }}
          data-testid="record-view-content"
        >
          {content}
        </div>

        {/* Thread panel slot — 25% width */}
        {isThreadOpen && threadPanel && (
          <div
            className="shrink-0 border-l"
            style={{ width: '25%', minWidth: '280px' }}
            data-testid="record-view-thread-slot"
          >
            {threadPanel}
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
