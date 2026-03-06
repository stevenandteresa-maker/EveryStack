'use client';

/**
 * PortalSection — Renders portal entries in the sidebar below a visual divider.
 *
 * Visual distinction rules (navigation.md § Portal Display):
 * - Uses system-owned --portal-accent colour (non-customisable)
 * - Uses dedicated Globe icon (distinct from tenant/workspace icon families)
 * - Click navigates to portal URL — does NOT trigger shell repainting
 * - Section divider hidden when no portal entries exist
 *
 * Data boundary enforcement:
 * - Portal is a display convenience, not a data bridge
 * - No cross-linking from portal context into user's own workspaces
 */

import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { PortalNavEntry } from '@/data/sidebar-navigation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PortalSectionProps {
  portals: PortalNavEntry[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortalSection({ portals }: PortalSectionProps) {
  const t = useTranslations('shell.sidebar');

  if (portals.length === 0) {
    return null;
  }

  return (
    <div data-testid="portal-section" className="mt-4">
      {/* Section divider */}
      <div className="px-2 pb-1" data-testid="portal-divider">
        <span className="text-caption font-semibold uppercase tracking-wider text-[var(--sidebar-text-muted)]">
          {t('portals')}
        </span>
      </div>

      {/* Portal entries */}
      {portals.map((portal) => (
        <a
          key={portal.portalId}
          href={`/portal/${portal.portalSlug}`}
          data-testid={`portal-entry-${portal.portalId}`}
          aria-label={t('portalNavigate', { portalName: portal.portalName })}
          className={cn(
            'flex items-center gap-2 w-full px-2 py-1.5 rounded',
            'text-body-sm text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)]',
            'transition-colors duration-150',
          )}
        >
          <Globe
            size={16}
            className="shrink-0"
            style={{ color: 'var(--portal-accent)' }}
          />
          <span className="truncate">{portal.portalName}</span>
          <span className="ml-auto text-caption text-[var(--sidebar-text-muted)] truncate">
            {portal.tenantName}
          </span>
        </a>
      ))}
    </div>
  );
}
