// @vitest-environment jsdom
/**
 * Tests for Prompt 10: Table type system, tab colors, performance banners,
 * loading skeleton, and empty state.
 *
 * @see docs/Playbooks/playbook-phase-3a-i.md § Prompt 10
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import { TableTypeIcon } from '../TableTypeIcon';
import { PerformanceBanner } from '../PerformanceBanner';
import { GridSkeleton } from '../GridSkeleton';
import { GridEmptyState } from '../GridEmptyState';
import {
  TABLE_TYPES,
  TAB_COLOR_PALETTE,
  resolveTabColor,
  isValidTableType,
} from '../../../lib/constants/table-types';

// ---------------------------------------------------------------------------
// Table type constants
// ---------------------------------------------------------------------------

describe('TABLE_TYPES', () => {
  it('defines metadata for all 5 table types', () => {
    const types = ['table', 'projects', 'calendar', 'documents', 'wiki'] as const;
    for (const type of types) {
      expect(TABLE_TYPES[type]).toBeDefined();
      expect(TABLE_TYPES[type].icon).toBeTruthy();
      expect(TABLE_TYPES[type].defaultTabColor).toMatch(/^#/);
      expect(TABLE_TYPES[type].defaultView).toBe('grid');
      expect(TABLE_TYPES[type].labelKey).toBeTruthy();
    }
  });

  it('all default to grid view for MVP', () => {
    for (const meta of Object.values(TABLE_TYPES)) {
      expect(meta.defaultView).toBe('grid');
    }
  });
});

describe('TAB_COLOR_PALETTE', () => {
  it('has 10 colors', () => {
    expect(TAB_COLOR_PALETTE).toHaveLength(10);
  });

  it('each color has name, hex, darkHex, and labelKey', () => {
    for (const color of TAB_COLOR_PALETTE) {
      expect(color.name).toBeTruthy();
      expect(color.hex).toMatch(/^#/);
      expect(color.darkHex).toMatch(/^#/);
      expect(color.labelKey).toBeTruthy();
    }
  });
});

describe('resolveTabColor', () => {
  it('returns custom tab color when set', () => {
    expect(resolveTabColor('table', '#FF0000')).toBe('#FF0000');
  });

  it('returns table type dark hex when no custom color (dark mode)', () => {
    const result = resolveTabColor('projects', null, true);
    // Projects default is #0D9488 (Teal), dark mode is #2DD4BF
    expect(result).toBe('#2DD4BF');
  });

  it('returns table type light hex when no custom color (light mode)', () => {
    const result = resolveTabColor('projects', null, false);
    expect(result).toBe('#0D9488');
  });

  it('returns table default when type is unknown', () => {
    const result = resolveTabColor('unknown', null, false);
    expect(result).toBe(TABLE_TYPES.table.defaultTabColor);
  });
});

describe('isValidTableType', () => {
  it('returns true for valid types', () => {
    expect(isValidTableType('table')).toBe(true);
    expect(isValidTableType('projects')).toBe(true);
    expect(isValidTableType('wiki')).toBe(true);
  });

  it('returns false for invalid types', () => {
    expect(isValidTableType('invalid')).toBe(false);
    expect(isValidTableType('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TableTypeIcon
// ---------------------------------------------------------------------------

describe('TableTypeIcon', () => {
  const types = ['table', 'projects', 'calendar', 'documents', 'wiki'] as const;

  for (const type of types) {
    it(`renders icon for ${type} type`, () => {
      const { container } = render(
        <IntlWrapper>
          <TableTypeIcon tableType={type} />
        </IntlWrapper>,
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
    });
  }

  it('renders default (Table2) for unknown type', () => {
    const { container } = render(
      <IntlWrapper>
        <TableTypeIcon tableType="unknown" />
      </IntlWrapper>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('applies custom size', () => {
    const { container } = render(
      <IntlWrapper>
        <TableTypeIcon tableType="table" size={24} />
      </IntlWrapper>,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
  });

  it('applies custom className', () => {
    const { container } = render(
      <IntlWrapper>
        <TableTypeIcon tableType="table" className="text-red-500" />
      </IntlWrapper>,
    );
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('text-red-500')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PerformanceBanner
// ---------------------------------------------------------------------------

describe('PerformanceBanner', () => {
  it('renders nothing when below all thresholds', () => {
    const { container } = render(
      <IntlWrapper>
        <PerformanceBanner totalRowCount={5000} visibleColumnCount={10} />
      </IntlWrapper>,
    );
    expect(container.querySelector('[data-testid="performance-banners"]')).toBeNull();
  });

  it('renders info banner at >10K rows', () => {
    render(
      <IntlWrapper>
        <PerformanceBanner totalRowCount={15000} visibleColumnCount={10} />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('performance-banner-rows-10k')).toBeTruthy();
  });

  it('renders warning banner at >50K rows (not info)', () => {
    render(
      <IntlWrapper>
        <PerformanceBanner totalRowCount={60000} visibleColumnCount={10} />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('performance-banner-rows-50k')).toBeTruthy();
    expect(screen.queryByTestId('performance-banner-rows-10k')).toBeNull();
  });

  it('renders column suggestion at >30 columns', () => {
    render(
      <IntlWrapper>
        <PerformanceBanner totalRowCount={100} visibleColumnCount={35} />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('performance-banner-columns-30')).toBeTruthy();
  });

  it('renders still loading indicator', () => {
    render(
      <IntlWrapper>
        <PerformanceBanner
          totalRowCount={100}
          visibleColumnCount={10}
          isSlowLoading
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('performance-banner-slow-loading')).toBeTruthy();
  });

  it('dismisses a banner on click', () => {
    render(
      <IntlWrapper>
        <PerformanceBanner totalRowCount={15000} visibleColumnCount={10} />
      </IntlWrapper>,
    );
    const banner = screen.getByTestId('performance-banner-rows-10k');
    expect(banner).toBeTruthy();

    const dismissButton = banner.querySelector('button');
    expect(dismissButton).toBeTruthy();
    fireEvent.click(dismissButton!);

    expect(screen.queryByTestId('performance-banner-rows-10k')).toBeNull();
  });

  it('can show multiple banners simultaneously', () => {
    render(
      <IntlWrapper>
        <PerformanceBanner
          totalRowCount={15000}
          visibleColumnCount={35}
          isSlowLoading
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('performance-banner-rows-10k')).toBeTruthy();
    expect(screen.getByTestId('performance-banner-columns-30')).toBeTruthy();
    expect(screen.getByTestId('performance-banner-slow-loading')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GridSkeleton
// ---------------------------------------------------------------------------

describe('GridSkeleton', () => {
  it('renders with role="status"', () => {
    render(
      <IntlWrapper>
        <GridSkeleton />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('grid-skeleton')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders the specified number of rows', () => {
    const { container } = render(
      <IntlWrapper>
        <GridSkeleton rowCount={5} columnCount={3} />
      </IntlWrapper>,
    );
    // 1 header row + 5 data rows = 6 flex rows
    const rows = container.querySelectorAll('.flex.border-b');
    expect(rows.length).toBe(6);
  });

  it('uses custom row height', () => {
    const { container } = render(
      <IntlWrapper>
        <GridSkeleton rowCount={2} rowHeight={32} />
      </IntlWrapper>,
    );
    const rows = container.querySelectorAll('.flex.border-b');
    // Check any row has the expected height
    const firstRow = rows[0] as HTMLElement;
    expect(firstRow.style.height).toBe('32px');
  });
});

// ---------------------------------------------------------------------------
// GridEmptyState
// ---------------------------------------------------------------------------

describe('GridEmptyState', () => {
  it('renders empty state with title and description', () => {
    render(
      <IntlWrapper>
        <GridEmptyState />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('grid-empty-state')).toBeTruthy();
    // Should have text content (from i18n)
    expect(screen.getByTestId('grid-empty-state').textContent).toBeTruthy();
  });

  it('renders new record button when callback provided', () => {
    const onCreateRecord = vi.fn();
    render(
      <IntlWrapper>
        <GridEmptyState onCreateRecord={onCreateRecord} />
      </IntlWrapper>,
    );
    const button = screen.getByTestId('empty-state-new-record');
    expect(button).toBeTruthy();
  });

  it('calls onCreateRecord when button is clicked', () => {
    const onCreateRecord = vi.fn();
    render(
      <IntlWrapper>
        <GridEmptyState onCreateRecord={onCreateRecord} />
      </IntlWrapper>,
    );
    fireEvent.click(screen.getByTestId('empty-state-new-record'));
    expect(onCreateRecord).toHaveBeenCalledTimes(1);
  });

  it('does not render button when no callback', () => {
    render(
      <IntlWrapper>
        <GridEmptyState />
      </IntlWrapper>,
    );
    expect(screen.queryByTestId('empty-state-new-record')).toBeNull();
  });
});
