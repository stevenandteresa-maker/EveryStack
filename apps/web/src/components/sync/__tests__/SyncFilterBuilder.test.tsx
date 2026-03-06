// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncFilterBuilder } from '../SyncFilterBuilder';
import type { FilterField } from '../SyncFilterBuilder';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import type { FilterRule } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const testFields: FilterField[] = [
  { id: 'fld001', name: 'Name', type: 'singleLineText' },
  { id: 'fld002', name: 'Email', type: 'email' },
  { id: 'fld003', name: 'Status', type: 'singleSelect' },
  { id: 'fld004', name: 'Amount', type: 'number' },
  { id: 'fld005', name: 'Due Date', type: 'date' },
  { id: 'fld006', name: 'Completed', type: 'checkbox' },
];

function renderFilterBuilder(props: {
  filters?: FilterRule[];
  onChange?: (filters: FilterRule[]) => void;
  fields?: FilterField[];
}) {
  const onChange = props.onChange ?? vi.fn();
  return render(
    <IntlWrapper>
      <SyncFilterBuilder
        fields={props.fields ?? testFields}
        filters={props.filters ?? []}
        onChange={onChange}
        mode="platform"
      />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncFilterBuilder', () => {
  it('renders with no filters', () => {
    renderFilterBuilder({});
    expect(screen.getByTestId('sync-filter-builder')).toBeInTheDocument();
    expect(screen.getByText('Add filter')).toBeInTheDocument();
  });

  it('calls onChange with a new filter when "Add filter" is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderFilterBuilder({ onChange });
    await user.click(screen.getByText('Add filter'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newFilters = onChange.mock.calls[0]![0] as FilterRule[];
    expect(newFilters).toHaveLength(1);
    expect(newFilters[0]!.fieldId).toBe('fld001'); // First field selected by default
    expect(newFilters[0]!.conjunction).toBe('and');
  });

  it('renders existing filters', () => {
    const filters: FilterRule[] = [
      { fieldId: 'fld001', operator: 'equals', value: 'John', conjunction: 'and' },
      { fieldId: 'fld003', operator: 'is_empty', value: null, conjunction: 'and' },
    ];

    renderFilterBuilder({ filters });

    // Should render remove buttons for each filter
    const removeButtons = screen.getAllByLabelText('Remove filter');
    expect(removeButtons).toHaveLength(2);
  });

  it('calls onChange to remove a filter when X is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const filters: FilterRule[] = [
      { fieldId: 'fld001', operator: 'equals', value: 'John', conjunction: 'and' },
    ];

    renderFilterBuilder({ filters, onChange });

    const removeButton = screen.getByLabelText('Remove filter');
    await user.click(removeButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0]![0] as FilterRule[];
    expect(updated).toHaveLength(0);
  });

  it('disables "Add filter" when no fields are provided', () => {
    renderFilterBuilder({ fields: [] });

    const addButton = screen.getByText('Add filter');
    expect(addButton).toBeDisabled();
  });

  it('shows "Where" label for first filter row', () => {
    const filters: FilterRule[] = [
      { fieldId: 'fld001', operator: 'equals', value: 'test', conjunction: 'and' },
    ];

    renderFilterBuilder({ filters });
    expect(screen.getByText('Where')).toBeInTheDocument();
  });

  it('renders value input for operators that take values', () => {
    const filters: FilterRule[] = [
      { fieldId: 'fld001', operator: 'equals', value: 'test value', conjunction: 'and' },
    ];

    renderFilterBuilder({ filters });
    const input = screen.getByPlaceholderText('Value');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('test value');
  });

  it('does not render value input for is_empty operator', () => {
    const filters: FilterRule[] = [
      { fieldId: 'fld001', operator: 'is_empty', value: null, conjunction: 'and' },
    ];

    renderFilterBuilder({ filters });
    expect(screen.queryByPlaceholderText('Value')).not.toBeInTheDocument();
  });
});
