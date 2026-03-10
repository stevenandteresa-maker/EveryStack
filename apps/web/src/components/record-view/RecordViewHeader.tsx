'use client';

/**
 * RecordViewHeader — header bar for the Record View overlay.
 *
 * Shows: record name (primary field), nav arrows, back button (linked record
 * stack), config picker, close button, chat icon placeholder, breadcrumb.
 *
 * @see docs/reference/tables-and-views.md § Record View — Layout
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  MessageCircle,
} from 'lucide-react';
import {
  RecordViewConfigPicker,
  type ConfigOption,
} from './RecordViewConfigPicker';
import type { GridField, GridRecord } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecordViewHeaderProps {
  record: GridRecord;
  fields: GridField[];
  tableName: string;
  viewName: string;
  hasPrev: boolean;
  hasNext: boolean;
  canGoBack?: boolean;
  configs?: ConfigOption[];
  activeConfigId?: string | null;
  onNavigate: (direction: 'prev' | 'next') => void;
  onGoBack?: () => void;
  onSelectConfig?: (configId: string) => void;
  onSaveConfigAsNew?: (name: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordViewHeader({
  record,
  fields,
  tableName,
  viewName,
  hasPrev,
  hasNext,
  canGoBack = false,
  configs,
  activeConfigId,
  onNavigate,
  onGoBack,
  onSelectConfig,
  onSaveConfigAsNew,
  onClose,
}: RecordViewHeaderProps) {
  const t = useTranslations('record_view');

  // Find primary field and get its value
  const primaryField = fields.find((f) => f.isPrimary);
  const canonicalData = record.canonicalData as Record<string, unknown> | null;
  const recordName = primaryField
    ? String(canonicalData?.[primaryField.id] ?? t('untitled_record'))
    : t('untitled_record');

  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      {/* Left: back + breadcrumb + record name + config picker */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Back button for linked record stack */}
        {canGoBack && onGoBack && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onGoBack}
            aria-label={t('navigate_back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate">{tableName}</span>
            <span>{'›'}</span>
            <span className="truncate">{viewName}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold truncate">{recordName}</h2>
            {configs && onSelectConfig && onSaveConfigAsNew && (
              <RecordViewConfigPicker
                configs={configs}
                activeConfigId={activeConfigId ?? null}
                onSelectConfig={onSelectConfig}
                onSaveAsNew={onSaveConfigAsNew}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Chat icon placeholder (3C) */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled
          aria-label={t('chat_placeholder')}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>

        {/* Navigation arrows */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!hasPrev}
          onClick={() => onNavigate('prev')}
          aria-label={t('navigate_prev')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!hasNext}
          onClick={() => onNavigate('next')}
          aria-label={t('navigate_next')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          aria-label={t('close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
