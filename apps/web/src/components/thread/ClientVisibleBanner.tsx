'use client';

/**
 * ClientVisibleBanner — persistent, non-dismissible warning above the
 * chat input when composing in the client thread tab.
 *
 * Reminds workspace users that messages in this thread are visible to
 * the portal client.
 *
 * @see docs/reference/communications.md § Two-Thread Model (CP-001-D)
 */

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ClientVisibleBanner() {
  const t = useTranslations('thread');

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-amber-50 text-amber-800 border-b border-amber-200"
      role="status"
      data-testid="client-visible-banner"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
      <span>{t('clientVisibleWarning')}</span>
    </div>
  );
}
