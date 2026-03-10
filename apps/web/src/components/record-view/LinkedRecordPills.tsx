'use client';

/**
 * LinkedRecordPills — renders linked record field values as clickable pills.
 *
 * Each pill shows the primary field value of the linked record.
 * Clicking a pill navigates to that record's Record View (stack navigation).
 *
 * @see docs/reference/tables-and-views.md § Linked Records in Record View
 */

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Link2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkedRecordPill {
  recordId: string;
  displayValue: string;
}

export interface LinkedRecordPillsProps {
  pills: LinkedRecordPill[];
  onNavigateToRecord: (recordId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkedRecordPills({
  pills,
  onNavigateToRecord,
}: LinkedRecordPillsProps) {
  const t = useTranslations('record_view');

  if (pills.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        {t('no_linked_records')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label={t('linked_records_label')}>
      {pills.map((pill) => (
        <Badge
          key={pill.recordId}
          variant="outline"
          className="cursor-pointer hover:bg-accent/20 transition-colors gap-1 px-2 py-0.5 text-xs font-normal"
          role="listitem"
          onClick={() => onNavigateToRecord(pill.recordId)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateToRecord(pill.recordId);
            }
          }}
          tabIndex={0}
          aria-label={t('linked_record_navigate', { name: pill.displayValue })}
        >
          <Link2 className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[200px]">{pill.displayValue}</span>
        </Badge>
      ))}
    </div>
  );
}
