// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictFieldRow } from '../ConflictFieldRow';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import type { ConflictItem, ConflictResolution } from '../conflict-types';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeConflict(overrides?: Partial<ConflictItem>): ConflictItem {
  return {
    id: 'conflict-1',
    fieldId: 'field-1',
    fieldName: 'Status',
    fieldType: 'singleSelect',
    platformFieldType: 'singleSelect',
    localValue: 'Complete',
    remoteValue: 'In Review',
    baseValue: 'In Progress',
    platform: 'airtable',
    createdAt: '2026-03-06T12:00:00Z',
    ...overrides,
  };
}

function renderRow(
  overrides?: Partial<ConflictItem>,
  resolution: ConflictResolution | null = null,
  onResolve?: (r: ConflictResolution) => void,
) {
  const conflict = makeConflict(overrides);
  return render(
    <IntlWrapper>
      <ConflictFieldRow
        conflict={conflict}
        resolution={resolution}
        onResolve={onResolve ?? vi.fn()}
      />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConflictFieldRow', () => {
  it('renders field name, local value, and remote value', () => {
    renderRow();

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-local-field-1')).toHaveTextContent('Complete');
    expect(screen.getByTestId('conflict-remote-field-1')).toHaveTextContent('In Review');
  });

  it('renders base value', () => {
    renderRow();
    // "Was: In Progress" rendered via i18n
    expect(screen.getByText(/In Progress/)).toBeInTheDocument();
  });

  it('renders three action buttons', () => {
    renderRow();

    expect(screen.getByTestId('conflict-keep-local-field-1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-keep-remote-field-1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-edit-btn-field-1')).toBeInTheDocument();
  });

  it('calls onResolve with keep_local when Keep EveryStack is clicked', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderRow(undefined, null, onResolve);

    await user.click(screen.getByTestId('conflict-keep-local-field-1'));

    expect(onResolve).toHaveBeenCalledWith({
      conflictId: 'conflict-1',
      choice: 'keep_local',
    });
  });

  it('calls onResolve with keep_remote when Keep Platform is clicked', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderRow(undefined, null, onResolve);

    await user.click(screen.getByTestId('conflict-keep-remote-field-1'));

    expect(onResolve).toHaveBeenCalledWith({
      conflictId: 'conflict-1',
      choice: 'keep_remote',
    });
  });

  it('opens inline edit input when Edit is clicked', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByTestId('conflict-edit-btn-field-1'));

    expect(screen.getByTestId('conflict-edit-input-field-1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-edit-confirm-field-1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-edit-cancel-field-1')).toBeInTheDocument();
  });

  it('calls onResolve with edited value on confirm', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderRow(undefined, null, onResolve);

    await user.click(screen.getByTestId('conflict-edit-btn-field-1'));

    const input = screen.getByTestId('conflict-edit-input-field-1');
    await user.clear(input);
    await user.type(input, 'Merged Value');

    await user.click(screen.getByTestId('conflict-edit-confirm-field-1'));

    expect(onResolve).toHaveBeenCalledWith({
      conflictId: 'conflict-1',
      choice: 'edit',
      editedValue: 'Merged Value',
    });
  });

  it('cancels edit mode without calling onResolve', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderRow(undefined, null, onResolve);

    await user.click(screen.getByTestId('conflict-edit-btn-field-1'));
    await user.click(screen.getByTestId('conflict-edit-cancel-field-1'));

    expect(onResolve).not.toHaveBeenCalled();
    // Edit input should be gone
    expect(screen.queryByTestId('conflict-edit-input-field-1')).not.toBeInTheDocument();
  });

  it('shows resolved state with green checkmark when resolution is provided', () => {
    renderRow(undefined, {
      conflictId: 'conflict-1',
      choice: 'keep_local',
    });

    expect(screen.getByTestId('conflict-resolved-badge-field-1')).toBeInTheDocument();
    // Action buttons should not be visible
    expect(screen.queryByTestId('conflict-keep-local-field-1')).not.toBeInTheDocument();
    // Resolved value should show the chosen value
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('shows edited value in resolved state', () => {
    renderRow(undefined, {
      conflictId: 'conflict-1',
      choice: 'edit',
      editedValue: 'Custom Merged',
    });

    expect(screen.getByTestId('conflict-resolved-badge-field-1')).toBeInTheDocument();
    expect(screen.getByText('Custom Merged')).toBeInTheDocument();
  });

  it('renders null/undefined values as dash', () => {
    renderRow({ localValue: null, remoteValue: undefined });

    expect(screen.getByTestId('conflict-local-field-1')).toHaveTextContent('—');
    expect(screen.getByTestId('conflict-remote-field-1')).toHaveTextContent('—');
  });

  it('renders numeric values correctly', () => {
    renderRow({ localValue: 42, remoteValue: 99, baseValue: 10 });

    expect(screen.getByTestId('conflict-local-field-1')).toHaveTextContent('42');
    expect(screen.getByTestId('conflict-remote-field-1')).toHaveTextContent('99');
  });

  it('shows changed by info when provided', () => {
    renderRow({ localChangedBy: 'Jane', localChangedAt: '2h ago' });

    expect(screen.getByText(/Jane/)).toBeInTheDocument();
    expect(screen.getByText(/2h ago/)).toBeInTheDocument();
  });

  it('capitalizes platform name in labels', () => {
    renderRow({ platform: 'notion' });

    expect(screen.getByTestId('conflict-keep-remote-field-1')).toHaveTextContent(/Notion/);
  });

  it('has touch-safe button sizes (min 44px height)', () => {
    renderRow();

    const keepLocalBtn = screen.getByTestId('conflict-keep-local-field-1');
    expect(keepLocalBtn.className).toContain('min-h-[44px]');
  });
});
