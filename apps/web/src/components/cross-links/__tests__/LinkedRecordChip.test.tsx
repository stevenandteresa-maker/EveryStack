// @vitest-environment jsdom

/**
 * LinkedRecordChip — component tests.
 *
 * Covers: display value rendering, remove button in edit mode,
 * shimmer animation for stale display values, navigation click,
 * tooltip for long values, keyboard navigation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LinkedRecordChip } from '../linked-record-chip';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const messages = {
  linked_record_chip: {
    navigate: 'Navigate to {name}',
    remove: 'Remove link to {name}',
  },
};

function renderChip(props: Partial<React.ComponentProps<typeof LinkedRecordChip>> = {}) {
  const defaultProps = {
    recordId: 'rec-1',
    displayValue: 'Acme Corp',
    ...props,
  };

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TooltipProvider>
        <LinkedRecordChip {...defaultProps} />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LinkedRecordChip', () => {
  it('renders display value text', () => {
    renderChip({ displayValue: 'Acme Corp' });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders with link icon', () => {
    renderChip();
    const chip = screen.getByTestId('linked-record-chip');
    expect(chip).toBeInTheDocument();
  });

  it('calls onNavigate when clicked', async () => {
    const onNavigate = vi.fn();
    renderChip({ recordId: 'rec-42', onNavigate });

    await userEvent.click(screen.getByTestId('linked-record-chip'));
    expect(onNavigate).toHaveBeenCalledWith('rec-42');
  });

  it('calls onNavigate on Enter key', () => {
    const onNavigate = vi.fn();
    renderChip({ recordId: 'rec-42', onNavigate });

    fireEvent.keyDown(screen.getByTestId('linked-record-chip'), {
      key: 'Enter',
    });
    expect(onNavigate).toHaveBeenCalledWith('rec-42');
  });

  it('does not show remove button when not editable', () => {
    renderChip({ editable: false, onRemove: vi.fn() });
    expect(screen.queryByTestId('linked-record-chip-remove')).not.toBeInTheDocument();
  });

  it('shows remove button in edit mode', () => {
    renderChip({ editable: true, onRemove: vi.fn() });
    expect(screen.getByTestId('linked-record-chip-remove')).toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked', async () => {
    const onRemove = vi.fn();
    renderChip({ recordId: 'rec-99', editable: true, onRemove });

    await userEvent.click(screen.getByTestId('linked-record-chip-remove'));
    expect(onRemove).toHaveBeenCalledWith('rec-99');
  });

  it('remove click does not trigger navigation', async () => {
    const onNavigate = vi.fn();
    const onRemove = vi.fn();
    renderChip({ editable: true, onNavigate, onRemove });

    await userEvent.click(screen.getByTestId('linked-record-chip-remove'));
    expect(onRemove).toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('applies shimmer class when display value is stale', () => {
    renderChip({
      displayUpdatedAt: '2026-03-10T10:00:00Z',
      sourceUpdatedAt: '2026-03-10T10:01:00Z',
    });

    const chip = screen.getByTestId('linked-record-chip');
    expect(chip.className).toContain('animate-shimmer');
  });

  it('does not apply shimmer class when display value is fresh', () => {
    renderChip({
      displayUpdatedAt: '2026-03-10T10:01:00Z',
      sourceUpdatedAt: '2026-03-10T10:01:00Z',
    });

    const chip = screen.getByTestId('linked-record-chip');
    expect(chip.className).not.toContain('animate-shimmer');
  });

  it('truncates long display values', () => {
    renderChip({ displayValue: 'A very long company name that exceeds truncation' });
    const span = screen.getByText('A very long company name that exceeds truncation');
    expect(span.className).toContain('truncate');
  });

  it('has accessible aria-label', () => {
    renderChip({ displayValue: 'Acme Corp' });
    const chip = screen.getByTestId('linked-record-chip');
    expect(chip).toHaveAttribute('aria-label', 'Navigate to Acme Corp');
  });
});
