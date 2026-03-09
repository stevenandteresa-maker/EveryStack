'use client';

/**
 * GridToolbar — unified toolbar above the grid with view controls.
 *
 * Left group: view switcher placeholder, hide fields, filter, sort, group, color.
 * Right group: density toggle, share/export placeholder, overflow menu.
 *
 * @see docs/reference/tables-and-views.md § Grid Toolbar
 */

import { memo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  EyeOff,
  Filter,
  ArrowUpDown,
  Layers,
  Paintbrush,
  Rows3,
  Share2,
  MoreHorizontal,
  Grid3X3,
  Printer,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SortPanel, type SortPanelProps } from './SortPanel';
import { FilterBuilder, type FilterBuilderProps } from './FilterBuilder';
import { ColorRuleBuilder, type ColorRuleBuilderProps } from './ColorRuleBuilder';
import { HideFieldsPanel, type HideFieldsPanelProps } from './HideFieldsPanel';
import type { RowDensity } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GridToolbarProps {
  /** Current view name (for placeholder switcher) */
  viewName: string;
  /** Current view type icon label */
  viewType: 'grid' | 'card';
  /** Density state */
  density: RowDensity;
  onSetDensity: (density: RowDensity) => void;

  // Panel open state — controlled from parent for keyboard shortcut wiring
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  sortOpen: boolean;
  onSortOpenChange: (open: boolean) => void;
  groupOpen: boolean;
  onGroupOpenChange: (open: boolean) => void;
  colorOpen: boolean;
  onColorOpenChange: (open: boolean) => void;
  hideFieldsOpen: boolean;
  onHideFieldsOpenChange: (open: boolean) => void;

  // Active counts for badges
  activeFilterCount: number;
  activeSortCount: number;
  activeGroupCount: number;
  hasColorRules: boolean;
  hiddenFieldCount: number;

  // Pass-through props for panels
  sortPanelProps: Omit<SortPanelProps, never>;
  filterBuilderProps: Omit<FilterBuilderProps, never>;
  colorRuleBuilderProps: Omit<ColorRuleBuilderProps, never>;
  hideFieldsPanelProps: Omit<HideFieldsPanelProps, never>;

  // Grouping panel props (reuse sort panel pattern)
  groupPanelProps: {
    groups: { fieldId: string; direction: 'asc' | 'desc' }[];
    fields: SortPanelProps['fields'];
    onAddGroup: (fieldId: string, direction: 'asc' | 'desc') => void;
    onRemoveGroup: (fieldId: string) => void;
    onUpdateDirection: (fieldId: string, direction: 'asc' | 'desc') => void;
    onReorderGroups: (fromIndex: number, toIndex: number) => void;
    onClearGroups: () => void;
    isAtLimit: boolean;
  };
}

// ---------------------------------------------------------------------------
// Density options
// ---------------------------------------------------------------------------

const DENSITY_OPTIONS: RowDensity[] = ['compact', 'medium', 'tall'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GridToolbar = memo(function GridToolbar({
  viewName,
  viewType: _viewType,
  density,
  onSetDensity,
  filterOpen,
  onFilterOpenChange,
  sortOpen,
  onSortOpenChange,
  groupOpen,
  onGroupOpenChange,
  colorOpen,
  onColorOpenChange,
  hideFieldsOpen,
  onHideFieldsOpenChange,
  activeFilterCount,
  activeSortCount,
  activeGroupCount,
  hasColorRules,
  hiddenFieldCount,
  sortPanelProps,
  filterBuilderProps,
  colorRuleBuilderProps,
  hideFieldsPanelProps,
  groupPanelProps,
}: GridToolbarProps) {
  const t = useTranslations('grid.toolbar');

  const cycleDensity = useCallback(() => {
    const currentIdx = DENSITY_OPTIONS.indexOf(density);
    const nextIdx = (currentIdx + 1) % DENSITY_OPTIONS.length;
    const next = DENSITY_OPTIONS[nextIdx];
    if (next) {
      onSetDensity(next);
    }
  }, [density, onSetDensity]);

  return (
    <div
      className="flex items-center justify-between border-b px-3 py-1.5 bg-white"
      role="toolbar"
      aria-label={t('label')}
    >
      {/* Left group */}
      <div className="flex items-center gap-1">
        {/* View switcher placeholder */}
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-medium" disabled>
          <Grid3X3 className="h-3.5 w-3.5" />
          {viewName}
        </Button>

        {/* Hide fields */}
        <Popover open={hideFieldsOpen} onOpenChange={onHideFieldsOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              data-active={hiddenFieldCount > 0 || undefined}
            >
              <EyeOff className="h-3.5 w-3.5" />
              {t('hide_fields')}
              {hiddenFieldCount > 0 && (
                <Badge variant="default" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
                  {hiddenFieldCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <HideFieldsPanel {...hideFieldsPanelProps} />
          </PopoverContent>
        </Popover>

        {/* Filter */}
        <Popover open={filterOpen} onOpenChange={onFilterOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              data-active={activeFilterCount > 0 || undefined}
            >
              <Filter className="h-3.5 w-3.5" />
              {t('filter')}
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="start">
            <FilterBuilder {...filterBuilderProps} />
          </PopoverContent>
        </Popover>

        {/* Sort */}
        <Popover open={sortOpen} onOpenChange={onSortOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              data-active={activeSortCount > 0 || undefined}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {t('sort')}
              {activeSortCount > 0 && (
                <Badge variant="default" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
                  {activeSortCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <SortPanel {...sortPanelProps} />
          </PopoverContent>
        </Popover>

        {/* Group */}
        <Popover open={groupOpen} onOpenChange={onGroupOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              data-active={activeGroupCount > 0 || undefined}
            >
              <Layers className="h-3.5 w-3.5" />
              {t('group')}
              {activeGroupCount > 0 && (
                <Badge variant="default" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
                  {activeGroupCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <GroupPanelContent {...groupPanelProps} />
          </PopoverContent>
        </Popover>

        {/* Color */}
        <Popover open={colorOpen} onOpenChange={onColorOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              data-active={hasColorRules || undefined}
            >
              <Paintbrush className="h-3.5 w-3.5" />
              {t('color')}
              {hasColorRules && (
                <span className="ml-1 h-2 w-2 rounded-full bg-current" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="start">
            <ColorRuleBuilder {...colorRuleBuilderProps} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Right group */}
      <div className="flex items-center gap-1">
        {/* Density toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={cycleDensity}
            >
              <Rows3 className="h-3.5 w-3.5" />
              {t(`density_${density}`)}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('density_toggle')}</TooltipContent>
        </Tooltip>

        {/* Share / Export placeholder */}
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled>
          <Share2 className="h-3.5 w-3.5" />
          {t('share')}
        </Button>

        {/* Overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5" />
              <span className="sr-only">{t('overflow')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.print()}>
              <Printer className="mr-2 h-3.5 w-3.5" />
              {t('print')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Link2 className="mr-2 h-3.5 w-3.5" />
              {t('copy_view_url')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// GroupPanelContent — inline group panel (reuses sort panel pattern)
// ---------------------------------------------------------------------------

interface GroupPanelContentProps {
  groups: { fieldId: string; direction: 'asc' | 'desc' }[];
  fields: SortPanelProps['fields'];
  onAddGroup: (fieldId: string, direction: 'asc' | 'desc') => void;
  onRemoveGroup: (fieldId: string) => void;
  onUpdateDirection: (fieldId: string, direction: 'asc' | 'desc') => void;
  onReorderGroups: (fromIndex: number, toIndex: number) => void;
  onClearGroups: () => void;
  isAtLimit: boolean;
}

const GroupPanelContent = memo(function GroupPanelContent({
  groups,
  fields,
  onAddGroup,
  onRemoveGroup,
  onUpdateDirection,
  onClearGroups,
  isAtLimit,
}: GroupPanelContentProps) {
  const t = useTranslations('grid.toolbar');

  // Fields available for grouping (not already grouped)
  const groupedFieldIds = new Set(groups.map((g) => g.fieldId));
  const availableFields = fields.filter((f) => !groupedFieldIds.has(f.id));

  const handleAddGroup = useCallback(() => {
    const firstAvailable = availableFields[0];
    if (firstAvailable) {
      onAddGroup(firstAvailable.id, 'asc');
    }
  }, [availableFields, onAddGroup]);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{t('group_title')}</span>
        {groups.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClearGroups}>
            {t('clear_all')}
          </Button>
        )}
      </div>

      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('group_empty')}</p>
      )}

      {groups.map((group) => {
        const field = fields.find((f) => f.id === group.fieldId);
        return (
          <div key={group.fieldId} className="flex items-center gap-2">
            <span className="text-xs flex-1 truncate">
              {field?.name ?? t('unknown_field')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() =>
                onUpdateDirection(
                  group.fieldId,
                  group.direction === 'asc' ? 'desc' : 'asc',
                )
              }
            >
              {group.direction === 'asc' ? 'A→Z' : 'Z→A'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onRemoveGroup(group.fieldId)}
            >
              <span className="sr-only">{t('remove')}</span>
              ×
            </Button>
          </div>
        );
      })}

      {!isAtLimit && availableFields.length > 0 && (
        <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={handleAddGroup}>
          {t('add_group')}
        </Button>
      )}

      {isAtLimit && (
        <p className="text-xs text-muted-foreground">{t('group_limit')}</p>
      )}
    </div>
  );
});
