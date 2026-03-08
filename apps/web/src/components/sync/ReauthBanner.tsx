'use client';

/**
 * ReauthBanner — Displays a recovery banner at the top of synced tables
 * when the OAuth connection has expired or permissions have been denied.
 *
 * Two variants:
 * - auth_expired: "Your connection to {Platform} has expired. Re-authenticate to resume syncing."
 * - permission_denied: "Your {Platform} integration no longer has write access. Ask the admin to restore permissions."
 *
 * @see docs/reference/sync-engine.md § Error Recovery Flows
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReauthBannerProps {
  /** The type of auth error driving the banner display. */
  errorType: 'auth_expired' | 'permission_denied';
  /** Platform display name (e.g. "Airtable", "Notion"). */
  platform: string;
  /** Called when the user clicks "[Re-authenticate]". Only used for auth_expired. */
  onReauthenticate?: () => void;
  /** Called when the user clicks "[Retry Now]". Only used for permission_denied. */
  onRetryNow?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReauthBanner({
  errorType,
  platform,
  onReauthenticate,
  onRetryNow,
}: ReauthBannerProps) {
  const t = useTranslations('sync_recovery');

  const isAuthExpired = errorType === 'auth_expired';

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-md border border-red-200 bg-red-50 px-4 py-3"
      role="alert"
      data-testid={`reauth-banner-${errorType}`}
    >
      <p className="text-[13px] font-medium text-red-800">
        {isAuthExpired
          ? t('auth_expired_message', { platform })
          : t('permission_denied_message', { platform })}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {isAuthExpired ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onReauthenticate}
            data-testid="reauth-button"
          >
            {t('reauthenticate')}
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onRetryNow}
            data-testid="retry-now-button"
          >
            {t('retry_now')}
          </Button>
        )}
      </div>
    </div>
  );
}
