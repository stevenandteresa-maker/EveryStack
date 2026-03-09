'use client';

/**
 * CellErrorOverlay — thin wrapper that renders error/status indicators
 * over grid cells based on sync metadata and cell state.
 *
 * Five states:
 * 1. Broken reference: strikethrough + "(deleted)" badge
 * 2. Sync conflict: red sync icon in corner
 * 3. Processing (sync in progress): amber shimmer animation
 * 4. Succeeded (just resolved): brief green flash (1–2s)
 * 5. Type coercion issue: dash + amber warning icon
 *
 * Uses process state colors from design system: red=error, amber=warning, green=success.
 *
 * @see docs/reference/tables-and-views.md § Cell Error States
 * @see docs/Playbooks/playbook-phase-3a-i.md § Prompt 7
 */

import { memo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PROCESS_STATE_COLORS } from '@/lib/design-system';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CellErrorState =
  | 'broken_reference'
  | 'sync_conflict'
  | 'processing'
  | 'succeeded'
  | 'type_coercion';

export interface CellErrorInfo {
  state: CellErrorState;
  /** Source platform name for broken reference tooltip */
  sourceName?: string;
}

export interface CellErrorOverlayProps {
  children: React.ReactNode;
  error?: CellErrorInfo | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CellErrorOverlay = memo(function CellErrorOverlay({
  children,
  error,
}: CellErrorOverlayProps) {
  const t = useTranslations('grid.errors');
  const flashRef = useRef<HTMLDivElement>(null);

  // Handle succeeded state — show green flash for 1.5s then fade via CSS
  const isSucceeded = error?.state === 'succeeded';
  useEffect(() => {
    if (!isSucceeded) return;
    const el = flashRef.current;
    if (!el) return;
    // Start fully visible, then fade out after 1.5s
    el.style.opacity = '1';
    const timer = setTimeout(() => {
      el.style.opacity = '0';
    }, 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [isSucceeded]);

  if (!error) {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full h-full">
      {/* Render the cell content */}
      {error.state === 'broken_reference' ? (
        <div className="flex items-center gap-1 w-full">
          <span className="line-through truncate opacity-60">{children}</span>
          <span
            className="shrink-0 text-[10px] font-medium px-1 rounded"
            style={{
              backgroundColor: `${PROCESS_STATE_COLORS.error}15`,
              color: PROCESS_STATE_COLORS.error,
            }}
          >
            {t('deleted_badge')}
          </span>
        </div>
      ) : error.state === 'type_coercion' ? (
        <div className="flex items-center gap-1 w-full">
          <span className="text-sm" style={{ color: '#94A3B8' }}>—</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="shrink-0 text-xs cursor-help"
                  style={{ color: PROCESS_STATE_COLORS.warning }}
                  aria-label={t('type_coercion')}
                >
                  ⚠
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t('type_coercion')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ) : (
        children
      )}

      {/* Broken reference tooltip */}
      {error.state === 'broken_reference' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute inset-0 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t('broken_reference', { source: error.sourceName ?? 'source' })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Sync conflict — red sync icon in corner */}
      {error.state === 'sync_conflict' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="absolute top-0.5 right-0.5 text-[10px] cursor-pointer"
                style={{ color: PROCESS_STATE_COLORS.error }}
                aria-label={t('sync_conflict')}
              >
                ⟳
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t('sync_conflict')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Processing — amber shimmer */}
      {error.state === 'processing' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute inset-0 animate-pulse pointer-events-none"
                style={{
                  backgroundColor: `${PROCESS_STATE_COLORS.warning}12`,
                }}
                aria-label={t('processing')}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t('processing')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Succeeded — brief green flash */}
      {isSucceeded && (
        <div
          ref={flashRef}
          className="absolute inset-0 pointer-events-none transition-opacity duration-500"
          style={{
            backgroundColor: `${PROCESS_STATE_COLORS.success}15`,
            opacity: 1,
          }}
        />
      )}
    </div>
  );
});
