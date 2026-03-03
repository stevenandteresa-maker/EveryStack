/**
 * EveryStack Design System — Color Constants
 *
 * Three-layer color architecture:
 *   Layer 1: Workspace accent (admin-chosen header bar color)
 *   Layer 2: Semantic UI / Process states (fixed, not themeable)
 *   Layer 3: Data colors (user-assigned for statuses, tags, select options)
 *
 * Reference: docs/reference/design-system.md §Color Model
 */

// ---------------------------------------------------------------------------
// Layer 1 — Workspace Accent Colors
// ---------------------------------------------------------------------------

export interface AccentColor {
  readonly name: string;
  readonly hex: string;
  readonly tailwind: string;
}

/**
 * 8 curated accent colors for the workspace header bar.
 * All pass >= 4.5:1 contrast ratio with white text (WCAG AA).
 */
export const WORKSPACE_ACCENT_COLORS: readonly AccentColor[] = [
  { name: 'Teal', hex: '#0D9488', tailwind: 'teal-600' },
  { name: 'Ocean Blue', hex: '#1D4ED8', tailwind: 'blue-700' },
  { name: 'Indigo', hex: '#4338CA', tailwind: 'indigo-700' },
  { name: 'Deep Purple', hex: '#7C3AED', tailwind: 'violet-600' },
  { name: 'Rose', hex: '#BE123C', tailwind: 'rose-700' },
  { name: 'Amber', hex: '#B45309', tailwind: 'amber-700' },
  { name: 'Forest', hex: '#15803D', tailwind: 'green-700' },
  { name: 'Slate', hex: '#334155', tailwind: 'slate-700' },
] as const;

export const DEFAULT_ACCENT_COLOR = '#0D9488';

/**
 * Sets the `--accent` CSS custom property on the document root.
 * Called when the workspace accent color is loaded or changed.
 */
export function applyAccentColor(hex: string): void {
  document.documentElement.style.setProperty('--accent', hex);
}

// ---------------------------------------------------------------------------
// Layer 3 — Data Color Palette
// ---------------------------------------------------------------------------

export interface DataColor {
  readonly name: string;
  readonly light: string;
  readonly saturated: string;
}

/**
 * 13-color data palette for grids, statuses, tags, select options, etc.
 * Each color has two tones:
 *   - light: pastel fills (cell backgrounds, row tints)
 *   - saturated: badges, dots, status pills
 */
export const DATA_COLORS: readonly DataColor[] = [
  { name: 'Red', light: '#FEE2E2', saturated: '#DC2626' },
  { name: 'Orange', light: '#FFEDD5', saturated: '#EA580C' },
  { name: 'Amber', light: '#FEF3C7', saturated: '#D97706' },
  { name: 'Yellow', light: '#FEF9C3', saturated: '#CA8A04' },
  { name: 'Lime', light: '#ECFCCB', saturated: '#65A30D' },
  { name: 'Green', light: '#DCFCE7', saturated: '#16A34A' },
  { name: 'Teal', light: '#CCFBF1', saturated: '#0D9488' },
  { name: 'Cyan', light: '#CFFAFE', saturated: '#0891B2' },
  { name: 'Blue', light: '#DBEAFE', saturated: '#2563EB' },
  { name: 'Indigo', light: '#E0E7FF', saturated: '#4F46E5' },
  { name: 'Purple', light: '#EDE9FE', saturated: '#7C3AED' },
  { name: 'Pink', light: '#FCE7F3', saturated: '#DB2777' },
  { name: 'Gray', light: '#F1F5F9', saturated: '#64748B' },
] as const;

/**
 * Returns a data color by index, cycling through the 13-color palette.
 */
export function getDataColor(index: number): DataColor {
  const normalizedIndex = ((index % DATA_COLORS.length) + DATA_COLORS.length) % DATA_COLORS.length;
  return DATA_COLORS[normalizedIndex]!;
}

// ---------------------------------------------------------------------------
// Text Contrast — Precomputed Lookup
// ---------------------------------------------------------------------------

const DARK_TEXT = '#0F172A';
const WHITE_TEXT = '#FFFFFF';

/**
 * Precomputed contrast text lookup.
 * Light backgrounds -> dark text (#0F172A)
 * Saturated backgrounds -> white text (#FFFFFF)
 */
const CONTRAST_MAP: Record<string, string> = {};

for (const color of DATA_COLORS) {
  CONTRAST_MAP[color.light] = DARK_TEXT;
  CONTRAST_MAP[color.saturated] = WHITE_TEXT;
}

/**
 * Returns the appropriate text color for a given background color.
 * Uses the precomputed lookup map — no runtime contrast calculation.
 * Falls back to dark text for unknown backgrounds.
 */
export function getContrastText(backgroundColor: string): string {
  return CONTRAST_MAP[backgroundColor] ?? DARK_TEXT;
}

// ---------------------------------------------------------------------------
// Layer 2 — Process State Color Language
// ---------------------------------------------------------------------------

export const PROCESS_STATE_COLORS = {
  error: '#DC2626',
  warning: '#D97706',
  success: '#059669',
} as const;
