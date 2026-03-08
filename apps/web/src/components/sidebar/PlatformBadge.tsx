'use client';

/**
 * PlatformBadge — 14×14px platform logo overlay for synced table icons.
 *
 * Renders at bottom-right of the parent table icon with a 2px offset
 * and 1px white border to visually separate from the parent icon.
 * Native tables (platform = null) render nothing.
 *
 * @see docs/reference/field-groups.md § Synced Table Tab Badges
 */

import { AirtableLogo, NotionLogo, SmartSuiteLogo } from '@/components/icons/platforms';

export interface PlatformBadgeProps {
  platform: 'airtable' | 'notion' | 'smartsuite' | null;
}

const PLATFORM_LOGOS: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  airtable: AirtableLogo,
  notion: NotionLogo,
  smartsuite: SmartSuiteLogo,
};

export function PlatformBadge({ platform }: PlatformBadgeProps) {
  if (!platform) return null;

  const Logo = PLATFORM_LOGOS[platform];
  if (!Logo) return null;

  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-white"
      data-testid={`platform-badge-${platform}`}
    >
      <Logo className="h-2.5 w-2.5" />
    </span>
  );
}
