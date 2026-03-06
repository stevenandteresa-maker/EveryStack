'use client';

// ---------------------------------------------------------------------------
// ConflictResolutionActions — bulk action bar for multi-field conflicts.
//
// Renders "Keep All EveryStack" and "Keep All {Platform}" buttons.
// Disabled when all conflicts are already resolved.
// ---------------------------------------------------------------------------

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ConflictItem, ConflictResolution } from './conflict-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConflictResolutionActionsProps {
  /** All conflicts for this record. */
  conflicts: ConflictItem[];
  /** Current resolution state per conflict. */
  resolutions: Map<string, ConflictResolution>;
  /** Called to resolve all pending conflicts with the given choice. */
  onKeepAllLocal: () => void;
  /** Called to resolve all pending conflicts with the remote value. */
  onKeepAllRemote: () => void;
  /** Platform name for display. */
  platform: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConflictResolutionActions({
  conflicts,
  resolutions,
  onKeepAllLocal,
  onKeepAllRemote,
  platform,
}: ConflictResolutionActionsProps) {
  const t = useTranslations('sync_conflicts');

  const pendingCount = conflicts.filter((c) => !resolutions.has(c.id)).length;
  const allResolved = pendingCount === 0;
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
    <div data-testid="conflict-bulk-actions">
      <Separator className="mb-4" />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="default"
          className="min-h-[44px]"
          disabled={allResolved}
          onClick={onKeepAllLocal}
          data-testid="conflict-keep-all-local"
        >
          {t('keep_all_local')}
        </Button>
        <Button
          size="sm"
          variant="default"
          className="min-h-[44px]"
          disabled={allResolved}
          onClick={onKeepAllRemote}
          data-testid="conflict-keep-all-remote"
        >
          {t('keep_all_remote', { platform: platformLabel })}
        </Button>
        {!allResolved && (
          <span className="text-xs text-muted-foreground">
            {t('pending_count', { count: pendingCount })}
          </span>
        )}
      </div>
    </div>
  );
}
