import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WORKSPACE_ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR,
  applyAccentColor,
  DATA_COLORS,
  getDataColor,
  getContrastText,
  PROCESS_STATE_COLORS,
} from './colors';

// ---------------------------------------------------------------------------
// Workspace Accent Colors
// ---------------------------------------------------------------------------

describe('WORKSPACE_ACCENT_COLORS', () => {
  it('exports exactly 8 accent colors', () => {
    expect(WORKSPACE_ACCENT_COLORS).toHaveLength(8);
  });

  it('each color has name, hex, and tailwind fields', () => {
    for (const color of WORKSPACE_ACCENT_COLORS) {
      expect(color).toHaveProperty('name');
      expect(color).toHaveProperty('hex');
      expect(color).toHaveProperty('tailwind');
    }
  });

  it('all hex values are valid 7-character hex codes', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const color of WORKSPACE_ACCENT_COLORS) {
      expect(color.hex).toMatch(hexPattern);
    }
  });

  it('contains the expected color names', () => {
    const names = WORKSPACE_ACCENT_COLORS.map((c) => c.name);
    expect(names).toEqual([
      'Teal',
      'Ocean Blue',
      'Indigo',
      'Deep Purple',
      'Rose',
      'Amber',
      'Forest',
      'Slate',
    ]);
  });
});

describe('DEFAULT_ACCENT_COLOR', () => {
  it('is Teal (#0D9488)', () => {
    expect(DEFAULT_ACCENT_COLOR).toBe('#0D9488');
  });

  it('matches the first accent color hex', () => {
    expect(DEFAULT_ACCENT_COLOR).toBe(WORKSPACE_ACCENT_COLORS[0]!.hex);
  });
});

// ---------------------------------------------------------------------------
// applyAccentColor
// ---------------------------------------------------------------------------

describe('applyAccentColor', () => {
  let setPropertySpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setPropertySpy = vi.fn();
    vi.stubGlobal('document', {
      documentElement: {
        style: {
          setProperty: setPropertySpy,
        },
      },
    });
  });

  it('sets the --workspace-accent CSS custom property on document root', () => {
    applyAccentColor('#1D4ED8');
    expect(setPropertySpy).toHaveBeenCalledWith('--workspace-accent', '#1D4ED8');
  });

  it('works with the default accent color', () => {
    applyAccentColor(DEFAULT_ACCENT_COLOR);
    expect(setPropertySpy).toHaveBeenCalledWith('--workspace-accent', '#0D9488');
  });
});

// ---------------------------------------------------------------------------
// Data Color Palette
// ---------------------------------------------------------------------------

describe('DATA_COLORS', () => {
  it('exports exactly 13 data colors', () => {
    expect(DATA_COLORS).toHaveLength(13);
  });

  it('each color has name, light, and saturated fields', () => {
    for (const color of DATA_COLORS) {
      expect(color).toHaveProperty('name');
      expect(color).toHaveProperty('light');
      expect(color).toHaveProperty('saturated');
    }
  });

  it('all light hex values are valid', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const color of DATA_COLORS) {
      expect(color.light).toMatch(hexPattern);
    }
  });

  it('all saturated hex values are valid', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const color of DATA_COLORS) {
      expect(color.saturated).toMatch(hexPattern);
    }
  });

  it('contains the expected 13 color names in order', () => {
    const names = DATA_COLORS.map((c) => c.name);
    expect(names).toEqual([
      'Red',
      'Orange',
      'Amber',
      'Yellow',
      'Lime',
      'Green',
      'Teal',
      'Cyan',
      'Blue',
      'Indigo',
      'Purple',
      'Pink',
      'Gray',
    ]);
  });
});

// ---------------------------------------------------------------------------
// getDataColor
// ---------------------------------------------------------------------------

describe('getDataColor', () => {
  it('returns the correct color for index 0', () => {
    expect(getDataColor(0).name).toBe('Red');
  });

  it('returns the correct color for index 12 (last)', () => {
    expect(getDataColor(12).name).toBe('Gray');
  });

  it('wraps around at 13 — index 13 returns same as index 0', () => {
    expect(getDataColor(13)).toEqual(getDataColor(0));
  });

  it('wraps around at higher multiples', () => {
    expect(getDataColor(26)).toEqual(getDataColor(0));
    expect(getDataColor(14)).toEqual(getDataColor(1));
  });

  it('handles negative indices by wrapping', () => {
    expect(getDataColor(-1)).toEqual(getDataColor(12));
    expect(getDataColor(-13)).toEqual(getDataColor(0));
  });
});

// ---------------------------------------------------------------------------
// getContrastText
// ---------------------------------------------------------------------------

describe('getContrastText', () => {
  it('returns dark text (#0F172A) for all 13 light backgrounds', () => {
    for (const color of DATA_COLORS) {
      expect(getContrastText(color.light)).toBe('#0F172A');
    }
  });

  it('returns white text (#FFFFFF) for all 13 saturated backgrounds', () => {
    for (const color of DATA_COLORS) {
      expect(getContrastText(color.saturated)).toBe('#FFFFFF');
    }
  });

  it('falls back to dark text for unknown backgrounds', () => {
    expect(getContrastText('#ABCDEF')).toBe('#0F172A');
  });
});

// ---------------------------------------------------------------------------
// Process State Colors
// ---------------------------------------------------------------------------

describe('PROCESS_STATE_COLORS', () => {
  it('defines error as #DC2626', () => {
    expect(PROCESS_STATE_COLORS.error).toBe('#DC2626');
  });

  it('defines warning as #D97706', () => {
    expect(PROCESS_STATE_COLORS.warning).toBe('#D97706');
  });

  it('defines success as #059669', () => {
    expect(PROCESS_STATE_COLORS.success).toBe('#059669');
  });
});
