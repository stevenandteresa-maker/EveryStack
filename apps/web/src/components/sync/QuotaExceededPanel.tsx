'use client';

/**
 * QuotaExceededPanel — Displays when record quota has been reached during sync.
 *
 * Shows current usage vs. plan limit, how many records could not be synced,
 * and 4 resolution options:
 * 1. Add Sync Filter — navigate to Tables & Filters tab
 * 2. Upgrade Plan — navigate to billing settings
 * 3. Delete Records — navigate to table with oldest records filter
 * 4. Disable Tables — navigate to Tables & Filters with table toggles
 *
 * After user frees quota, a "[Resume Sync]" button triggers immediate catch-up sync.
 *
 * @see docs/reference/sync-engine.md § Quota Exceeded
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuotaExceededPanelProps {
  /** Current record count for the workspace. */
  currentCount: number;
  /** Plan-level record quota. */
  planQuota: number;
  /** Plan display name (e.g. "Professional"). */
  planName: string;
  /** Number of records that could not be synced. */
  unsyncedCount: number;
  /** Table name where the records could not be synced. */
  tableName?: string;
  /** Whether the user has freed quota and can resume sync. */
  canResume: boolean;
  /** Called when user clicks "Add Sync Filter". */
  onAddFilter: () => void;
  /** Called when user clicks "Upgrade Plan". */
  onUpgradePlan: () => void;
  /** Called when user clicks "Delete Records". */
  onDeleteRecords: () => void;
  /** Called when user clicks "Disable Tables". */
  onDisableTables: () => void;
  /** Called when user clicks "Resume Sync" (visible after quota freed). */
  onResumeSync: () => void;
  /** Whether the resume sync action is in progress. */
  isResuming?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuotaExceededPanel({
  currentCount,
  planQuota,
  planName,
  unsyncedCount,
  tableName,
  canResume,
  onAddFilter,
  onUpgradePlan,
  onDeleteRecords,
  onDisableTables,
  onResumeSync,
  isResuming = false,
}: QuotaExceededPanelProps) {
  const t = useTranslations('sync_quota');

  const formattedCurrent = currentCount.toLocaleString();
  const formattedQuota = planQuota.toLocaleString();
  const formattedUnsynced = unsyncedCount.toLocaleString();

  return (
    <Card
      className="border-amber-200 bg-amber-50"
      data-testid="quota-exceeded-panel"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-600" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2L18 17H2L10 2Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10 8V11M10 14H10.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <h3 className="text-[14px] font-semibold text-amber-900">
            {t('title')}
          </h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-[13px] text-amber-800">
            {t('usage', {
              current: formattedCurrent,
              quota: formattedQuota,
              plan: planName,
            })}
          </p>
          <p className="text-[13px] text-amber-800">
            {tableName
              ? t('unsynced_with_table', {
                  count: formattedUnsynced,
                  table: tableName,
                })
              : t('unsynced', { count: formattedUnsynced })}
          </p>
        </div>

        {/* Resolution options */}
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-amber-700">
            {t('options_label')}
          </p>
          <div className="grid grid-cols-1 gap-2 tablet:grid-cols-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddFilter}
              className="justify-start text-[13px]"
              data-testid="quota-add-filter"
            >
              {t('add_filter')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUpgradePlan}
              className="justify-start text-[13px]"
              data-testid="quota-upgrade-plan"
            >
              {t('upgrade_plan')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteRecords}
              className="justify-start text-[13px]"
              data-testid="quota-delete-records"
            >
              {t('delete_records')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisableTables}
              className="justify-start text-[13px]"
              data-testid="quota-disable-tables"
            >
              {t('disable_tables')}
            </Button>
          </div>
        </div>

        {/* Resume Sync — visible after user frees quota */}
        {canResume && (
          <div className="border-t border-amber-200 pt-3">
            <Button
              variant="default"
              size="sm"
              onClick={onResumeSync}
              disabled={isResuming}
              data-testid="quota-resume-sync"
            >
              {isResuming ? t('resuming') : t('resume_sync')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
