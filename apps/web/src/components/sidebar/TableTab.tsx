'use client';

/**
 * TableTab — Enhanced sidebar table tab with table type icon, tab color stripe
 * with opacity transitions, and right-click color picker.
 *
 * Renders a table entry in the sidebar workspace tree. Shows:
 * - Table type icon (replaces generic Table2)
 * - 3px left-edge color stripe (from tab_color or table type default)
 * - Platform badge overlay for synced tables
 * - Sync status icon
 * - Right-click context menu with color picker
 *
 * @see docs/reference/tables-and-views.md § Table Tab Colors
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Palette, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { PlatformBadge } from './PlatformBadge';
import { SyncStatusIcon } from './SyncStatusIcon';
import { TableTypeIcon } from '@/components/grid/TableTypeIcon';
import {
  TAB_COLOR_PALETTE,
  resolveTabColor,
} from '@/lib/constants/table-types';
import type { SyncHealthState } from '@everystack/shared/sync';

export interface TableTabProps {
  tableId: string;
  tableName: string;
  tableType: string;
  isActive: boolean;
  tabColor?: string | null;
  platform: 'airtable' | 'notion' | 'smartsuite' | null;
  healthState?: SyncHealthState | null;
  lastSyncAt?: Date | null;
  pendingConflictCount?: number;
  onClick?: () => void;
  onClickSyncSettings?: () => void;
  onClickConflicts?: () => void;
  onChangeTabColor?: (tableId: string, color: string | null) => void;
}

export function TableTab({
  tableId,
  tableName,
  tableType,
  isActive,
  tabColor,
  platform,
  healthState,
  lastSyncAt,
  pendingConflictCount = 0,
  onClick,
  onClickSyncSettings,
  onClickConflicts,
  onChangeTabColor,
}: TableTabProps) {
  const t = useTranslations('table_tab');
  const isSynced = platform !== null;
  const [isHovered, setIsHovered] = useState(false);

  // Resolve effective color (custom or table type default, dark mode for sidebar)
  const effectiveColor = resolveTabColor(tableType, tabColor, true);

  // Opacity: 100% active, 80% hover, 60% inactive
  const stripeOpacity = isActive ? 1 : isHovered ? 0.8 : 0.6;

  const handleColorSelect = useCallback(
    (color: string | null) => {
      onChangeTabColor?.(tableId, color);
    },
    [onChangeTabColor, tableId],
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          data-testid={`table-tab-${tableId}`}
          onClick={onClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-body-sm transition-colors duration-150 relative',
            isActive
              ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text)] font-semibold'
              : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)]',
          )}
        >
          {/* Tab color stripe — 3px left-edge with opacity transition */}
          <span
            className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r transition-opacity duration-200 ease-in-out"
            style={{
              backgroundColor: effectiveColor,
              opacity: stripeOpacity,
            }}
            data-testid="table-tab-color-stripe"
          />

          {/* Table type icon with optional platform badge overlay */}
          <span className="relative shrink-0" data-testid="table-icon-wrapper">
            <TableTypeIcon tableType={tableType} size={16} />
            {isSynced && <PlatformBadge platform={platform} />}
          </span>

          {/* Table name */}
          <span className="min-w-0 flex-1 truncate">{tableName}</span>

          {/* Sync status icon — right-aligned, only for synced tables */}
          {isSynced && healthState && (
            <SyncStatusIcon
              healthState={healthState}
              platform={platform}
              lastSyncAt={lastSyncAt ?? null}
              pendingConflictCount={pendingConflictCount}
              onClick={onClickSyncSettings}
              onClickConflicts={onClickConflicts}
            />
          )}
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Palette size={14} className="mr-2" />
            {t('tab_color')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="p-2">
            <div className="grid grid-cols-5 gap-1.5" data-testid="tab-color-picker">
              {TAB_COLOR_PALETTE.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                    tabColor === color.hex
                      ? 'border-white ring-2 ring-blue-500'
                      : 'border-transparent',
                  )}
                  style={{ backgroundColor: color.darkHex }}
                  onClick={() => handleColorSelect(color.hex)}
                  aria-label={t(`color_${color.labelKey}`)}
                  data-testid={`tab-color-${color.name}`}
                />
              ))}
            </div>
            <ContextMenuSeparator className="my-1.5" />
            <ContextMenuItem
              onClick={() => handleColorSelect(null)}
              data-testid="tab-color-default"
            >
              <RotateCcw size={14} className="mr-2" />
              {t('default_color')}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}
