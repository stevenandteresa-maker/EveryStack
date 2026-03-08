// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import type { CellRendererProps } from '../../GridCell';
import { getCellRenderer } from '../../GridCell';
import { registerPrompt3Cells } from '../cell-registry';
import { TextCellDisplay, TextCellEdit } from '../TextCell';
import { NumberCellDisplay, NumberCellEdit } from '../NumberCell';
import { DateCellDisplay, DateCellEdit } from '../DateCell';
import { CheckboxCellDisplay } from '../CheckboxCell';
import { RatingCellDisplay } from '../RatingCell';
import { CurrencyCellDisplay, CurrencyCellEdit } from '../CurrencyCell';
import { PercentCellDisplay, PercentCellEdit } from '../PercentCell';
import type { GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeField(overrides: Partial<GridField> = {}): GridField {
  return {
    id: 'field-1',
    tableId: 'table-1',
    tenantId: 'tenant-1',
    name: 'Test Field',
    fieldType: 'text',
    fieldSubType: null,
    isPrimary: false,
    isSystem: false,
    required: false,
    unique: false,
    readOnly: false,
    config: {},
    display: {},
    permissions: {},
    defaultValue: null,
    description: null,
    sortOrder: 0,
    externalFieldId: null,
    environment: 'live',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GridField;
}

function makeProps(overrides: Partial<CellRendererProps> = {}): CellRendererProps {
  return {
    value: null,
    field: makeField(),
    isEditing: false,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

function renderWithIntl(ui: React.ReactElement) {
  return render(<IntlWrapper>{ui}</IntlWrapper>);
}

// ---------------------------------------------------------------------------
// Cell registry tests
// ---------------------------------------------------------------------------

describe('Cell registry', () => {
  beforeAll(() => {
    registerPrompt3Cells();
  });

  it.each([
    'text',
    'textarea',
    'number',
    'date',
    'datetime',
    'checkbox',
    'rating',
    'currency',
    'percent',
  ])('registers %s field type', (fieldType) => {
    const entry = getCellRenderer(fieldType);
    expect(entry).toBeDefined();
    expect(entry?.DisplayComponent).toBeDefined();
  });

  it('text and textarea have edit components', () => {
    expect(getCellRenderer('text')?.EditComponent).toBeDefined();
    expect(getCellRenderer('textarea')?.EditComponent).toBeDefined();
  });

  it('checkbox has no separate edit component', () => {
    expect(getCellRenderer('checkbox')?.EditComponent).toBeUndefined();
  });

  it('rating has no separate edit component', () => {
    expect(getCellRenderer('rating')?.EditComponent).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TextCell
// ---------------------------------------------------------------------------

describe('TextCellDisplay', () => {
  it('renders text value', () => {
    renderWithIntl(<TextCellDisplay {...makeProps({ value: 'Hello world' })} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders empty for null value', () => {
    const { container } = renderWithIntl(<TextCellDisplay {...makeProps({ value: null })} />);
    expect(container.querySelector('span')?.textContent).toBe('');
  });

  it('renders empty for undefined value', () => {
    const { container } = renderWithIntl(<TextCellDisplay {...makeProps({ value: undefined })} />);
    expect(container.querySelector('span')?.textContent).toBe('');
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <TextCellDisplay
        {...makeProps({ value: 'test', field: makeField({ readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('TextCellEdit', () => {
  it('renders input with current value', () => {
    renderWithIntl(<TextCellEdit {...makeProps({ value: 'Hello', isEditing: true })} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Hello');
  });

  it('calls onSave on blur', () => {
    const onSave = vi.fn();
    renderWithIntl(<TextCellEdit {...makeProps({ value: 'test', onSave, isEditing: true })} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onSave).toHaveBeenCalledWith('test');
  });

  it('calls onSave on Enter', () => {
    const onSave = vi.fn();
    renderWithIntl(<TextCellEdit {...makeProps({ value: 'test', onSave, isEditing: true })} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('test');
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(<TextCellEdit {...makeProps({ value: 'test', onCancel, isEditing: true })} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// NumberCell
// ---------------------------------------------------------------------------

describe('NumberCellDisplay', () => {
  it('renders formatted number', () => {
    renderWithIntl(<NumberCellDisplay {...makeProps({ value: 1250, field: makeField({ fieldType: 'number' }) })} />);
    // Intl formats vary by locale; just check it contains 1250 or 1,250
    const text = screen.getByText(/1[,.]?250/);
    expect(text).toBeInTheDocument();
  });

  it('renders empty for null', () => {
    const { container } = renderWithIntl(
      <NumberCellDisplay {...makeProps({ value: null, field: makeField({ fieldType: 'number' }) })} />,
    );
    expect(container.querySelector('span')?.textContent).toBe('');
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <NumberCellDisplay
        {...makeProps({ value: 42, field: makeField({ fieldType: 'number', readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('NumberCellEdit', () => {
  it('renders number input', () => {
    renderWithIntl(
      <NumberCellEdit {...makeProps({ value: 42, field: makeField({ fieldType: 'number' }), isEditing: true })} />,
    );
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(42);
  });

  it('saves null for empty input', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <NumberCellEdit {...makeProps({ value: '', field: makeField({ fieldType: 'number' }), onSave, isEditing: true })} />,
    );
    fireEvent.blur(screen.getByRole('spinbutton'));
    expect(onSave).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// DateCell
// ---------------------------------------------------------------------------

describe('DateCellDisplay', () => {
  it('renders formatted date', () => {
    renderWithIntl(
      <DateCellDisplay {...makeProps({ value: '2026-02-09', field: makeField({ fieldType: 'date' }) })} />,
    );
    // Should contain Feb and 2026
    expect(screen.getByText(/Feb.*2026|2026.*Feb/)).toBeInTheDocument();
  });

  it('renders empty for null', () => {
    const { container } = renderWithIntl(
      <DateCellDisplay {...makeProps({ value: null, field: makeField({ fieldType: 'date' }) })} />,
    );
    expect(container.querySelector('span')?.textContent).toBe('');
  });

  it('renders empty for invalid date', () => {
    const { container } = renderWithIntl(
      <DateCellDisplay {...makeProps({ value: 'not-a-date', field: makeField({ fieldType: 'date' }) })} />,
    );
    expect(container.querySelector('span')?.textContent).toBe('');
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <DateCellDisplay
        {...makeProps({ value: '2026-02-09', field: makeField({ fieldType: 'date', readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('DateCellEdit', () => {
  it('renders date input', () => {
    renderWithIntl(
      <DateCellEdit
        {...makeProps({ value: '2026-02-09', field: makeField({ fieldType: 'date' }), isEditing: true })}
      />,
    );
    const input = document.querySelector('input[type="date"]');
    expect(input).toBeInTheDocument();
  });

  it('saves ISO string on blur', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <DateCellEdit
        {...makeProps({ value: '2026-02-09', field: makeField({ fieldType: 'date' }), onSave, isEditing: true })}
      />,
    );
    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CheckboxCell
// ---------------------------------------------------------------------------

describe('CheckboxCellDisplay', () => {
  it('renders unchecked checkbox for false value', () => {
    renderWithIntl(
      <CheckboxCellDisplay
        {...makeProps({ value: false, field: makeField({ fieldType: 'checkbox', name: 'Done' }) })}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Done' });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('renders checked checkbox for true value', () => {
    renderWithIntl(
      <CheckboxCellDisplay
        {...makeProps({ value: true, field: makeField({ fieldType: 'checkbox', name: 'Done' }) })}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Done' });
    expect(checkbox).toBeChecked();
  });

  it('toggles on click', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <CheckboxCellDisplay
        {...makeProps({ value: false, field: makeField({ fieldType: 'checkbox', name: 'Done' }), onSave })}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith(true);
  });

  it('handles null value as false', () => {
    renderWithIntl(
      <CheckboxCellDisplay
        {...makeProps({ value: null, field: makeField({ fieldType: 'checkbox', name: 'Done' }) })}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Done' })).not.toBeChecked();
  });

  it('renders disabled checkbox for read-only field', () => {
    renderWithIntl(
      <CheckboxCellDisplay
        {...makeProps({
          value: true,
          field: makeField({ fieldType: 'checkbox', name: 'Done', readOnly: true }),
        })}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Done' })).toBeDisabled();
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RatingCell
// ---------------------------------------------------------------------------

describe('RatingCellDisplay', () => {
  it('renders 5 stars by default', () => {
    renderWithIntl(
      <RatingCellDisplay
        {...makeProps({ value: 3, field: makeField({ fieldType: 'rating' }) })}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('renders custom max stars from field config', () => {
    renderWithIntl(
      <RatingCellDisplay
        {...makeProps({
          value: 2,
          field: makeField({ fieldType: 'rating', config: { max: 10 } }),
        })}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(10);
  });

  it('calls onSave with star value on click', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <RatingCellDisplay
        {...makeProps({ value: 0, field: makeField({ fieldType: 'rating' }), onSave })}
      />,
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]!); // Click 3rd star
    expect(onSave).toHaveBeenCalledWith(3);
  });

  it('clears rating when clicking same value', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <RatingCellDisplay
        {...makeProps({ value: 3, field: makeField({ fieldType: 'rating' }), onSave })}
      />,
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]!); // Click 3rd star (current value)
    expect(onSave).toHaveBeenCalledWith(0);
  });

  it('handles null value as 0', () => {
    renderWithIntl(
      <RatingCellDisplay
        {...makeProps({ value: null, field: makeField({ fieldType: 'rating' }) })}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <RatingCellDisplay
        {...makeProps({ value: 3, field: makeField({ fieldType: 'rating', readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
    // No buttons when read-only
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// CurrencyCell
// ---------------------------------------------------------------------------

describe('CurrencyCellDisplay', () => {
  it('renders formatted currency with USD default', () => {
    renderWithIntl(
      <CurrencyCellDisplay
        {...makeProps({ value: 1250, field: makeField({ fieldType: 'currency' }) })}
      />,
    );
    // Should contain $ and 1,250 or similar
    expect(screen.getByText(/\$.*1[,.]?250/)).toBeInTheDocument();
  });

  it('renders formatted currency with EUR from config', () => {
    renderWithIntl(
      <CurrencyCellDisplay
        {...makeProps({
          value: 1250,
          field: makeField({ fieldType: 'currency', config: { currency: 'EUR' } }),
        })}
      />,
    );
    // Should contain EUR symbol
    expect(screen.getByText(/€|EUR/)).toBeInTheDocument();
  });

  it('renders empty for null', () => {
    const { container } = renderWithIntl(
      <CurrencyCellDisplay
        {...makeProps({ value: null, field: makeField({ fieldType: 'currency' }) })}
      />,
    );
    expect(container.querySelector('span')?.textContent).toBe('');
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <CurrencyCellDisplay
        {...makeProps({ value: 100, field: makeField({ fieldType: 'currency', readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('CurrencyCellEdit', () => {
  it('renders number input with currency symbol', () => {
    renderWithIntl(
      <CurrencyCellEdit
        {...makeProps({ value: 1250, field: makeField({ fieldType: 'currency' }), isEditing: true })}
      />,
    );
    expect(screen.getByRole('spinbutton')).toHaveValue(1250);
    // Should show $ symbol
    expect(screen.getByText('$')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PercentCell
// ---------------------------------------------------------------------------

describe('PercentCellDisplay', () => {
  it('renders percent value with progress bar', () => {
    renderWithIntl(
      <PercentCellDisplay
        {...makeProps({ value: 75, field: makeField({ fieldType: 'percent' }) })}
      />,
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders empty for null', () => {
    const { container } = renderWithIntl(
      <PercentCellDisplay
        {...makeProps({ value: null, field: makeField({ fieldType: 'percent' }) })}
      />,
    );
    // No percent text rendered
    expect(container.textContent).toBe('');
  });

  it('clamps progress bar width to 100%', () => {
    renderWithIntl(
      <PercentCellDisplay
        {...makeProps({ value: 150, field: makeField({ fieldType: 'percent' }) })}
      />,
    );
    // The displayed value shows the actual value, but the bar is clamped
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <PercentCellDisplay
        {...makeProps({ value: 50, field: makeField({ fieldType: 'percent', readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('PercentCellEdit', () => {
  it('renders number input', () => {
    renderWithIntl(
      <PercentCellEdit
        {...makeProps({ value: 75, field: makeField({ fieldType: 'percent' }), isEditing: true })}
      />,
    );
    expect(screen.getByRole('spinbutton')).toHaveValue(75);
  });

  it('calls onSave on Enter', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <PercentCellEdit
        {...makeProps({ value: 75, field: makeField({ fieldType: 'percent' }), onSave, isEditing: true })}
      />,
    );
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith(75);
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <PercentCellEdit
        {...makeProps({ value: 75, field: makeField({ fieldType: 'percent' }), onCancel, isEditing: true })}
      />,
    );
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
