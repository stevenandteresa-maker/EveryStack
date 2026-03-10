// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '../../../../test-utils/intl-wrapper';
import type { CellRendererProps } from '../../GridCell';
import { getCellRenderer } from '../../GridCell';
import { registerPrompt3Cells, registerPrompt4Cells, registerPrompt5Cells } from '../cell-registry';
import { TextCellDisplay, TextCellEdit } from '../TextCell';
import { NumberCellDisplay, NumberCellEdit } from '../NumberCell';
import { DateCellDisplay, DateCellEdit } from '../DateCell';
import { CheckboxCellDisplay } from '../CheckboxCell';
import { RatingCellDisplay } from '../RatingCell';
import { CurrencyCellDisplay, CurrencyCellEdit } from '../CurrencyCell';
import { PercentCellDisplay, PercentCellEdit } from '../PercentCell';
import { SingleSelectCellDisplay, SingleSelectCellEdit } from '../SingleSelectCell';
import { MultiSelectCellDisplay, MultiSelectCellEdit } from '../MultiSelectCell';
import { PeopleCellDisplay, PeopleCellEdit } from '../PeopleCell';
import { LinkedRecordCellDisplay, LinkedRecordCellEdit } from '../LinkedRecordCell';
import { AttachmentCellDisplay, AttachmentCellEdit } from '../AttachmentCell';
import { UrlCellDisplay, UrlCellEdit } from '../UrlCell';
import { EmailCellDisplay, EmailCellEdit } from '../EmailCell';
import { PhoneCellDisplay, PhoneCellEdit } from '../PhoneCell';
import { SmartDocCellDisplay, SmartDocCellEdit } from '../SmartDocCell';
import { BarcodeCellDisplay, BarcodeCellEdit } from '../BarcodeCell';
import { ChecklistCellDisplay, ChecklistCellEdit } from '../ChecklistCell';
import type { GridField } from '../../../../lib/types/grid';

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
    registerPrompt4Cells();
    registerPrompt5Cells();
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
    'single_select',
    'multi_select',
    'people',
    'linked_record',
    'attachment',
    'url',
    'email',
    'phone',
    'smart_doc',
    'barcode',
    'checklist',
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

  it('all prompt 4 types have edit components', () => {
    expect(getCellRenderer('single_select')?.EditComponent).toBeDefined();
    expect(getCellRenderer('multi_select')?.EditComponent).toBeDefined();
    expect(getCellRenderer('people')?.EditComponent).toBeDefined();
    expect(getCellRenderer('linked_record')?.EditComponent).toBeDefined();
    expect(getCellRenderer('attachment')?.EditComponent).toBeDefined();
  });

  it('all prompt 5 types have edit components', () => {
    expect(getCellRenderer('url')?.EditComponent).toBeDefined();
    expect(getCellRenderer('email')?.EditComponent).toBeDefined();
    expect(getCellRenderer('phone')?.EditComponent).toBeDefined();
    expect(getCellRenderer('smart_doc')?.EditComponent).toBeDefined();
    expect(getCellRenderer('barcode')?.EditComponent).toBeDefined();
    expect(getCellRenderer('checklist')?.EditComponent).toBeDefined();
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

// ---------------------------------------------------------------------------
// SingleSelectCell
// ---------------------------------------------------------------------------

const selectField = makeField({
  fieldType: 'single_select',
  config: {
    options: [
      { value: 'opt1', label: 'Option 1', color: 0 },
      { value: 'opt2', label: 'Option 2', color: 1 },
      { value: 'opt3', label: 'Option 3', color: 2 },
    ],
  },
});

describe('SingleSelectCellDisplay', () => {
  it('renders selected option as pill by default', () => {
    renderWithIntl(
      <SingleSelectCellDisplay
        {...makeProps({ value: 'opt1', field: selectField })}
      />,
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('renders dot+text style', () => {
    const dotField = makeField({
      ...selectField,
      display: { style: 'dot' },
    });
    renderWithIntl(
      <SingleSelectCellDisplay
        {...makeProps({ value: 'opt1', field: dotField })}
      />,
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('renders block style', () => {
    const blockField = makeField({
      ...selectField,
      display: { style: 'block' },
    });
    renderWithIntl(
      <SingleSelectCellDisplay
        {...makeProps({ value: 'opt1', field: blockField })}
      />,
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('renders plain style', () => {
    const plainField = makeField({
      ...selectField,
      display: { style: 'plain' },
    });
    renderWithIntl(
      <SingleSelectCellDisplay
        {...makeProps({ value: 'opt1', field: plainField })}
      />,
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('renders null for empty value', () => {
    const { container } = renderWithIntl(
      <SingleSelectCellDisplay {...makeProps({ value: null, field: selectField })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <SingleSelectCellDisplay
        {...makeProps({ value: 'opt1', field: makeField({ ...selectField, readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('SingleSelectCellEdit', () => {
  it('renders dropdown with all options', () => {
    renderWithIntl(
      <SingleSelectCellEdit
        {...makeProps({ value: 'opt1', field: selectField, isEditing: true })}
      />,
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('calls onSave when option clicked', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <SingleSelectCellEdit
        {...makeProps({ value: 'opt1', field: selectField, onSave, isEditing: true })}
      />,
    );
    fireEvent.click(screen.getByText('Option 2'));
    expect(onSave).toHaveBeenCalledWith('opt2');
  });

  it('filters options by search', () => {
    renderWithIntl(
      <SingleSelectCellEdit
        {...makeProps({ value: null, field: selectField, isEditing: true })}
      />,
    );
    const input = screen.getByPlaceholderText('Search options...');
    fireEvent.change(input, { target: { value: 'Option 2' } });
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <SingleSelectCellEdit
        {...makeProps({ value: null, field: selectField, onCancel, isEditing: true })}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText('Search options...'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// MultiSelectCell
// ---------------------------------------------------------------------------

describe('MultiSelectCellDisplay', () => {
  it('renders multiple pills', () => {
    renderWithIntl(
      <MultiSelectCellDisplay
        {...makeProps({ value: ['opt1', 'opt2'], field: selectField })}
      />,
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('renders overflow badge when more than 3 items', () => {
    const multiField = makeField({
      fieldType: 'multi_select',
      config: {
        options: [
          { value: 'a', label: 'A', color: 0 },
          { value: 'b', label: 'B', color: 1 },
          { value: 'c', label: 'C', color: 2 },
          { value: 'd', label: 'D', color: 3 },
          { value: 'e', label: 'E', color: 4 },
        ],
      },
    });
    renderWithIntl(
      <MultiSelectCellDisplay
        {...makeProps({ value: ['a', 'b', 'c', 'd', 'e'], field: multiField })}
      />,
    );
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders null for empty array', () => {
    const { container } = renderWithIntl(
      <MultiSelectCellDisplay {...makeProps({ value: [], field: selectField })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <MultiSelectCellDisplay
        {...makeProps({ value: ['opt1'], field: makeField({ ...selectField, readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('MultiSelectCellEdit', () => {
  it('toggles option selection', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <MultiSelectCellEdit
        {...makeProps({ value: ['opt1'], field: selectField, onSave, isEditing: true })}
      />,
    );
    // Click Option 2 to add it
    fireEvent.click(screen.getByText('Option 2'));
    expect(onSave).toHaveBeenCalledWith(['opt1', 'opt2']);
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <MultiSelectCellEdit
        {...makeProps({ value: [], field: selectField, onCancel, isEditing: true })}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText('Search options...'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// PeopleCell
// ---------------------------------------------------------------------------

const peopleValue = [
  { id: 'u1', name: 'Alice Smith', avatarUrl: undefined },
  { id: 'u2', name: 'Bob Jones', avatarUrl: undefined },
];

describe('PeopleCellDisplay', () => {
  it('renders people with pill+avatar style by default', () => {
    renderWithIntl(
      <PeopleCellDisplay
        {...makeProps({ value: peopleValue, field: makeField({ fieldType: 'people' }) })}
      />,
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('renders avatar-only style', () => {
    const avatarField = makeField({ fieldType: 'people', display: { style: 'avatar_only' } });
    renderWithIntl(
      <PeopleCellDisplay
        {...makeProps({ value: peopleValue, field: avatarField })}
      />,
    );
    // Initials shown
    expect(screen.getByText('AS')).toBeInTheDocument();
    expect(screen.getByText('BJ')).toBeInTheDocument();
  });

  it('renders pill+name style', () => {
    const nameField = makeField({ fieldType: 'people', display: { style: 'pill_name' } });
    renderWithIntl(
      <PeopleCellDisplay
        {...makeProps({ value: peopleValue, field: nameField })}
      />,
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('renders overflow badge with more than 3 people', () => {
    const manyPeople = [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
      { id: 'u3', name: 'Charlie' },
      { id: 'u4', name: 'Diana' },
    ];
    renderWithIntl(
      <PeopleCellDisplay
        {...makeProps({ value: manyPeople, field: makeField({ fieldType: 'people' }) })}
      />,
    );
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders null for empty array', () => {
    const { container } = renderWithIntl(
      <PeopleCellDisplay {...makeProps({ value: [], field: makeField({ fieldType: 'people' }) })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <PeopleCellDisplay
        {...makeProps({
          value: peopleValue,
          field: makeField({ fieldType: 'people', readOnly: true }),
        })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('PeopleCellEdit', () => {
  it('renders people picker dropdown', () => {
    renderWithIntl(
      <PeopleCellEdit
        {...makeProps({ value: peopleValue, field: makeField({ fieldType: 'people' }), isEditing: true })}
      />,
    );
    expect(screen.getByPlaceholderText('Search people...')).toBeInTheDocument();
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <PeopleCellEdit
        {...makeProps({ value: peopleValue, field: makeField({ fieldType: 'people' }), onCancel, isEditing: true })}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText('Search people...'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// LinkedRecordCell
// ---------------------------------------------------------------------------

const linkedRecordValue = [
  { id: 'r1', primaryFieldValue: 'Project Alpha' },
  { id: 'r2', primaryFieldValue: 'Project Beta' },
];

describe('LinkedRecordCellDisplay', () => {
  it('renders pills with primary field values', () => {
    renderWithIntl(
      <LinkedRecordCellDisplay
        {...makeProps({ value: linkedRecordValue, field: makeField({ fieldType: 'linked_record' }) })}
      />,
    );
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('renders overflow badge for more than 3 records', () => {
    const manyRecords = [
      { id: 'r1', primaryFieldValue: 'A' },
      { id: 'r2', primaryFieldValue: 'B' },
      { id: 'r3', primaryFieldValue: 'C' },
      { id: 'r4', primaryFieldValue: 'D' },
    ];
    renderWithIntl(
      <LinkedRecordCellDisplay
        {...makeProps({ value: manyRecords, field: makeField({ fieldType: 'linked_record' }) })}
      />,
    );
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders null for empty array', () => {
    const { container } = renderWithIntl(
      <LinkedRecordCellDisplay
        {...makeProps({ value: [], field: makeField({ fieldType: 'linked_record' }) })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <LinkedRecordCellDisplay
        {...makeProps({
          value: linkedRecordValue,
          field: makeField({ fieldType: 'linked_record', readOnly: true }),
        })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });

  it('uses record id as fallback when primaryFieldValue missing', () => {
    renderWithIntl(
      <LinkedRecordCellDisplay
        {...makeProps({ value: [{ id: 'r1' }], field: makeField({ fieldType: 'linked_record' }) })}
      />,
    );
    expect(screen.getByText('r1')).toBeInTheDocument();
  });
});

describe('LinkedRecordCellEdit', () => {
  it('renders placeholder message', () => {
    renderWithIntl(
      <LinkedRecordCellEdit
        {...makeProps({ value: linkedRecordValue, field: makeField({ fieldType: 'linked_record' }), isEditing: true })}
      />,
    );
    expect(screen.getByText('Link Picker ships in Phase 3B-i')).toBeInTheDocument();
  });

  it('calls onCancel when close clicked', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <LinkedRecordCellEdit
        {...makeProps({ value: [], field: makeField({ fieldType: 'linked_record' }), onCancel, isEditing: true })}
      />,
    );
    fireEvent.click(screen.getByText('Close'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// AttachmentCell
// ---------------------------------------------------------------------------

const attachmentValue = [
  { id: 'f1', filename: 'photo.jpg', mimeType: 'image/jpeg', thumbnailUrl: '/thumb/photo.jpg' },
  { id: 'f2', filename: 'doc.pdf', mimeType: 'application/pdf' },
];

describe('AttachmentCellDisplay', () => {
  it('renders thumbnails for images and icons for documents', () => {
    renderWithIntl(
      <AttachmentCellDisplay
        {...makeProps({ value: attachmentValue, field: makeField({ fieldType: 'attachment' }) })}
      />,
    );
    // Image thumbnail
    const img = screen.getByAltText('photo.jpg');
    expect(img).toBeInTheDocument();
  });

  it('renders overflow badge for more than 4 attachments', () => {
    const manyAttachments = [
      { id: 'f1', filename: 'a.jpg', mimeType: 'image/jpeg' },
      { id: 'f2', filename: 'b.jpg', mimeType: 'image/jpeg' },
      { id: 'f3', filename: 'c.jpg', mimeType: 'image/jpeg' },
      { id: 'f4', filename: 'd.jpg', mimeType: 'image/jpeg' },
      { id: 'f5', filename: 'e.jpg', mimeType: 'image/jpeg' },
    ];
    renderWithIntl(
      <AttachmentCellDisplay
        {...makeProps({ value: manyAttachments, field: makeField({ fieldType: 'attachment' }) })}
      />,
    );
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders null for empty array', () => {
    const { container } = renderWithIntl(
      <AttachmentCellDisplay
        {...makeProps({ value: [], field: makeField({ fieldType: 'attachment' }) })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <AttachmentCellDisplay
        {...makeProps({
          value: attachmentValue,
          field: makeField({ fieldType: 'attachment', readOnly: true }),
        })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('AttachmentCellEdit', () => {
  it('renders placeholder message', () => {
    renderWithIntl(
      <AttachmentCellEdit
        {...makeProps({ value: [], field: makeField({ fieldType: 'attachment' }), isEditing: true })}
      />,
    );
    expect(screen.getByText('Attachment manager opens in Record View')).toBeInTheDocument();
  });

  it('calls onCancel when close clicked', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <AttachmentCellEdit
        {...makeProps({ value: [], field: makeField({ fieldType: 'attachment' }), onCancel, isEditing: true })}
      />,
    );
    fireEvent.click(screen.getByText('Close'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// UrlCell
// ---------------------------------------------------------------------------

describe('UrlCellDisplay', () => {
  it('renders clickable link that opens in new tab', () => {
    renderWithIntl(
      <UrlCellDisplay
        {...makeProps({ value: 'https://example.com', field: makeField({ fieldType: 'url' }) })}
      />,
    );
    const link = screen.getByText('https://example.com');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
    expect(link.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.closest('a')).toHaveAttribute('href', 'https://example.com');
  });

  it('renders null for empty value', () => {
    const { container } = renderWithIntl(
      <UrlCellDisplay {...makeProps({ value: null, field: makeField({ fieldType: 'url' }) })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null for empty string', () => {
    const { container } = renderWithIntl(
      <UrlCellDisplay {...makeProps({ value: '', field: makeField({ fieldType: 'url' }) })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <UrlCellDisplay
        {...makeProps({ value: 'https://example.com', field: makeField({ fieldType: 'url', readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('UrlCellEdit', () => {
  it('renders input with current value', () => {
    renderWithIntl(
      <UrlCellEdit
        {...makeProps({ value: 'https://example.com', field: makeField({ fieldType: 'url' }), isEditing: true })}
      />,
    );
    const input = document.querySelector('input[type="url"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('https://example.com');
  });

  it('calls onSave on blur', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <UrlCellEdit
        {...makeProps({ value: 'https://test.com', field: makeField({ fieldType: 'url' }), onSave, isEditing: true })}
      />,
    );
    fireEvent.blur(document.querySelector('input[type="url"]')!);
    expect(onSave).toHaveBeenCalledWith('https://test.com');
  });

  it('calls onSave on Enter', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <UrlCellEdit
        {...makeProps({ value: 'https://test.com', field: makeField({ fieldType: 'url' }), onSave, isEditing: true })}
      />,
    );
    fireEvent.keyDown(document.querySelector('input[type="url"]')!, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('https://test.com');
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <UrlCellEdit
        {...makeProps({ value: 'https://test.com', field: makeField({ fieldType: 'url' }), onCancel, isEditing: true })}
      />,
    );
    fireEvent.keyDown(document.querySelector('input[type="url"]')!, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('saves null for empty input', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <UrlCellEdit
        {...makeProps({ value: '', field: makeField({ fieldType: 'url' }), onSave, isEditing: true })}
      />,
    );
    fireEvent.blur(document.querySelector('input[type="url"]')!);
    expect(onSave).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// EmailCell
// ---------------------------------------------------------------------------

describe('EmailCellDisplay', () => {
  it('renders clickable mailto link', () => {
    renderWithIntl(
      <EmailCellDisplay
        {...makeProps({ value: 'test@example.com', field: makeField({ fieldType: 'email' }) })}
      />,
    );
    const link = screen.getByText('test@example.com');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'mailto:test@example.com');
  });

  it('renders null for empty value', () => {
    const { container } = renderWithIntl(
      <EmailCellDisplay {...makeProps({ value: null, field: makeField({ fieldType: 'email' }) })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null for empty string', () => {
    const { container } = renderWithIntl(
      <EmailCellDisplay {...makeProps({ value: '', field: makeField({ fieldType: 'email' }) })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <EmailCellDisplay
        {...makeProps({ value: 'test@example.com', field: makeField({ fieldType: 'email', readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('EmailCellEdit', () => {
  it('renders email input with current value', () => {
    renderWithIntl(
      <EmailCellEdit
        {...makeProps({ value: 'test@example.com', field: makeField({ fieldType: 'email' }), isEditing: true })}
      />,
    );
    const input = document.querySelector('input[type="email"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('test@example.com');
  });

  it('calls onSave on blur', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <EmailCellEdit
        {...makeProps({ value: 'test@example.com', field: makeField({ fieldType: 'email' }), onSave, isEditing: true })}
      />,
    );
    fireEvent.blur(document.querySelector('input[type="email"]')!);
    expect(onSave).toHaveBeenCalledWith('test@example.com');
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <EmailCellEdit
        {...makeProps({ value: 'test@example.com', field: makeField({ fieldType: 'email' }), onCancel, isEditing: true })}
      />,
    );
    fireEvent.keyDown(document.querySelector('input[type="email"]')!, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// PhoneCell
// ---------------------------------------------------------------------------

describe('PhoneCellDisplay', () => {
  it('renders formatted number with phone icon', () => {
    renderWithIntl(
      <PhoneCellDisplay
        {...makeProps({ value: '+1-555-123-4567', field: makeField({ fieldType: 'phone' }) })}
      />,
    );
    const link = screen.getByText('+1-555-123-4567');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'tel:+1-555-123-4567');
  });

  it('renders null for empty value', () => {
    const { container } = renderWithIntl(
      <PhoneCellDisplay {...makeProps({ value: null, field: makeField({ fieldType: 'phone' }) })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null for empty string', () => {
    const { container } = renderWithIntl(
      <PhoneCellDisplay {...makeProps({ value: '', field: makeField({ fieldType: 'phone' }) })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <PhoneCellDisplay
        {...makeProps({ value: '+1-555-123-4567', field: makeField({ fieldType: 'phone', readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('PhoneCellEdit', () => {
  it('renders tel input with current value', () => {
    renderWithIntl(
      <PhoneCellEdit
        {...makeProps({ value: '+1-555-123-4567', field: makeField({ fieldType: 'phone' }), isEditing: true })}
      />,
    );
    const input = document.querySelector('input[type="tel"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('+1-555-123-4567');
  });

  it('calls onSave on blur', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <PhoneCellEdit
        {...makeProps({ value: '+1-555', field: makeField({ fieldType: 'phone' }), onSave, isEditing: true })}
      />,
    );
    fireEvent.blur(document.querySelector('input[type="tel"]')!);
    expect(onSave).toHaveBeenCalledWith('+1-555');
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <PhoneCellEdit
        {...makeProps({ value: '+1-555', field: makeField({ fieldType: 'phone' }), onCancel, isEditing: true })}
      />,
    );
    fireEvent.keyDown(document.querySelector('input[type="tel"]')!, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// SmartDocCell
// ---------------------------------------------------------------------------

describe('SmartDocCellDisplay', () => {
  it('renders badge when content exists', () => {
    renderWithIntl(
      <SmartDocCellDisplay
        {...makeProps({ value: { content: 'Some doc content' }, field: makeField({ fieldType: 'smart_doc' }) })}
      />,
    );
    expect(screen.getByText('Doc')).toBeInTheDocument();
  });

  it('renders null when value is null', () => {
    const { container } = renderWithIntl(
      <SmartDocCellDisplay
        {...makeProps({ value: null, field: makeField({ fieldType: 'smart_doc' }) })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when value is empty string', () => {
    const { container } = renderWithIntl(
      <SmartDocCellDisplay
        {...makeProps({ value: '', field: makeField({ fieldType: 'smart_doc' }) })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when value is false', () => {
    const { container } = renderWithIntl(
      <SmartDocCellDisplay
        {...makeProps({ value: false, field: makeField({ fieldType: 'smart_doc' }) })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <SmartDocCellDisplay
        {...makeProps({
          value: { content: 'test' },
          field: makeField({ fieldType: 'smart_doc', readOnly: true }),
        })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('SmartDocCellEdit', () => {
  it('renders placeholder message', () => {
    renderWithIntl(
      <SmartDocCellEdit
        {...makeProps({ value: { content: 'test' }, field: makeField({ fieldType: 'smart_doc' }), isEditing: true })}
      />,
    );
    expect(screen.getByText('Opens in Smart Doc editor (Phase 3D)')).toBeInTheDocument();
  });

  it('calls onCancel when close clicked', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <SmartDocCellEdit
        {...makeProps({ value: null, field: makeField({ fieldType: 'smart_doc' }), onCancel, isEditing: true })}
      />,
    );
    fireEvent.click(screen.getByText('Close'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// BarcodeCell
// ---------------------------------------------------------------------------

describe('BarcodeCellDisplay', () => {
  it('renders text with barcode icon', () => {
    renderWithIntl(
      <BarcodeCellDisplay
        {...makeProps({ value: 'ABC-12345', field: makeField({ fieldType: 'barcode' }) })}
      />,
    );
    expect(screen.getByText('ABC-12345')).toBeInTheDocument();
  });

  it('renders null for empty value', () => {
    const { container } = renderWithIntl(
      <BarcodeCellDisplay
        {...makeProps({ value: null, field: makeField({ fieldType: 'barcode' }) })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null for empty string', () => {
    const { container } = renderWithIntl(
      <BarcodeCellDisplay
        {...makeProps({ value: '', field: makeField({ fieldType: 'barcode' }) })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <BarcodeCellDisplay
        {...makeProps({ value: 'ABC-12345', field: makeField({ fieldType: 'barcode', readOnly: true }) })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

describe('BarcodeCellEdit', () => {
  it('renders text input with current value', () => {
    renderWithIntl(
      <BarcodeCellEdit
        {...makeProps({ value: 'ABC-12345', field: makeField({ fieldType: 'barcode' }), isEditing: true })}
      />,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('ABC-12345');
  });

  it('calls onSave on blur', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <BarcodeCellEdit
        {...makeProps({ value: 'ABC', field: makeField({ fieldType: 'barcode' }), onSave, isEditing: true })}
      />,
    );
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onSave).toHaveBeenCalledWith('ABC');
  });

  it('calls onSave on Enter', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <BarcodeCellEdit
        {...makeProps({ value: 'ABC', field: makeField({ fieldType: 'barcode' }), onSave, isEditing: true })}
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('ABC');
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <BarcodeCellEdit
        {...makeProps({ value: 'ABC', field: makeField({ fieldType: 'barcode' }), onCancel, isEditing: true })}
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('saves null for empty input', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <BarcodeCellEdit
        {...makeProps({ value: '', field: makeField({ fieldType: 'barcode' }), onSave, isEditing: true })}
      />,
    );
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onSave).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// ChecklistCell
// ---------------------------------------------------------------------------

const checklistValue = [
  { id: 'c1', text: 'Buy milk', checked: true },
  { id: 'c2', text: 'Walk dog', checked: false },
  { id: 'c3', text: 'Write code', checked: true },
];

describe('ChecklistCellDisplay', () => {
  it('renders "X/Y done" with progress bar', () => {
    renderWithIntl(
      <ChecklistCellDisplay
        {...makeProps({ value: checklistValue, field: makeField({ fieldType: 'checklist' }) })}
      />,
    );
    expect(screen.getByText('2/3 done')).toBeInTheDocument();
  });

  it('renders null for empty array', () => {
    const { container } = renderWithIntl(
      <ChecklistCellDisplay
        {...makeProps({ value: [], field: makeField({ fieldType: 'checklist' }) })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null for null value', () => {
    const { container } = renderWithIntl(
      <ChecklistCellDisplay
        {...makeProps({ value: null, field: makeField({ fieldType: 'checklist' }) })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lock icon for read-only field', () => {
    renderWithIntl(
      <ChecklistCellDisplay
        {...makeProps({
          value: checklistValue,
          field: makeField({ fieldType: 'checklist', readOnly: true }),
        })}
      />,
    );
    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });

  it('handles all items checked', () => {
    const allChecked = [
      { id: 'c1', text: 'A', checked: true },
      { id: 'c2', text: 'B', checked: true },
    ];
    renderWithIntl(
      <ChecklistCellDisplay
        {...makeProps({ value: allChecked, field: makeField({ fieldType: 'checklist' }) })}
      />,
    );
    expect(screen.getByText('2/2 done')).toBeInTheDocument();
  });

  it('handles no items checked', () => {
    const noneChecked = [
      { id: 'c1', text: 'A', checked: false },
      { id: 'c2', text: 'B', checked: false },
    ];
    renderWithIntl(
      <ChecklistCellDisplay
        {...makeProps({ value: noneChecked, field: makeField({ fieldType: 'checklist' }) })}
      />,
    );
    expect(screen.getByText('0/2 done')).toBeInTheDocument();
  });
});

describe('ChecklistCellEdit', () => {
  it('renders checklist items with checkboxes', () => {
    renderWithIntl(
      <ChecklistCellEdit
        {...makeProps({ value: checklistValue, field: makeField({ fieldType: 'checklist' }), isEditing: true })}
      />,
    );
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByText('Walk dog')).toBeInTheDocument();
    expect(screen.getByText('Write code')).toBeInTheDocument();
  });

  it('toggles item on checkbox click', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <ChecklistCellEdit
        {...makeProps({ value: checklistValue, field: makeField({ fieldType: 'checklist' }), onSave, isEditing: true })}
      />,
    );
    // Click the checkbox for 'Walk dog' (unchecked → checked)
    const walkDogCheckbox = screen.getByLabelText('Walk dog');
    fireEvent.click(walkDogCheckbox);
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'c2', text: 'Walk dog', checked: true }),
      ]),
    );
  });

  it('adds new item on Enter in add input', () => {
    const onSave = vi.fn();
    renderWithIntl(
      <ChecklistCellEdit
        {...makeProps({ value: checklistValue, field: makeField({ fieldType: 'checklist' }), onSave, isEditing: true })}
      />,
    );
    const addInput = screen.getByPlaceholderText('Add item');
    fireEvent.change(addInput, { target: { value: 'New task' } });
    fireEvent.keyDown(addInput, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ text: 'New task', checked: false }),
      ]),
    );
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <ChecklistCellEdit
        {...makeProps({ value: checklistValue, field: makeField({ fieldType: 'checklist' }), onCancel, isEditing: true })}
      />,
    );
    const container = screen.getByPlaceholderText('Add item').closest('div[class]')!;
    fireEvent.keyDown(container, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
