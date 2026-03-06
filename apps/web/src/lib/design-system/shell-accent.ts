/**
 * Shell Accent Token System (CP-002)
 *
 * Controls per-tenant shell repainting via the --shell-accent CSS custom property.
 * Three accent contexts:
 *   - Personal tenant: fixed warm neutral (never matches org accents)
 *   - Org tenant: one of 8 curated accent colors
 *   - Portal: system-owned, non-customisable
 *
 * Reference: docs/reference/design-system.md §Shell Accent Token
 * Reference: docs/reference/navigation.md §Contextual Clarity
 */

import { WORKSPACE_ACCENT_COLORS, DEFAULT_ACCENT_COLOR } from './colors';

/** Warm neutral accent for personal tenant — stone-500. Never reused by org tenants. */
export const PERSONAL_TENANT_ACCENT = '#78716C';

/** System-owned portal accent — slate. Not customisable by tenants. */
export const PORTAL_ACCENT = '#64748B';

/** The 8 curated org accent colors (re-exported from colors.ts for convenience). */
export const ORG_ACCENT_OPTIONS = WORKSPACE_ACCENT_COLORS;

/** Default accent when an org tenant has no configured accent color. */
export { DEFAULT_ACCENT_COLOR };

/**
 * Returns the correct shell accent for the given tenant context.
 *
 * @param tenantId - The tenant ID (used for future extensions, not used in logic today)
 * @param isPersonalTenant - Whether this is the user's personal tenant
 * @param accentColor - The tenant's configured accent color (from tenants.settings.branding_accent_color)
 * @returns The hex color to apply as --shell-accent
 */
export function getShellAccent(
  _tenantId: string,
  isPersonalTenant: boolean,
  accentColor?: string | null,
): string {
  if (isPersonalTenant) {
    return PERSONAL_TENANT_ACCENT;
  }

  if (accentColor && isValidAccentColor(accentColor)) {
    return accentColor;
  }

  return DEFAULT_ACCENT_COLOR;
}

/**
 * Validates that a hex color is one of the 8 curated org accent options.
 * Case-insensitive comparison.
 */
export function isValidAccentColor(hex: string): boolean {
  const normalized = hex.toUpperCase();
  return ORG_ACCENT_OPTIONS.some(
    (option) => option.hex.toUpperCase() === normalized,
  );
}
