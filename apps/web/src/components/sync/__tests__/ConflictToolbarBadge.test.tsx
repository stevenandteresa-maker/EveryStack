// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import { ConflictToolbarBadge } from '../ConflictToolbarBadge';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConflictToolbarBadge', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(
      <IntlWrapper>
        <ConflictToolbarBadge count={0} onFilterConflicts={vi.fn()} />
      </IntlWrapper>,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders badge with count when count > 0', () => {
    render(
      <IntlWrapper>
        <ConflictToolbarBadge count={3} onFilterConflicts={vi.fn()} />
      </IntlWrapper>,
    );

    const badge = screen.getByTestId('conflict-toolbar-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('3');
  });

  it('renders singular form for count = 1', () => {
    render(
      <IntlWrapper>
        <ConflictToolbarBadge count={1} onFilterConflicts={vi.fn()} />
      </IntlWrapper>,
    );

    const badge = screen.getByTestId('conflict-toolbar-badge');
    expect(badge.textContent).toContain('1');
    expect(badge.textContent).toContain('conflict');
  });

  it('calls onFilterConflicts when clicked', async () => {
    const onFilter = vi.fn();
    const user = userEvent.setup();

    render(
      <IntlWrapper>
        <ConflictToolbarBadge count={5} onFilterConflicts={onFilter} />
      </IntlWrapper>,
    );

    await user.click(screen.getByTestId('conflict-toolbar-badge'));
    expect(onFilter).toHaveBeenCalledOnce();
  });

  it('has amber text styling', () => {
    render(
      <IntlWrapper>
        <ConflictToolbarBadge count={2} onFilterConflicts={vi.fn()} />
      </IntlWrapper>,
    );

    const badge = screen.getByTestId('conflict-toolbar-badge');
    expect(badge.className).toContain('text-amber-600');
  });

  // --- Role-based rendering ---

  describe('conflictRole=hidden', () => {
    it('returns null regardless of count', () => {
      const { container } = render(
        <IntlWrapper>
          <ConflictToolbarBadge count={5} onFilterConflicts={vi.fn()} conflictRole="hidden" />
        </IntlWrapper>,
      );

      expect(container.innerHTML).toBe('');
    });
  });

  describe('conflictRole=readonly', () => {
    it('renders non-clickable badge with readonly text', () => {
      render(
        <IntlWrapper>
          <ConflictToolbarBadge count={3} onFilterConflicts={vi.fn()} conflictRole="readonly" />
        </IntlWrapper>,
      );

      expect(screen.queryByTestId('conflict-toolbar-badge')).not.toBeInTheDocument();
      const readonlyBadge = screen.getByTestId('conflict-toolbar-badge-readonly');
      expect(readonlyBadge).toBeInTheDocument();
      expect(readonlyBadge.tagName).toBe('SPAN');
      expect(readonlyBadge.textContent).toContain('3');
      expect(readonlyBadge.textContent).toContain('pending resolution');
    });

    it('does not call onFilterConflicts when clicked', async () => {
      const onFilter = vi.fn();
      const user = userEvent.setup();

      render(
        <IntlWrapper>
          <ConflictToolbarBadge count={3} onFilterConflicts={onFilter} conflictRole="readonly" />
        </IntlWrapper>,
      );

      const readonlyBadge = screen.getByTestId('conflict-toolbar-badge-readonly');
      await user.click(readonlyBadge);
      expect(onFilter).not.toHaveBeenCalled();
    });
  });

  describe('conflictRole=resolver', () => {
    it('renders clickable badge (same as default)', async () => {
      const onFilter = vi.fn();
      const user = userEvent.setup();

      render(
        <IntlWrapper>
          <ConflictToolbarBadge count={3} onFilterConflicts={onFilter} conflictRole="resolver" />
        </IntlWrapper>,
      );

      const badge = screen.getByTestId('conflict-toolbar-badge');
      expect(badge.tagName).toBe('BUTTON');
      await user.click(badge);
      expect(onFilter).toHaveBeenCalledOnce();
    });
  });
});
