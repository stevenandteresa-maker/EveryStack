'use client';

/**
 * PerformanceBanner — shows info/warning banners above the grid based on
 * performance thresholds.
 *
 * Thresholds:
 * - >10K rows (unfiltered): info banner
 * - >50K rows (unfiltered): warning + auto-enable pagination
 * - >30 visible columns: suggestion to hide unused
 * - >2s loading: "Still loading…" indicator
 *
 * @see docs/reference/tables-and-views.md § Performance Thresholds
 */

import { useState, useCallback } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface PerformanceBannerProps {
  totalRowCount: number;
  visibleColumnCount: number;
  isSlowLoading?: boolean;
}

interface BannerItem {
  id: string;
  variant: 'info' | 'warning';
  messageKey: string;
}

export function PerformanceBanner({
  totalRowCount,
  visibleColumnCount,
  isSlowLoading = false,
}: PerformanceBannerProps) {
  const t = useTranslations('grid.performance');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  const banners: BannerItem[] = [];

  if (totalRowCount > 50_000) {
    banners.push({
      id: 'rows-50k',
      variant: 'warning',
      messageKey: 'rows_50k_warning',
    });
  } else if (totalRowCount > 10_000) {
    banners.push({
      id: 'rows-10k',
      variant: 'info',
      messageKey: 'rows_10k_info',
    });
  }

  if (visibleColumnCount > 30) {
    banners.push({
      id: 'columns-30',
      variant: 'info',
      messageKey: 'columns_30_suggestion',
    });
  }

  if (isSlowLoading) {
    banners.push({
      id: 'slow-loading',
      variant: 'info',
      messageKey: 'still_loading',
    });
  }

  const visibleBanners = banners.filter((b) => !dismissed.has(b.id));

  if (visibleBanners.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 py-2" data-testid="performance-banners">
      {visibleBanners.map((banner) => (
        <div
          key={banner.id}
          role="alert"
          data-testid={`performance-banner-${banner.id}`}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm',
            banner.variant === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-blue-200 bg-blue-50 text-blue-900',
          )}
        >
          {banner.variant === 'warning' ? (
            <AlertTriangle size={16} className="shrink-0 text-amber-600" />
          ) : (
            <Info size={16} className="shrink-0 text-blue-600" />
          )}
          <span className="flex-1">{t(banner.messageKey)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => dismiss(banner.id)}
            aria-label={t('dismiss')}
          >
            <X size={14} />
          </Button>
        </div>
      ))}
    </div>
  );
}
