import { describe, it, expect } from 'vitest';
import {
  PERSONAL_TENANT_ACCENT,
  PORTAL_ACCENT,
  ORG_ACCENT_OPTIONS,
  DEFAULT_ACCENT_COLOR,
  getShellAccent,
  isValidAccentColor,
} from './shell-accent';

describe('shell-accent', () => {
  describe('constants', () => {
    it('PERSONAL_TENANT_ACCENT is warm neutral stone-500', () => {
      expect(PERSONAL_TENANT_ACCENT).toBe('#78716C');
    });

    it('PORTAL_ACCENT is system-owned slate', () => {
      expect(PORTAL_ACCENT).toBe('#64748B');
    });

    it('personal accent does not match any org accent option', () => {
      const orgHexes = ORG_ACCENT_OPTIONS.map((o) => o.hex.toUpperCase());
      expect(orgHexes).not.toContain(PERSONAL_TENANT_ACCENT.toUpperCase());
    });

    it('portal accent is not affected by org accent options', () => {
      const orgHexes = ORG_ACCENT_OPTIONS.map((o) => o.hex.toUpperCase());
      expect(orgHexes).not.toContain(PORTAL_ACCENT.toUpperCase());
    });

    it('ORG_ACCENT_OPTIONS has exactly 8 curated colors', () => {
      expect(ORG_ACCENT_OPTIONS).toHaveLength(8);
    });
  });

  describe('getShellAccent', () => {
    it('returns warm neutral for personal tenant', () => {
      const result = getShellAccent('tenant-1', true, '#1D4ED8');
      expect(result).toBe(PERSONAL_TENANT_ACCENT);
    });

    it('returns warm neutral for personal tenant even with no accent', () => {
      const result = getShellAccent('tenant-1', true);
      expect(result).toBe(PERSONAL_TENANT_ACCENT);
    });

    it('returns configured accent for org tenant', () => {
      const result = getShellAccent('tenant-2', false, '#1D4ED8');
      expect(result).toBe('#1D4ED8');
    });

    it('defaults to Teal when org tenant has no accent configured', () => {
      const result = getShellAccent('tenant-2', false);
      expect(result).toBe(DEFAULT_ACCENT_COLOR);
    });

    it('defaults to Teal when org tenant has null accent', () => {
      const result = getShellAccent('tenant-2', false, null);
      expect(result).toBe(DEFAULT_ACCENT_COLOR);
    });

    it('defaults to Teal when org tenant has invalid accent color', () => {
      const result = getShellAccent('tenant-2', false, '#FF00FF');
      expect(result).toBe(DEFAULT_ACCENT_COLOR);
    });

    it('returns correct accent for each of the 8 org options', () => {
      for (const option of ORG_ACCENT_OPTIONS) {
        const result = getShellAccent('tenant-x', false, option.hex);
        expect(result).toBe(option.hex);
      }
    });
  });

  describe('isValidAccentColor', () => {
    it('accepts all 8 curated accent colors', () => {
      for (const option of ORG_ACCENT_OPTIONS) {
        expect(isValidAccentColor(option.hex)).toBe(true);
      }
    });

    it('is case-insensitive', () => {
      expect(isValidAccentColor('#0d9488')).toBe(true);
      expect(isValidAccentColor('#0D9488')).toBe(true);
    });

    it('rejects arbitrary hex colors', () => {
      expect(isValidAccentColor('#FF00FF')).toBe(false);
      expect(isValidAccentColor('#000000')).toBe(false);
    });

    it('rejects the personal tenant accent', () => {
      expect(isValidAccentColor(PERSONAL_TENANT_ACCENT)).toBe(false);
    });

    it('rejects the portal accent', () => {
      expect(isValidAccentColor(PORTAL_ACCENT)).toBe(false);
    });
  });

  describe('contrast validation — all accents readable with white text', () => {
    /**
     * Relative luminance per WCAG 2.0 formula.
     * https://www.w3.org/TR/WCAG20/#relativeluminancedef
     */
    function relativeLuminance(hex: string): number {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const toLinear = (c: number) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }

    function contrastRatio(bg: string, fg: string): number {
      const l1 = relativeLuminance(fg);
      const l2 = relativeLuminance(bg);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const WHITE = '#FFFFFF';

    // WCAG AA Large Text threshold (3:1) — header bar uses bold text + icons
    // which qualify as "large text" per WCAG 2.1 Success Criterion 1.4.3.
    // All 8 curated colors were chosen by design to be readable with white on headers.
    const LARGE_TEXT_THRESHOLD = 3;

    it('all 8 org accent colors pass >= 3:1 contrast with white (WCAG AA large text)', () => {
      for (const option of ORG_ACCENT_OPTIONS) {
        const ratio = contrastRatio(option.hex, WHITE);
        expect(
          ratio,
          `${option.name} (${option.hex}) contrast ratio ${ratio.toFixed(2)} < ${LARGE_TEXT_THRESHOLD}`,
        ).toBeGreaterThanOrEqual(LARGE_TEXT_THRESHOLD);
      }
    });

    it('personal tenant accent passes >= 3:1 contrast with white (WCAG AA large text)', () => {
      const ratio = contrastRatio(PERSONAL_TENANT_ACCENT, WHITE);
      expect(
        ratio,
        `Personal accent contrast ratio ${ratio.toFixed(2)} < ${LARGE_TEXT_THRESHOLD}`,
      ).toBeGreaterThanOrEqual(LARGE_TEXT_THRESHOLD);
    });

    it('most org accents pass >= 4.5:1 for normal text (WCAG AA)', () => {
      // 7 of 8 org accents pass 4.5:1 — Teal (#0D9488) is 3.74:1,
      // acceptable for header context (bold/large text) but not normal body text.
      const passing = ORG_ACCENT_OPTIONS.filter(
        (option) => contrastRatio(option.hex, WHITE) >= 4.5,
      );
      expect(passing.length).toBeGreaterThanOrEqual(7);
    });
  });
});
