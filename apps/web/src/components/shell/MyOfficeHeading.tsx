'use client';

/**
 * MyOfficeHeading — Signal 3 of Contextual Clarity (CP-002)
 *
 * Page-level heading for the My Office view. Always tenant-qualified:
 *   - Personal tenant: "My Office · Personal"
 *   - Org tenant: "My Office · [Tenant Name]"
 *   - Agency member in client tenant: "My Office · [Client Tenant Name]"
 *
 * Updates dynamically on tenant switch (re-renders with new tenant context).
 *
 * @see docs/reference/navigation.md §Contextual Clarity — Three Mandatory Signals
 */

import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MyOfficeHeadingProps {
  isPersonalTenant: boolean;
  tenantName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MyOfficeHeading({ isPersonalTenant, tenantName }: MyOfficeHeadingProps) {
  const t = useTranslations('my_office');

  const heading = isPersonalTenant
    ? t('heading_personal')
    : t('heading_org', { tenantName });

  return (
    <h1
      data-testid="my-office-heading"
      className="text-h1 font-bold text-[var(--text-primary)]"
    >
      {heading}
    </h1>
  );
}
