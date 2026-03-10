'use client';

/**
 * CardViewToolbar — extends GridToolbar with card-specific controls.
 *
 * Adds layout picker (single column / grid / compact list)
 * and column count picker (2 or 3 columns for grid layout).
 *
 * @see docs/reference/tables-and-views.md § Card View
 */

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  LayoutList,
  LayoutGrid,
  Rows3,
  Columns2,
  Columns3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GridToolbar, type GridToolbarProps } from '@/components/grid/GridToolbar';
import type { CardLayout } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardViewToolbarProps extends GridToolbarProps {
  cardLayout: CardLayout;
  onSetCardLayout: (layout: CardLayout) => void;
  cardColumns: 2 | 3;
  onSetCardColumns: (columns: 2 | 3) => void;
}

// ---------------------------------------------------------------------------
// Layout icon mapping
// ---------------------------------------------------------------------------

const LAYOUT_ICONS: Record<CardLayout, typeof LayoutList> = {
  single_column: Rows3,
  grid: LayoutGrid,
  compact_list: LayoutList,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CardViewToolbar = memo(function CardViewToolbar({
  cardLayout,
  onSetCardLayout,
  cardColumns,
  onSetCardColumns,
  ...gridToolbarProps
}: CardViewToolbarProps) {
  const t = useTranslations('card_view.toolbar');

  const LayoutIcon = LAYOUT_ICONS[cardLayout];

  return (
    <div className="flex items-center justify-between border-b bg-white">
      {/* Reuse GridToolbar for left + right groups */}
      <div className="flex-1">
        <GridToolbar {...gridToolbarProps} />
      </div>

      {/* Card-specific controls — inserted before the right group */}
      <div className="flex items-center gap-1 px-3 py-1.5">
        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Layout picker */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <LayoutIcon className="h-3.5 w-3.5" />
                  {t(`layout_${cardLayout}`)}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t('layout_picker')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onSetCardLayout('single_column')}
              data-active={cardLayout === 'single_column' || undefined}
            >
              <Rows3 className="mr-2 h-3.5 w-3.5" />
              {t('layout_single_column')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSetCardLayout('grid')}
              data-active={cardLayout === 'grid' || undefined}
            >
              <LayoutGrid className="mr-2 h-3.5 w-3.5" />
              {t('layout_grid')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSetCardLayout('compact_list')}
              data-active={cardLayout === 'compact_list' || undefined}
            >
              <LayoutList className="mr-2 h-3.5 w-3.5" />
              {t('layout_compact_list')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Column count picker — only visible for grid layout */}
        {cardLayout === 'grid' && (
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={cardColumns === 2 ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onSetCardColumns(2)}
                  aria-label={t('columns_2')}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('columns_2')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={cardColumns === 3 ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onSetCardColumns(3)}
                  aria-label={t('columns_3')}
                >
                  <Columns3 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('columns_3')}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
});
