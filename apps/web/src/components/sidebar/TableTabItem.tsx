'use client';

/**
 * TableTabItem — Sidebar table item with platform badge and sync status icon.
 *
 * Renders a table entry in the sidebar workspace tree. Synced tables
 * show a platform badge overlay on the table icon and a sync status
 * indicator to the right of the table name. Native tables show neither.
 *
 * The platform badge and any table tab color stripe are independent
 * visual channels — both can appear simultaneously.
 *
 * @see docs/reference/field-groups.md § Synced Table Tab Badges
 */

import { Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlatformBadge } from './PlatformBadge';
import { SyncStatusIcon } from './SyncStatusIcon';
import type { SyncHealthState } from '@everystack/shared/sync';

export interface TableTabItemProps {
  /** Table UUID. */
  tableId: string;
  /** Display name. */
  tableName: string;
  /** Whether this table is currently active/selected. */
  isActive: boolean;
  /** Optional tab color stripe (3px left-edge, user-chosen). */
  tabColor?: string | null;
  /** Platform if synced, null if native. */
  platform: 'airtable' | 'notion' | 'smartsuite' | null;
  /** Sync health state (only used when platform is not null). */
  healthState?: SyncHealthState | null;
  /** Last sync timestamp. */
  lastSyncAt?: Date | null;
  /** Number of pending sync conflicts. */
  pendingConflictCount?: number;
  /** Called when user clicks the table tab. */
  onClick?: () => void;
  /** Called when user clicks the sync status icon (navigate to sync settings). */
  onClickSyncSettings?: () => void;
  /** Called when user clicks the conflicts indicator (navigate to conflicts tab). */
  onClickConflicts?: () => void;
}

export function TableTabItem({
  tableId,
  tableName,
  isActive,
  tabColor,
  platform,
  healthState,
  lastSyncAt,
  pendingConflictCount = 0,
  onClick,
  onClickSyncSettings,
  onClickConflicts,
}: TableTabItemProps) {
  const isSynced = platform !== null;

  return (
    <button
      type="button"
      data-testid={`table-tab-${tableId}`}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-body-sm transition-colors duration-150 relative',
        isActive
          ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text)] font-semibold'
          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)]',
      )}
    >
      {/* Tab color stripe — independent of platform badge */}
      {tabColor && (
        <span
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r"
          style={{ backgroundColor: tabColor }}
          data-testid="table-tab-color-stripe"
        />
      )}

      {/* Active indicator when no tab color */}
      {isActive && !tabColor && (
        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-white" />
      )}

      {/* Table icon with optional platform badge overlay */}
      <span className="relative shrink-0" data-testid="table-icon-wrapper">
        <Table2 size={16} className="shrink-0" />
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
  );
}
