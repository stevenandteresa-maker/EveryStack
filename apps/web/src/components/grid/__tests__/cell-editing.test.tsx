// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { GridCell, registerCellRenderer } from '../GridCell';
import { useCellEdit } from '../../../lib/hooks/use-cell-edit';
import type { GridRecord, GridField } from '../../../lib/types/grid';
import type { CellRendererProps } from '../GridCell';

// ---------------------------------------------------------------------------
// Mock next-intl
// ---------------------------------------------------------------------------

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const textField: GridField = {
  id: 'field-text',
  tableId: 'table-1',
  tenantId: 'tenant-1',
  name: 'Title',
  fieldType: 'text',
  fieldSubType: null,
  isPrimary: true,
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
} as GridField;

const readOnlyField: GridField = {
  ...textField,
  id: 'field-readonly',
  readOnly: true,
} as GridField;

const checkboxField: GridField = {
  ...textField,
  id: 'field-checkbox',
  fieldType: 'checkbox',
  readOnly: false,
} as GridField;

const ratingField: GridField = {
  ...textField,
  id: 'field-rating',
  fieldType: 'rating',
  readOnly: false,
  config: { max: 5 },
} as GridField;

const testRecord: GridRecord = {
  tenantId: 'tenant-1',
  id: 'rec-1',
  tableId: 'table-1',
  canonicalData: {
    'field-text': 'Hello world',
    'field-readonly': 'Locked value',
    'field-checkbox': false,
    'field-rating': 3,
  },
  syncMetadata: {},
  searchVector: null,
  archivedAt: null,
  createdBy: 'user-1',
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as GridRecord;

// ---------------------------------------------------------------------------
// Register test renderers
// ---------------------------------------------------------------------------

function TestTextDisplay({ value, field: _field }: CellRendererProps) {
  return <span data-testid="text-display">{value != null ? String(value) : ''}</span>;
}

function TestTextEdit({ value, onSave, onCancel }: CellRendererProps) {
  return (
    <input
      data-testid="text-edit"
      defaultValue={value != null ? String(value) : ''}
      onBlur={(e) => onSave(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value);
        if (e.key === 'Escape') onCancel();
      }}
    />
  );
}

function TestCheckboxDisplay({ value, onSave }: CellRendererProps) {
  return (
    <input
      data-testid="checkbox-display"
      type="checkbox"
      checked={Boolean(value)}
      onChange={() => onSave(!value)}
    />
  );
}

function TestRatingDisplay({ value, onSave }: CellRendererProps) {
  return (
    <button
      data-testid="rating-display"
      onClick={() => onSave(typeof value === 'number' ? value + 1 : 1)}
    >
      {String(value)}
    </button>
  );
}

beforeEach(() => {
  registerCellRenderer('text', {
    DisplayComponent: TestTextDisplay,
    EditComponent: TestTextEdit,
  });
  registerCellRenderer('checkbox', {
    DisplayComponent: TestCheckboxDisplay,
  });
  registerCellRenderer('rating', {
    DisplayComponent: TestRatingDisplay,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cell editing interactions', () => {
  describe('Single click behavior', () => {
    it('fires onClick for non-editing interactions', () => {
      vi.useFakeTimers();
      const onClick = vi.fn();

      render(
        <GridCell
          record={testRecord}
          field={textField}
          isActive={false}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={onClick}
          onDoubleClick={vi.fn()}
          onStartReplace={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('gridcell'));
      // onClick should be deferred (200ms debounce for double-click detection)
      expect(onClick).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(onClick).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });
  });

  describe('Double-click behavior', () => {
    it('fires onDoubleClick for edit mode entry', () => {
      vi.useFakeTimers();
      const onDoubleClick = vi.fn();
      const onClick = vi.fn();

      render(
        <GridCell
          record={testRecord}
          field={textField}
          isActive={false}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onStartReplace={vi.fn()}
        />,
      );

      const cell = screen.getByRole('gridcell');
      fireEvent.click(cell);
      fireEvent.click(cell);

      expect(onDoubleClick).toHaveBeenCalledOnce();
      // Single click should NOT fire
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onClick).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('Replace mode (single click + type)', () => {
    it('fires onStartReplace when typing a character on active cell', () => {
      const onStartReplace = vi.fn();

      render(
        <GridCell
          record={testRecord}
          field={textField}
          isActive={true}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          onDoubleClick={vi.fn()}
          onStartReplace={onStartReplace}
        />,
      );

      fireEvent.keyDown(screen.getByRole('gridcell'), { key: 'a' });
      expect(onStartReplace).toHaveBeenCalledOnce();
    });

    it('does not fire onStartReplace for modifier keys', () => {
      const onStartReplace = vi.fn();

      render(
        <GridCell
          record={testRecord}
          field={textField}
          isActive={true}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          onDoubleClick={vi.fn()}
          onStartReplace={onStartReplace}
        />,
      );

      fireEvent.keyDown(screen.getByRole('gridcell'), { key: 'c', ctrlKey: true });
      fireEvent.keyDown(screen.getByRole('gridcell'), { key: 'v', metaKey: true });
      expect(onStartReplace).not.toHaveBeenCalled();
    });
  });

  describe('Checkbox toggle', () => {
    it('toggles on single click without entering edit mode', () => {
      const onClick = vi.fn();
      const onSave = vi.fn();

      render(
        <GridCell
          record={testRecord}
          field={checkboxField}
          isActive={false}
          isEditing={false}
          onSave={onSave}
          onCancel={vi.fn()}
          onClick={onClick}
          onDoubleClick={vi.fn()}
          onStartReplace={vi.fn()}
        />,
      );

      // Click the checkbox input inside the cell
      const checkbox = screen.getByTestId('checkbox-display');
      fireEvent.click(checkbox);
      // The display component's onSave should be called with toggled value
      expect(onSave).toHaveBeenCalledWith(true);
    });
  });

  describe('Rating click', () => {
    it('sets value on star click without entering edit mode', () => {
      const onSave = vi.fn();

      render(
        <GridCell
          record={testRecord}
          field={ratingField}
          isActive={false}
          isEditing={false}
          onSave={onSave}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          onDoubleClick={vi.fn()}
          onStartReplace={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId('rating-display'));
      expect(onSave).toHaveBeenCalledWith(4); // 3 + 1
    });
  });

  describe('Read-only cells', () => {
    it('ignores click for edit purposes', () => {
      const onDoubleClick = vi.fn();
      const onStartReplace = vi.fn();
      const onClick = vi.fn();

      render(
        <GridCell
          record={testRecord}
          field={readOnlyField}
          isActive={false}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onStartReplace={onStartReplace}
        />,
      );

      const cell = screen.getByRole('gridcell');
      fireEvent.click(cell);
      // Read-only: onClick fires immediately (no double-click timer)
      expect(onClick).toHaveBeenCalledOnce();
      expect(onDoubleClick).not.toHaveBeenCalled();
    });

    it('ignores keyboard input for replace mode', () => {
      const onStartReplace = vi.fn();

      render(
        <GridCell
          record={testRecord}
          field={readOnlyField}
          isActive={true}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          onDoubleClick={vi.fn()}
          onStartReplace={onStartReplace}
        />,
      );

      fireEvent.keyDown(screen.getByRole('gridcell'), { key: 'a' });
      expect(onStartReplace).not.toHaveBeenCalled();
    });
  });

  describe('Edit mode rendering', () => {
    it('renders edit component when isEditing is true', () => {
      render(
        <GridCell
          record={testRecord}
          field={textField}
          isActive={true}
          isEditing={true}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          onDoubleClick={vi.fn()}
          onStartReplace={vi.fn()}
        />,
      );

      expect(screen.getByTestId('text-edit')).toBeInTheDocument();
    });

    it('renders display component when not editing', () => {
      render(
        <GridCell
          record={testRecord}
          field={textField}
          isActive={true}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          onDoubleClick={vi.fn()}
          onStartReplace={vi.fn()}
        />,
      );

      expect(screen.getByTestId('text-display')).toBeInTheDocument();
    });
  });

  describe('Empty cells', () => {
    it('renders blank for null value', () => {
      const recordWithNull: GridRecord = {
        ...testRecord,
        canonicalData: { 'field-text': null },
      } as GridRecord;

      render(
        <GridCell
          record={recordWithNull}
          field={textField}
          isActive={false}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
        />,
      );

      const display = screen.getByTestId('text-display');
      expect(display.textContent).toBe('');
    });

    it('renders blank for missing field in canonical data', () => {
      const recordMissing: GridRecord = {
        ...testRecord,
        canonicalData: {},
      } as GridRecord;

      render(
        <GridCell
          record={recordMissing}
          field={textField}
          isActive={false}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
        />,
      );

      const display = screen.getByTestId('text-display');
      expect(display.textContent).toBe('');
    });
  });

  describe('Validation error display', () => {
    it('shows red ring and error message when validationError is set', () => {
      render(
        <GridCell
          record={testRecord}
          field={textField}
          isActive={true}
          isEditing={true}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
          validationError="Value is required"
        />,
      );

      const cell = screen.getByRole('gridcell');
      expect(cell.className).toContain('ring-red-500');
      expect(screen.getByText('Value is required')).toBeInTheDocument();
    });
  });

  describe('Cell active/editing styling', () => {
    it('applies ring-2 for active cell', () => {
      render(
        <GridCell
          record={testRecord}
          field={textField}
          isActive={true}
          isEditing={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
        />,
      );

      const cell = screen.getByRole('gridcell');
      expect(cell.className).toContain('ring-2');
      expect(cell.className).toContain('z-10');
    });

    it('applies shadow-sm for editing cell', () => {
      render(
        <GridCell
          record={testRecord}
          field={textField}
          isActive={true}
          isEditing={true}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onClick={vi.fn()}
        />,
      );

      const cell = screen.getByRole('gridcell');
      expect(cell.className).toContain('shadow-sm');
      expect(cell.className).toContain('z-20');
    });
  });
});

describe('useCellEdit hook', () => {

  it('starts in non-editing state', () => {
    const { result } = renderHook(() =>
      useCellEdit({
        value: 'test',
        readOnly: false,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(result.current.isEditing).toBe(false);
    expect(result.current.localValue).toBe('test');
  });

  it('enters replace mode and clears value', () => {
    const { result } = renderHook(() =>
      useCellEdit({
        value: 'test',
        readOnly: false,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    act(() => {
      result.current.startReplace();
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.editMode).toBe('replace');
    expect(result.current.localValue).toBe('');
  });

  it('enters edit mode and preserves value', () => {
    const { result } = renderHook(() =>
      useCellEdit({
        value: 'test',
        readOnly: false,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    act(() => {
      result.current.startEdit();
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.editMode).toBe('edit');
    expect(result.current.localValue).toBe('test');
  });

  it('saves changed value on save()', () => {
    const onSave = vi.fn();

    const { result } = renderHook(() =>
      useCellEdit({
        value: 'original',
        readOnly: false,
        onSave,
        onCancel: vi.fn(),
      }),
    );

    act(() => {
      result.current.startEdit();
    });

    act(() => {
      result.current.setLocalValue('changed');
    });

    act(() => {
      result.current.save();
    });

    expect(onSave).toHaveBeenCalledWith('changed');
    expect(result.current.isEditing).toBe(false);
  });

  it('calls onCancel when value unchanged', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    const { result } = renderHook(() =>
      useCellEdit({
        value: 'original',
        readOnly: false,
        onSave,
        onCancel,
      }),
    );

    act(() => {
      result.current.startEdit();
    });

    act(() => {
      result.current.save();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('reverts on cancel', () => {
    const onCancel = vi.fn();

    const { result } = renderHook(() =>
      useCellEdit({
        value: 'original',
        readOnly: false,
        onSave: vi.fn(),
        onCancel,
      }),
    );

    act(() => {
      result.current.startEdit();
    });

    act(() => {
      result.current.setLocalValue('changed');
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.isEditing).toBe(false);
    expect(result.current.localValue).toBe('original');
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not enter edit mode when readOnly', () => {
    const { result } = renderHook(() =>
      useCellEdit({
        value: 'test',
        readOnly: true,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    act(() => {
      result.current.startEdit();
    });

    expect(result.current.isEditing).toBe(false);

    act(() => {
      result.current.startReplace();
    });

    expect(result.current.isEditing).toBe(false);
  });

  it('handles Escape keydown to cancel', () => {
    const onCancel = vi.fn();

    const { result } = renderHook(() =>
      useCellEdit({
        value: 'test',
        readOnly: false,
        onSave: vi.fn(),
        onCancel,
      }),
    );

    act(() => {
      result.current.startEdit();
    });

    act(() => {
      result.current.handleKeyDown({
        key: 'Escape',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.isEditing).toBe(false);
    expect(onCancel).toHaveBeenCalled();
  });

  it('handles Enter keydown to save and move down', () => {
    const onSave = vi.fn();
    const onMoveDown = vi.fn();

    const { result } = renderHook(() =>
      useCellEdit({
        value: 'original',
        readOnly: false,
        onSave,
        onCancel: vi.fn(),
        onMoveDown,
      }),
    );

    act(() => {
      result.current.startEdit();
    });

    act(() => {
      result.current.setLocalValue('changed');
    });

    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(onSave).toHaveBeenCalledWith('changed');
    expect(onMoveDown).toHaveBeenCalled();
  });

  it('handles Tab keydown to save and move right', () => {
    const onSave = vi.fn();
    const onMoveRight = vi.fn();

    const { result } = renderHook(() =>
      useCellEdit({
        value: 'original',
        readOnly: false,
        onSave,
        onCancel: vi.fn(),
        onMoveRight,
      }),
    );

    act(() => {
      result.current.startEdit();
    });

    act(() => {
      result.current.setLocalValue('changed');
    });

    act(() => {
      result.current.handleKeyDown({
        key: 'Tab',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(onSave).toHaveBeenCalledWith('changed');
    expect(onMoveRight).toHaveBeenCalled();
  });

  it('auto-saves on blur', () => {
    const onSave = vi.fn();

    const { result } = renderHook(() =>
      useCellEdit({
        value: 'original',
        readOnly: false,
        onSave,
        onCancel: vi.fn(),
      }),
    );

    act(() => {
      result.current.startEdit();
    });

    act(() => {
      result.current.setLocalValue('blurred value');
    });

    act(() => {
      result.current.handleBlur();
    });

    expect(onSave).toHaveBeenCalledWith('blurred value');
    expect(result.current.isEditing).toBe(false);
  });
});
