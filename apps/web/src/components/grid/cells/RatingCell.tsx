'use client';

/**
 * RatingCell — inline star widget for rating field type.
 *
 * Display: ★★★☆☆ (number of stars from field.config.max, default 5).
 * Edit: Click star position to set value. No separate edit mode.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useTranslations } from 'next-intl';
import { Star, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

function getMaxStars(field: CellRendererProps['field']): number {
  const config = field.config as Record<string, unknown> | null;
  const max = config?.max;
  if (typeof max === 'number' && max > 0 && max <= 10) return max;
  return 5;
}

export function RatingCellDisplay({ value, field, onSave }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const maxStars = getMaxStars(field);
  const rating = typeof value === 'number' ? Math.min(Math.max(0, value), maxStars) : 0;

  if (field.readOnly) {
    return (
      <div className="flex w-full items-center gap-0.5">
        {Array.from({ length: maxStars }, (_, i) => (
          <Star
            key={i}
            className={cn(
              'h-4 w-4',
              i < rating
                ? 'fill-amber-400 text-amber-400'
                : 'fill-none text-slate-300',
            )}
            aria-hidden="true"
          />
        ))}
        <Lock
          className="ml-1 h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      </div>
    );
  }

  return (
    <div
      className="flex w-full items-center gap-0.5"
      role="radiogroup"
      aria-label={t('rating_label', { max: maxStars })}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= rating;

        return (
          <button
            key={i}
            type="button"
            className="p-0 hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              // Clicking the same star value clears the rating
              onSave(starValue === rating ? 0 : starValue);
            }}
            aria-label={t('rating_star', { star: starValue, max: maxStars })}
          >
            <Star
              className={cn(
                'h-4 w-4',
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-none text-slate-300 hover:text-amber-300',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
