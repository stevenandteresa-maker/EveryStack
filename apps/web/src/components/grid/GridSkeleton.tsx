'use client';

/**
 * GridSkeleton — loading state skeleton that matches the grid layout.
 *
 * Shows a skeleton header row + data rows with shimmer animation,
 * using the same column widths as the actual grid.
 *
 * @see docs/reference/design-system.md § Loading patterns
 */

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { GRID_TOKENS } from './grid-types';

export interface GridSkeletonProps {
  /** Number of columns to show in the skeleton. */
  columnCount?: number;
  /** Number of skeleton rows to show. */
  rowCount?: number;
  /** Row height in px (matches density). */
  rowHeight?: number;
}

const DEFAULT_COLUMN_COUNT = 6;
const DEFAULT_ROW_COUNT = 12;
const DEFAULT_ROW_HEIGHT = 44;

export function GridSkeleton({
  columnCount = DEFAULT_COLUMN_COUNT,
  rowCount = DEFAULT_ROW_COUNT,
  rowHeight = DEFAULT_ROW_HEIGHT,
}: GridSkeletonProps) {
  const t = useTranslations('grid');

  return (
    <div
      className="flex flex-col flex-1"
      role="status"
      aria-label={t('loading')}
      data-testid="grid-skeleton"
    >
      {/* Skeleton header */}
      <div
        className="flex border-b"
        style={{
          height: rowHeight,
          borderColor: GRID_TOKENS.borderDefault,
          backgroundColor: GRID_TOKENS.panelBg,
        }}
      >
        {/* Row number placeholder */}
        <div className="shrink-0 w-[120px] flex items-center px-3">
          <Skeleton className="h-4 w-8" />
        </div>
        {/* Column headers */}
        {Array.from({ length: columnCount }).map((_, i) => (
          <div
            key={i}
            className="flex items-center px-3 border-r"
            style={{
              width: i === 0 ? 280 : 160,
              borderColor: GRID_TOKENS.borderDefault,
            }}
          >
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>

      {/* Skeleton rows */}
      {Array.from({ length: rowCount }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex border-b"
          style={{
            height: rowHeight,
            borderColor: GRID_TOKENS.borderDefault,
            backgroundColor:
              rowIdx % 2 === 0
                ? GRID_TOKENS.rowStripeEven
                : GRID_TOKENS.rowStripeOdd,
          }}
        >
          {/* Row number */}
          <div className="shrink-0 w-[120px] flex items-center px-3">
            <Skeleton className="h-3 w-6" />
          </div>
          {/* Cell skeletons */}
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="flex items-center px-3 border-r"
              style={{
                width: colIdx === 0 ? 280 : 160,
                borderColor: GRID_TOKENS.borderDefault,
              }}
            >
              <Skeleton
                className="h-3"
                style={{
                  width: `${55 + ((rowIdx * 7 + colIdx * 13) % 35)}%`,
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
