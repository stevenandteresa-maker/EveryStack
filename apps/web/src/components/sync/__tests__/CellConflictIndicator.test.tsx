// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import {
  CellConflictIndicator,
  RowConflictBadge,
  CellWrapper,
} from '../CellConflictIndicator';
import type { ConflictMeta } from '@/data/sync-conflicts';

// ---------------------------------------------------------------------------
// Polyfill ResizeObserver for Radix tooltip
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() { /* noop */ }
      unobserve() { /* noop */ }
      disconnect() { /* noop */ }
    };
  }
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeConflictMeta(overrides?: Partial<ConflictMeta>): ConflictMeta {
  return {
    id: 'conflict-1',
    localValue: 'Done',
    remoteValue: 'In Review',
    platform: 'airtable',
    createdAt: '2026-03-06T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CellConflictIndicator
// ---------------------------------------------------------------------------

describe('CellConflictIndicator', () => {
  it('renders the amber triangle indicator', () => {
    const onResolve = vi.fn();
    render(
      <IntlWrapper>
        <CellConflictIndicator
          conflict={makeConflictMeta()}
          onResolveClick={onResolve}
        />
      </IntlWrapper>,
    );

    const indicator = screen.getByTestId('cell-conflict-indicator');
    expect(indicator).toBeInTheDocument();
  });

  it('includes platform in aria-label', () => {
    render(
      <IntlWrapper>
        <CellConflictIndicator
          conflict={makeConflictMeta({ platform: 'notion' })}
          onResolveClick={vi.fn()}
        />
      </IntlWrapper>,
    );

    const indicator = screen.getByTestId('cell-conflict-indicator');
    expect(indicator.getAttribute('aria-label')).toContain('notion');
  });

  it('calls onResolveClick when clicked', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();

    render(
      <IntlWrapper>
        <CellConflictIndicator
          conflict={makeConflictMeta()}
          onResolveClick={onResolve}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByTestId('cell-conflict-indicator'));
    expect(onResolve).toHaveBeenCalledOnce();
  });

  // --- Role-based rendering ---

  describe('conflictRole=resolver', () => {
    it('renders clickable button and fires onResolveClick', async () => {
      const onResolve = vi.fn();
      const user = userEvent.setup();

      render(
        <IntlWrapper>
          <CellConflictIndicator
            conflict={makeConflictMeta()}
            onResolveClick={onResolve}
            conflictRole="resolver"
          />
        </IntlWrapper>,
      );

      const btn = screen.getByTestId('cell-conflict-indicator');
      expect(btn.tagName).toBe('BUTTON');
      await user.click(btn);
      expect(onResolve).toHaveBeenCalledOnce();
    });
  });

  describe('conflictRole=readonly', () => {
    it('renders amber triangle with team member tooltip, NOT clickable', () => {
      const onResolve = vi.fn();

      render(
        <IntlWrapper>
          <CellConflictIndicator
            conflict={makeConflictMeta()}
            onResolveClick={onResolve}
            conflictRole="readonly"
          />
        </IntlWrapper>,
      );

      expect(screen.queryByTestId('cell-conflict-indicator')).not.toBeInTheDocument();
      const readonlyEl = screen.getByTestId('cell-conflict-indicator-readonly');
      expect(readonlyEl).toBeInTheDocument();
      expect(readonlyEl.tagName).toBe('SPAN');
      expect(readonlyEl.getAttribute('aria-label')).toContain('Manager');
    });
  });

  describe('conflictRole=hidden', () => {
    it('renders nothing', () => {
      render(
        <IntlWrapper>
          <CellConflictIndicator
            conflict={makeConflictMeta()}
            onResolveClick={vi.fn()}
            conflictRole="hidden"
          />
        </IntlWrapper>,
      );

      expect(screen.queryByTestId('cell-conflict-indicator')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cell-conflict-indicator-readonly')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// RowConflictBadge
// ---------------------------------------------------------------------------

describe('RowConflictBadge', () => {
  it('renders the row badge', () => {
    render(
      <IntlWrapper>
        <RowConflictBadge count={3} onResolveClick={vi.fn()} />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('row-conflict-badge')).toBeInTheDocument();
  });

  it('includes conflict count in aria-label', () => {
    render(
      <IntlWrapper>
        <RowConflictBadge count={5} onResolveClick={vi.fn()} />
      </IntlWrapper>,
    );

    const badge = screen.getByTestId('row-conflict-badge');
    expect(badge.getAttribute('aria-label')).toContain('5');
  });

  it('calls onResolveClick when clicked', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();

    render(
      <IntlWrapper>
        <RowConflictBadge count={2} onResolveClick={onResolve} />
      </IntlWrapper>,
    );

    await user.click(screen.getByTestId('row-conflict-badge'));
    expect(onResolve).toHaveBeenCalledOnce();
  });

  // --- Role-based rendering ---

  describe('conflictRole=resolver', () => {
    it('renders clickable badge', async () => {
      const onResolve = vi.fn();
      const user = userEvent.setup();

      render(
        <IntlWrapper>
          <RowConflictBadge count={2} onResolveClick={onResolve} conflictRole="resolver" />
        </IntlWrapper>,
      );

      const badge = screen.getByTestId('row-conflict-badge');
      expect(badge.tagName).toBe('BUTTON');
      await user.click(badge);
      expect(onResolve).toHaveBeenCalledOnce();
    });
  });

  describe('conflictRole=readonly', () => {
    it('renders non-clickable span with team member tooltip', () => {
      render(
        <IntlWrapper>
          <RowConflictBadge count={2} onResolveClick={vi.fn()} conflictRole="readonly" />
        </IntlWrapper>,
      );

      expect(screen.queryByTestId('row-conflict-badge')).not.toBeInTheDocument();
      const readonlyBadge = screen.getByTestId('row-conflict-badge-readonly');
      expect(readonlyBadge).toBeInTheDocument();
      expect(readonlyBadge.tagName).toBe('SPAN');
      expect(readonlyBadge.getAttribute('aria-label')).toContain('Manager');
    });
  });

  describe('conflictRole=hidden', () => {
    it('renders nothing', () => {
      const { container } = render(
        <IntlWrapper>
          <RowConflictBadge count={2} onResolveClick={vi.fn()} conflictRole="hidden" />
        </IntlWrapper>,
      );

      expect(container.innerHTML).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// CellWrapper
// ---------------------------------------------------------------------------

describe('CellWrapper', () => {
  it('renders children without conflict overlay when no conflict', () => {
    render(
      <IntlWrapper>
        <CellWrapper>
          <span data-testid="cell-content">Hello</span>
        </CellWrapper>
      </IntlWrapper>,
    );

    expect(screen.getByTestId('cell-content')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-wrapper-conflicted')).not.toBeInTheDocument();
  });

  it('renders with conflict overlay when conflict is present', () => {
    render(
      <IntlWrapper>
        <CellWrapper conflict={makeConflictMeta()} onResolveClick={vi.fn()}>
          <span data-testid="cell-content">In Review</span>
        </CellWrapper>
      </IntlWrapper>,
    );

    expect(screen.getByTestId('cell-wrapper-conflicted')).toBeInTheDocument();
    expect(screen.getByTestId('cell-content')).toBeInTheDocument();
    expect(screen.getByTestId('cell-conflict-indicator')).toBeInTheDocument();
  });

  it('renders dashed amber underline when conflicted', () => {
    const { container } = render(
      <IntlWrapper>
        <CellWrapper conflict={makeConflictMeta()} onResolveClick={vi.fn()}>
          <span>Value</span>
        </CellWrapper>
      </IntlWrapper>,
    );

    const underlineDiv = container.querySelector('.border-dashed.border-amber-500');
    expect(underlineDiv).toBeInTheDocument();
  });

  it('does not render indicator when conflict exists but no onResolveClick', () => {
    render(
      <IntlWrapper>
        <CellWrapper conflict={makeConflictMeta()}>
          <span data-testid="cell-content">Value</span>
        </CellWrapper>
      </IntlWrapper>,
    );

    expect(screen.getByTestId('cell-wrapper-conflicted')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-conflict-indicator')).not.toBeInTheDocument();
  });

  // --- Role-based rendering ---

  describe('conflictRole=resolver', () => {
    it('renders clickable indicator with dashed underline', () => {
      render(
        <IntlWrapper>
          <CellWrapper
            conflict={makeConflictMeta()}
            onResolveClick={vi.fn()}
            conflictRole="resolver"
          >
            <span data-testid="cell-content">Value</span>
          </CellWrapper>
        </IntlWrapper>,
      );

      expect(screen.getByTestId('cell-wrapper-conflicted')).toBeInTheDocument();
      expect(screen.getByTestId('cell-conflict-indicator')).toBeInTheDocument();
    });
  });

  describe('conflictRole=readonly', () => {
    it('renders non-clickable indicator with dashed underline', () => {
      render(
        <IntlWrapper>
          <CellWrapper
            conflict={makeConflictMeta()}
            onResolveClick={vi.fn()}
            conflictRole="readonly"
          >
            <span data-testid="cell-content">Value</span>
          </CellWrapper>
        </IntlWrapper>,
      );

      expect(screen.getByTestId('cell-wrapper-conflicted')).toBeInTheDocument();
      expect(screen.getByTestId('cell-conflict-indicator-readonly')).toBeInTheDocument();
      expect(screen.queryByTestId('cell-conflict-indicator')).not.toBeInTheDocument();
    });
  });

  describe('conflictRole=hidden', () => {
    it('renders children only — no indicator or underline', () => {
      render(
        <IntlWrapper>
          <CellWrapper
            conflict={makeConflictMeta()}
            onResolveClick={vi.fn()}
            conflictRole="hidden"
          >
            <span data-testid="cell-content">Value</span>
          </CellWrapper>
        </IntlWrapper>,
      );

      expect(screen.getByTestId('cell-content')).toBeInTheDocument();
      expect(screen.queryByTestId('cell-wrapper-conflicted')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cell-conflict-indicator')).not.toBeInTheDocument();
    });
  });
});
