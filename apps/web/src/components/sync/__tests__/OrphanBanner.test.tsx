// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrphanBanner } from '../OrphanBanner';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBanner(overrides?: {
  orphanedCount?: number;
  onDelete?: () => void;
  onKeepLocal?: () => void;
  onUndoFilter?: () => void;
  isUndoAvailable?: boolean;
}) {
  const props = {
    tableId: 'table-1',
    orphanedCount: overrides?.orphanedCount ?? 5,
    onDelete: overrides?.onDelete ?? vi.fn(),
    onKeepLocal: overrides?.onKeepLocal ?? vi.fn(),
    onUndoFilter: overrides?.onUndoFilter ?? vi.fn(),
    isUndoAvailable: overrides?.isUndoAvailable ?? true,
  };

  return render(
    <IntlWrapper>
      <OrphanBanner {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrphanBanner', () => {
  it('renders the banner with orphan count message', () => {
    renderBanner({ orphanedCount: 3 });
    expect(screen.getByTestId('orphan-banner')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders all three action buttons', () => {
    renderBanner();
    expect(screen.getByTestId('orphan-delete-btn')).toBeInTheDocument();
    expect(screen.getByTestId('orphan-keep-local-btn')).toBeInTheDocument();
    expect(screen.getByTestId('orphan-undo-filter-btn')).toBeInTheDocument();
  });

  it('fires onDelete callback when delete button is clicked', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();

    renderBanner({ onDelete });
    await user.click(screen.getByTestId('orphan-delete-btn'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('fires onKeepLocal callback when keep local button is clicked', async () => {
    const onKeepLocal = vi.fn();
    const user = userEvent.setup();

    renderBanner({ onKeepLocal });
    await user.click(screen.getByTestId('orphan-keep-local-btn'));

    expect(onKeepLocal).toHaveBeenCalledTimes(1);
  });

  it('fires onUndoFilter callback when undo button is clicked', async () => {
    const onUndoFilter = vi.fn();
    const user = userEvent.setup();

    renderBanner({ onUndoFilter, isUndoAvailable: true });
    await user.click(screen.getByTestId('orphan-undo-filter-btn'));

    expect(onUndoFilter).toHaveBeenCalledTimes(1);
  });

  it('disables undo button when isUndoAvailable is false', () => {
    renderBanner({ isUndoAvailable: false });

    const undoBtn = screen.getByTestId('orphan-undo-filter-btn');
    expect(undoBtn).toBeDisabled();
  });

  it('enables undo button when isUndoAvailable is true', () => {
    renderBanner({ isUndoAvailable: true });

    const undoBtn = screen.getByTestId('orphan-undo-filter-btn');
    expect(undoBtn).not.toBeDisabled();
  });
});
