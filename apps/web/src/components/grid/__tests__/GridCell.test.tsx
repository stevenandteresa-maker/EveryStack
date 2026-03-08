// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GridCell, registerCellRenderer, getCellRenderer } from '../GridCell';
import type { GridRecord, GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testField: GridField = {
  id: 'field-1',
  tableId: 'table-1',
  tenantId: 'tenant-1',
  name: 'Name',
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

const testRecord: GridRecord = {
  tenantId: 'tenant-1',
  id: 'rec-1',
  tableId: 'table-1',
  canonicalData: { 'field-1': 'Hello world' },
  syncMetadata: {},
  searchVector: null,
  archivedAt: null,
  createdBy: 'user-1',
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as GridRecord;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GridCell', () => {
  it('renders with gridcell role', () => {
    render(
      <GridCell
        record={testRecord}
        field={testField}
        isActive={false}
        isEditing={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('gridcell')).toBeInTheDocument();
  });

  it('renders cell value from canonical data using default renderer', () => {
    render(
      <GridCell
        record={testRecord}
        field={testField}
        isActive={false}
        isEditing={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders empty cell for null value', () => {
    const recordWithNull: GridRecord = {
      ...testRecord,
      canonicalData: { 'field-1': null },
    } as GridRecord;

    render(
      <GridCell
        record={recordWithNull}
        field={testField}
        isActive={false}
        isEditing={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    const cell = screen.getByRole('gridcell');
    // Cell should exist but text content should be empty
    expect(cell).toBeInTheDocument();
  });

  it('renders empty cell for missing field in canonical data', () => {
    const recordMissing: GridRecord = {
      ...testRecord,
      canonicalData: {},
    } as GridRecord;

    render(
      <GridCell
        record={recordMissing}
        field={testField}
        isActive={false}
        isEditing={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('gridcell')).toBeInTheDocument();
  });

  it('applies active cell ring when isActive is true', () => {
    render(
      <GridCell
        record={testRecord}
        field={testField}
        isActive={true}
        isEditing={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    const cell = screen.getByRole('gridcell');
    expect(cell.className).toContain('ring-2');
  });

  it('does not apply ring when isActive is false', () => {
    render(
      <GridCell
        record={testRecord}
        field={testField}
        isActive={false}
        isEditing={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    const cell = screen.getByRole('gridcell');
    expect(cell.className).not.toContain('ring-2');
  });

  it('fires onClick when cell is clicked (after debounce)', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();

    render(
      <GridCell
        record={testRecord}
        field={testField}
        isActive={false}
        isEditing={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClick={onClick}
      />,
    );

    fireEvent.click(screen.getByRole('gridcell'));
    // onClick is deferred by 200ms to allow double-click detection
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onClick).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe('Cell renderer registry', () => {
  it('registers and retrieves a cell renderer', () => {
    function TestDisplay() {
      return <span>custom</span>;
    }

    registerCellRenderer('test_type', { DisplayComponent: TestDisplay });

    const entry = getCellRenderer('test_type');
    expect(entry).toBeDefined();
    expect(entry?.DisplayComponent).toBe(TestDisplay);
  });

  it('returns undefined for unregistered type', () => {
    expect(getCellRenderer('nonexistent_type_xyz')).toBeUndefined();
  });
});
