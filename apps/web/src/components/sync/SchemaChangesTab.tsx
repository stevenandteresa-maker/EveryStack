'use client';

/**
 * SchemaChangesTab — Displays detected schema changes from the source platform
 * with resolution actions per change type.
 *
 * Wired into the Sync Settings Dashboard (Prompt 10).
 *
 * @see docs/reference/sync-engine.md § Schema Mismatch
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Trash2, Plus, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { SyncSchemaChangeRow } from '@/data/sync-schema-changes';
import {
  acceptTypeChangedAction,
  rejectTypeChangedAction,
  archiveFieldAction,
  deleteFieldSchemaChangeAction,
  addFieldFromPlatformAction,
  ignoreSchemaChangeAction,
  acceptRenameAction,
  rejectRenameAction,
} from '@/actions/sync-schema-actions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SchemaChangesTabProps {
  /** Base connection ID. */
  baseConnectionId: string;
  /** Platform name for display. */
  platform: string;
  /** Table ID for field creation (field_added). */
  tableId?: string;
  /** List of schema changes. */
  changes: SyncSchemaChangeRow[];
  /** Called after a mutation to refresh data. */
  onMutate?: () => void;
}

// ---------------------------------------------------------------------------
// Change type config
// ---------------------------------------------------------------------------

interface ChangeTypeConfig {
  icon: React.ReactNode;
  variant: 'warning' | 'error' | 'success' | 'default';
}

function getChangeTypeConfig(changeType: string): ChangeTypeConfig {
  switch (changeType) {
    case 'field_type_changed':
      return { icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, variant: 'warning' };
    case 'field_deleted':
      return { icon: <Trash2 className="h-4 w-4 text-red-500" />, variant: 'error' };
    case 'field_added':
      return { icon: <Plus className="h-4 w-4 text-green-600" />, variant: 'success' };
    case 'field_renamed':
      return { icon: <Type className="h-4 w-4 text-blue-500" />, variant: 'default' };
    default:
      return { icon: <AlertTriangle className="h-4 w-4" />, variant: 'default' };
  }
}

// ---------------------------------------------------------------------------
// Impact summary
// ---------------------------------------------------------------------------

function ImpactSummary({ impact, t }: { impact: SyncSchemaChangeRow['impact']; t: ReturnType<typeof useTranslations> }) {
  const parts: string[] = [];
  if (impact.formulaCount > 0) {
    parts.push(t('impact_formulas', { count: impact.formulaCount }));
  }
  if (impact.automationCount > 0) {
    parts.push(t('impact_automations', { count: impact.automationCount }));
  }
  if (impact.portalFieldCount > 0) {
    parts.push(t('impact_portals', { count: impact.portalFieldCount }));
  }
  if (impact.crossLinkCount > 0) {
    parts.push(t('impact_cross_links', { count: impact.crossLinkCount }));
  }

  if (parts.length === 0) return null;

  return (
    <p className="mt-1 text-[12px] text-amber-600">
      {t('impact_prefix')}{parts.join(', ')}.
    </p>
  );
}

// ---------------------------------------------------------------------------
// SchemaChangeRow
// ---------------------------------------------------------------------------

interface SchemaChangeRowProps {
  change: SyncSchemaChangeRow;
  platform: string;
  tableId?: string;
  baseConnectionId: string;
  onMutate?: () => void;
  isPending: boolean;
  onActionStart: () => void;
  onActionEnd: () => void;
}

function SchemaChangeRow({
  change,
  platform,
  tableId,
  baseConnectionId,
  onMutate,
  isPending,
  onActionStart,
  onActionEnd,
}: SchemaChangeRowProps) {
  const t = useTranslations('sync_schema_changes');
  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const config = getChangeTypeConfig(change.changeType);
  const isResolved = change.status !== 'pending';
  const oldName = (change.oldSchema?.name as string) ?? '';
  const newName = (change.newSchema?.name as string) ?? '';
  const oldType = (change.oldSchema?.type as string) ?? '';
  const newType = (change.newSchema?.type as string) ?? '';

  const baseInput = {
    changeId: change.id,
    changeType: change.changeType as 'field_type_changed' | 'field_deleted' | 'field_added' | 'field_renamed',
    fieldId: change.fieldId,
    platformFieldId: change.platformFieldId,
    baseConnectionId,
  };

  const handleAction = (action: () => Promise<void>) => {
    setActionError(null);
    onActionStart();
    startTransition(async () => {
      try {
        await action();
        onMutate?.();
      } catch {
        setActionError(t('action_error'));
      } finally {
        onActionEnd();
      }
    });
  };

  return (
    <Card data-testid={`schema-change-row-${change.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="mt-0.5 shrink-0">{config.icon}</div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Description */}
            <p className="text-[14px] font-medium text-foreground">
              {change.changeType === 'field_type_changed' && t('type_changed', { name: oldName, oldType, newType })}
              {change.changeType === 'field_deleted' && t('field_deleted', { name: oldName, platform })}
              {change.changeType === 'field_added' && t('field_added', { name: newName, type: newType, platform })}
              {change.changeType === 'field_renamed' && t('field_renamed', { oldName, newName, platform })}
            </p>

            {/* Impact analysis (for type_changed and deleted) */}
            {(change.changeType === 'field_type_changed' || change.changeType === 'field_deleted') && (
              <ImpactSummary impact={change.impact} t={t} />
            )}

            {/* Status badge for resolved changes */}
            {isResolved && (
              <Badge variant={change.status === 'accepted' ? 'success' : 'default'} className="mt-2 text-[11px]">
                {t(`status_${change.status}`)}
              </Badge>
            )}

            {/* Error message */}
            {actionError && (
              <p className="mt-1 text-[12px] text-red-600" role="alert">{actionError}</p>
            )}
          </div>

          {/* Actions */}
          {!isResolved && (
            <div className="flex shrink-0 items-center gap-2">
              {change.changeType === 'field_type_changed' && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAction(() =>
                      acceptTypeChangedAction({
                        ...baseInput,
                        newFieldType: newType,
                        newPlatformFieldType: newType,
                      }),
                    )}
                    disabled={isPending}
                    data-testid={`accept-type-change-${change.id}`}
                  >
                    {t('accept_change')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction(() => rejectTypeChangedAction(baseInput))}
                    disabled={isPending}
                    data-testid={`reject-type-change-${change.id}`}
                  >
                    {t('reject_keep_local')}
                  </Button>
                </>
              )}

              {change.changeType === 'field_deleted' && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAction(() => archiveFieldAction(baseInput))}
                    disabled={isPending}
                    data-testid={`archive-field-${change.id}`}
                  >
                    {t('archive_field')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction(() => deleteFieldSchemaChangeAction(baseInput))}
                    disabled={isPending}
                    data-testid={`delete-field-${change.id}`}
                  >
                    {t('delete_field')}
                  </Button>
                </>
              )}

              {change.changeType === 'field_added' && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAction(() =>
                      addFieldFromPlatformAction({
                        ...baseInput,
                        tableId: tableId ?? '',
                        fieldName: newName,
                        fieldType: newType,
                        platformFieldType: newType,
                      }),
                    )}
                    disabled={isPending || !tableId}
                    data-testid={`add-field-${change.id}`}
                  >
                    {t('add_to_everystack')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction(() => ignoreSchemaChangeAction(baseInput))}
                    disabled={isPending}
                    data-testid={`ignore-field-${change.id}`}
                  >
                    {t('ignore')}
                  </Button>
                </>
              )}

              {change.changeType === 'field_renamed' && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAction(() =>
                      acceptRenameAction({ ...baseInput, newName }),
                    )}
                    disabled={isPending}
                    data-testid={`accept-rename-${change.id}`}
                  >
                    {t('accept_rename')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction(() => rejectRenameAction(baseInput))}
                    disabled={isPending}
                    data-testid={`reject-rename-${change.id}`}
                  >
                    {t('keep_local_name')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SchemaChangesTab
// ---------------------------------------------------------------------------

export function SchemaChangesTab({
  baseConnectionId,
  platform,
  tableId,
  changes,
  onMutate,
}: SchemaChangesTabProps) {
  const t = useTranslations('sync_schema_changes');
  const [isPending, setIsPending] = useState(false);

  const pendingChanges = changes.filter((c) => c.status === 'pending');

  // Empty state
  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12" data-testid="schema-changes-tab-empty">
        <p className="text-[14px] text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="schema-changes-tab">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-foreground">
          {t('pending_count', { count: pendingChanges.length })}
        </p>
      </div>

      {/* Change list */}
      <ScrollArea className="max-h-[480px]">
        <div className="flex flex-col gap-2">
          {changes.map((change) => (
            <SchemaChangeRow
              key={change.id}
              change={change}
              platform={platform}
              tableId={tableId}
              baseConnectionId={baseConnectionId}
              onMutate={onMutate}
              isPending={isPending}
              onActionStart={() => setIsPending(true)}
              onActionEnd={() => setIsPending(false)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function SchemaChangesTabSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[80px] w-full rounded-lg" />
      ))}
    </div>
  );
}
