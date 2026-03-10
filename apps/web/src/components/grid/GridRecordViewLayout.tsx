'use client';

/**
 * GridRecordViewLayout — combined layout for Grid + Record View.
 *
 * When Record View is open:
 * - Record View takes 60% width (from right)
 * - Grid takes remaining 40% (dimmed but interactive)
 * - Clicking a different row in the grid updates Record View
 *
 * When Record Thread placeholder is shown:
 * - Record View: 55%, Grid: 20%, Thread: 25%
 *
 * Record View dimensions are relative to full screen minus icon rail,
 * regardless of Quick Panel state.
 *
 * @see docs/reference/tables-and-views.md § Grid + Record View Layout
 */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { RecordView } from '@/components/record-view/RecordView';
import type { RecordViewProps } from '@/components/record-view/RecordView';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GridRecordViewLayoutProps {
  /** Whether Record View is open */
  isRecordViewOpen: boolean;
  /** Record View props (forwarded to RecordView) */
  recordViewProps: Omit<RecordViewProps, 'isOpen' | 'onClose'>;
  /** Close Record View */
  onCloseRecordView: () => void;
  /** Whether Record Thread panel placeholder is shown */
  showThreadPanel?: boolean;
  /** Toggle thread panel */
  onToggleThreadPanel?: () => void;
  /** Grid content (DataGrid component) */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GridRecordViewLayout({
  isRecordViewOpen,
  recordViewProps,
  onCloseRecordView,
  showThreadPanel = false,
  onToggleThreadPanel,
  children,
}: GridRecordViewLayoutProps) {
  const t = useTranslations('grid.combined_layout');
  const isMobile = useMediaQuery('(max-width: 767px)');

  // On mobile, Record View goes full-screen (handled by RecordView itself)
  if (isMobile) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {children}
        <RecordView
          isOpen={isRecordViewOpen}
          onClose={onCloseRecordView}
          {...recordViewProps}
        />
      </div>
    );
  }

  // Desktop/tablet without Record View open — just render grid

  // Desktop/tablet: side-by-side layout
  if (!isRecordViewOpen) {
    return <div className="flex flex-col flex-1 min-h-0">{children}</div>;
  }

  // Calculate widths based on thread panel state
  const recordViewWidth = showThreadPanel ? '55%' : '60%';
  const threadPanelWidth = '25%';

  return (
    <div className="flex flex-1 min-h-0 relative">
      {/* Grid — dimmed but interactive */}
      <div
        className={cn(
          'flex flex-col min-h-0 overflow-hidden relative',
          'transition-opacity duration-200',
        )}
        style={{
          flex: '1 1 0%',
          opacity: 0.6,
        }}
        aria-label={t('grid_area')}
      >
        {children}
        {/* Semi-transparent overlay for dim effect, pointer-events-none so grid stays interactive */}
        <div
          className="absolute inset-0 bg-black/5 pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Record View panel */}
      <div
        className={cn(
          'flex flex-col min-h-0 border-l bg-background shadow-xl',
          'transition-all duration-200 ease-out',
        )}
        style={{ width: recordViewWidth, minWidth: '400px' }}
      >
        <RecordView
          isOpen={isRecordViewOpen}
          inline
          onClose={onCloseRecordView}
          {...recordViewProps}
        />
      </div>

      {/* Record Thread placeholder panel (reserved for 3C) */}
      {showThreadPanel && (
        <div
          className={cn(
            'flex flex-col min-h-0 border-l',
            'bg-muted/30',
          )}
          style={{ width: threadPanelWidth }}
          aria-label={t('thread_panel')}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium text-muted-foreground">
              {t('thread_title')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onToggleThreadPanel}
              aria-label={t('close_thread')}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-muted-foreground text-center">
              {t('thread_placeholder')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
