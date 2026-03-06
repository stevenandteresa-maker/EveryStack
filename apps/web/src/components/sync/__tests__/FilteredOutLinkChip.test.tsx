// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilteredOutLinkChip } from '../FilteredOutLinkChip';
import { IntlWrapper } from '@/test-utils/intl-wrapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderChip(overrides?: {
  displayName?: string;
  platformName?: string;
}) {
  const props = {
    displayName: overrides?.displayName ?? 'Acme Corp',
    platformName: overrides?.platformName,
  };

  return render(
    <IntlWrapper>
      <FilteredOutLinkChip {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilteredOutLinkChip', () => {
  it('renders with the display name', () => {
    renderChip({ displayName: 'Acme Corp' });

    const chip = screen.getByTestId('filtered-out-link-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('Acme Corp');
  });

  it('truncates display names longer than 24 characters', () => {
    renderChip({ displayName: 'This Is A Very Long Display Name That Exceeds Limit' });

    const chip = screen.getByTestId('filtered-out-link-chip');
    expect(chip.textContent).toContain('This Is A Very Long Disp');
    expect(chip.textContent).toContain('…');
  });

  it('does not truncate display names at or under 24 characters', () => {
    renderChip({ displayName: 'Short Name' });

    const chip = screen.getByTestId('filtered-out-link-chip');
    expect(chip).toHaveTextContent('Short Name');
    expect(chip.textContent).not.toContain('…');
  });

  it('renders with grayed-out styling (opacity-50)', () => {
    renderChip();

    const chip = screen.getByTestId('filtered-out-link-chip');
    expect(chip.className).toContain('opacity-50');
  });

  it('has cursor-default (not clickable)', () => {
    renderChip();

    const chip = screen.getByTestId('filtered-out-link-chip');
    expect(chip.className).toContain('cursor-default');
  });

  it('renders the filter icon', () => {
    renderChip();

    // Lucide icons render as SVGs
    const chip = screen.getByTestId('filtered-out-link-chip');
    const svg = chip.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
