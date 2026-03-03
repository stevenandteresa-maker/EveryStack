/**
 * EveryStack Typography Scale
 *
 * 9-step type scale used across the entire application.
 * No arbitrary font sizes — all text uses one of these 9 steps.
 *
 * Font families:
 *   - DM Sans: UI text, headings, body copy
 *   - JetBrains Mono: code, field values, monospace contexts
 */

export interface TypographyStep {
  /** CSS font-size value */
  fontSize: string;
  /** CSS font-weight value */
  fontWeight: number;
  /** CSS line-height value */
  lineHeight: string;
}

export const TYPOGRAPHY_SCALE = {
  'page-title': { fontSize: '28px', fontWeight: 700, lineHeight: '36px' },
  h1: { fontSize: '24px', fontWeight: 700, lineHeight: '32px' },
  h2: { fontSize: '20px', fontWeight: 600, lineHeight: '28px' },
  h3: { fontSize: '18px', fontWeight: 600, lineHeight: '24px' },
  'body-lg': { fontSize: '16px', fontWeight: 400, lineHeight: '24px' },
  body: { fontSize: '14px', fontWeight: 400, lineHeight: '20px' },
  'body-sm': { fontSize: '13px', fontWeight: 400, lineHeight: '18px' },
  caption: { fontSize: '12px', fontWeight: 400, lineHeight: '16px' },
  timestamp: { fontSize: '11px', fontWeight: 400, lineHeight: '14px' },
} as const satisfies Record<string, TypographyStep>;

export type TypographyStepName = keyof typeof TYPOGRAPHY_SCALE;
