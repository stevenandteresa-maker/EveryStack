'use client';

/**
 * SidebarHeader — Signal 1 of Contextual Clarity (CP-002)
 *
 * Always visible at the top of the sidebar in both collapsed and expanded states.
 * Provides immediate visual context for the active tenant:
 *   - Personal tenant: user avatar + "{User}'s Workspace" + "Personal" qualifier
 *   - Org tenant: org first-letter avatar (accent-colored) + org name
 *
 * @see docs/reference/navigation.md §Contextual Clarity — Three Mandatory Signals
 */

import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { TenantNavSection } from '@/data/sidebar-navigation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SidebarHeaderProps {
  activeTenant: TenantNavSection | null;
  collapsed: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SidebarHeader({ activeTenant, collapsed }: SidebarHeaderProps) {
  const { user } = useUser();
  const t = useTranslations('shell.sidebar');

  if (!activeTenant) return null;

  const isPersonal = activeTenant.isPersonalTenant;
  const displayName = activeTenant.tenantName;
  const firstLetter = displayName.charAt(0).toUpperCase();

  // Personal tenant: use Clerk user avatar; Org: first-letter fallback
  const avatarUrl = isPersonal ? (user?.imageUrl ?? null) : null;

  if (collapsed) {
    return (
      <div
        data-testid="sidebar-header"
        className="flex items-center justify-center py-2"
        role="banner"
        aria-label={t('currentWorkspace')}
      >
        <SidebarAvatar
          url={avatarUrl}
          fallbackLetter={firstLetter}
          isPersonal={isPersonal}
          size="sm"
        />
      </div>
    );
  }

  return (
    <div
      data-testid="sidebar-header"
      className={cn(
        'flex items-center gap-3 px-3 py-2',
        'sticky top-0 z-10 bg-[var(--sidebar-bg)]',
        'border-b border-white/5',
      )}
      role="banner"
      aria-label={t('currentWorkspace')}
    >
      <SidebarAvatar
        url={avatarUrl}
        fallbackLetter={firstLetter}
        isPersonal={isPersonal}
        size="md"
      />
      <div className="flex flex-col min-w-0">
        <span
          data-testid="sidebar-header-name"
          className="text-body-sm font-semibold text-[var(--sidebar-text)] truncate"
        >
          {displayName}
        </span>
        {isPersonal && (
          <span
            data-testid="sidebar-header-qualifier"
            className="text-caption text-[var(--sidebar-text-muted)]"
          >
            {t('personalQualifier')}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal Avatar
// ---------------------------------------------------------------------------

interface SidebarAvatarProps {
  url: string | null;
  fallbackLetter: string;
  isPersonal: boolean;
  size: 'sm' | 'md';
}

function SidebarAvatar({ url, fallbackLetter, isPersonal, size }: SidebarAvatarProps) {
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-caption' : 'w-9 h-9 text-body-sm';

  const pixelSize = size === 'sm' ? 32 : 36;

  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={pixelSize}
        height={pixelSize}
        data-testid="sidebar-header-avatar"
        className={cn(sizeClasses, 'rounded-full object-cover shrink-0')}
      />
    );
  }

  return (
    <div
      data-testid="sidebar-header-avatar"
      className={cn(
        sizeClasses,
        'rounded-full flex items-center justify-center shrink-0 font-semibold text-white',
        isPersonal
          ? 'bg-[var(--personal-accent)]'
          : 'bg-[var(--shell-accent)]',
      )}
      aria-hidden="true"
    >
      {fallbackLetter}
    </div>
  );
}
