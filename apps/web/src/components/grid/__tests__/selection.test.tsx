// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { useRowSelection } from '../use-row-selection';
import { BulkActionsToolbar } from '../BulkActionsToolbar';
import type { GridRecord, GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<GridRecord> = {}): GridRecord {
  return {
    tenantId: 'tenant-1',
    id: 'record-1',
    tableId: 'table-1',
    canonicalData: { 'field-1': 'Test value' },
    syncMetadata: {},
    searchVector: null,
    archivedAt: null,
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GridRecord;
}

function makeField(overrides: Partial<GridField> = {}): GridField {
  return {
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
    ...overrides,
  } as GridField;
}

const testRecords: GridRecord[] = [
  makeRecord({ id: 'rec-1' }),
  makeRecord({ id: 'rec-2' }),
  makeRecord({ id: 'rec-3' }),
  makeRecord({ id: 'rec-4' }),
  makeRecord({ id: 'rec-5' }),
];

const testFields: GridField[] = [
  makeField({ id: 'field-1', name: 'Name', fieldType: 'text', isPrimary: true }),
  makeField({
    id: 'field-2',
    name: 'Amount',
    fieldType: 'number',
    isPrimary: false,
    readOnly: false,
    isSystem: false,
  }),
];

// ---------------------------------------------------------------------------
// useRowSelection tests
// ---------------------------------------------------------------------------

describe('useRowSelection', () => {
  it('toggleSelectAll selects all rows when none are selected', () => {
    const setSelectedRows = vi.fn();
    const { result } = renderHook(() =>
      useRowSelection({
        records: testRecords,
        selectedRows: new Set(),
        setSelectedRows,
      }),
    );

    act(() => {
      result.current.toggleSelectAll();
    });

    const callArg = setSelectedRows.mock.calls[0]?.[0] as Set<string>;
    expect(callArg.size).toBe(5);
    expect(callArg.has('rec-1')).toBe(true);
    expect(callArg.has('rec-5')).toBe(true);
  });

  it('toggleSelectAll deselects all when all are selected', () => {
    const setSelectedRows = vi.fn();
    const allIds = new Set(testRecords.map((r) => r.id));
    const { result } = renderHook(() =>
      useRowSelection({
        records: testRecords,
        selectedRows: allIds,
        setSelectedRows,
      }),
    );

    act(() => {
      result.current.toggleSelectAll();
    });

    const callArg = setSelectedRows.mock.calls[0]?.[0] as Set<string>;
    expect(callArg.size).toBe(0);
  });

  it('allSelected is true when all rows are selected', () => {
    const allIds = new Set(testRecords.map((r) => r.id));
    const { result } = renderHook(() =>
      useRowSelection({
        records: testRecords,
        selectedRows: allIds,
        setSelectedRows: vi.fn(),
      }),
    );

    expect(result.current.allSelected).toBe(true);
    expect(result.current.someSelected).toBe(false);
  });

  it('someSelected is true when partial rows are selected', () => {
    const { result } = renderHook(() =>
      useRowSelection({
        records: testRecords,
        selectedRows: new Set(['rec-1', 'rec-2']),
        setSelectedRows: vi.fn(),
      }),
    );

    expect(result.current.allSelected).toBe(false);
    expect(result.current.someSelected).toBe(true);
  });

  it('handleRowSelect with plain click selects only that row', () => {
    const setSelectedRows = vi.fn();
    const { result } = renderHook(() =>
      useRowSelection({
        records: testRecords,
        selectedRows: new Set(['rec-1']),
        setSelectedRows,
      }),
    );

    act(() => {
      result.current.handleRowSelect('rec-3', {
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
      });
    });

    const callArg = setSelectedRows.mock.calls[0]?.[0] as Set<string>;
    expect(callArg.size).toBe(1);
    expect(callArg.has('rec-3')).toBe(true);
  });

  it('handleRowSelect with metaKey toggles selection', () => {
    const setSelectedRows = vi.fn();
    const { result } = renderHook(() =>
      useRowSelection({
        records: testRecords,
        selectedRows: new Set(['rec-1']),
        setSelectedRows,
      }),
    );

    act(() => {
      result.current.handleRowSelect('rec-3', {
        shiftKey: false,
        metaKey: true,
        ctrlKey: false,
      });
    });

    const callArg = setSelectedRows.mock.calls[0]?.[0] as Set<string>;
    expect(callArg.size).toBe(2);
    expect(callArg.has('rec-1')).toBe(true);
    expect(callArg.has('rec-3')).toBe(true);
  });

  it('handleRowSelect with meta deselects if already selected', () => {
    const setSelectedRows = vi.fn();
    const { result } = renderHook(() =>
      useRowSelection({
        records: testRecords,
        selectedRows: new Set(['rec-1', 'rec-3']),
        setSelectedRows,
      }),
    );

    act(() => {
      result.current.handleRowSelect('rec-3', {
        shiftKey: false,
        metaKey: true,
        ctrlKey: false,
      });
    });

    const callArg = setSelectedRows.mock.calls[0]?.[0] as Set<string>;
    expect(callArg.size).toBe(1);
    expect(callArg.has('rec-1')).toBe(true);
    expect(callArg.has('rec-3')).toBe(false);
  });

  it('handleRowSelect with shiftKey range-selects rows', () => {
    const setSelectedRows = vi.fn();
    const { result } = renderHook(() =>
      useRowSelection({
        records: testRecords,
        selectedRows: new Set(),
        setSelectedRows,
      }),
    );

    // First click to set anchor
    act(() => {
      result.current.handleRowSelect('rec-2', {
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
      });
    });

    // Now shift-click rec-4
    act(() => {
      result.current.handleRowSelect('rec-4', {
        shiftKey: true,
        metaKey: false,
        ctrlKey: false,
      });
    });

    // Second call is the shift+click
    const callArg = setSelectedRows.mock.calls[1]?.[0] as Set<string>;
    expect(callArg.has('rec-2')).toBe(true);
    expect(callArg.has('rec-3')).toBe(true);
    expect(callArg.has('rec-4')).toBe(true);
  });

  it('clearSelection empties selection', () => {
    const setSelectedRows = vi.fn();
    const { result } = renderHook(() =>
      useRowSelection({
        records: testRecords,
        selectedRows: new Set(['rec-1', 'rec-2']),
        setSelectedRows,
      }),
    );

    act(() => {
      result.current.clearSelection();
    });

    const callArg = setSelectedRows.mock.calls[0]?.[0] as Set<string>;
    expect(callArg.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// BulkActionsToolbar tests
// ---------------------------------------------------------------------------

describe('BulkActionsToolbar', () => {
  const defaultToolbarProps = {
    selectedCount: 3,
    fields: testFields,
    onDelete: vi.fn(),
    onBulkUpdateField: vi.fn(),
    onDuplicate: vi.fn(),
    onCopy: vi.fn(),
    onClearSelection: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when selectedCount < 2', () => {
    const { container } = render(
      <IntlWrapper>
        <BulkActionsToolbar {...defaultToolbarProps} selectedCount={1} />
      </IntlWrapper>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders toolbar when 2+ rows selected', () => {
    render(
      <IntlWrapper>
        <BulkActionsToolbar {...defaultToolbarProps} />
      </IntlWrapper>,
    );

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('shows selected count label', () => {
    render(
      <IntlWrapper>
        <BulkActionsToolbar {...defaultToolbarProps} selectedCount={5} />
      </IntlWrapper>,
    );

    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });

  it('shows delete confirmation dialog on delete click', () => {
    render(
      <IntlWrapper>
        <BulkActionsToolbar {...defaultToolbarProps} />
      </IntlWrapper>,
    );

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Delete records')).toBeInTheDocument();
  });

  it('calls onDelete on confirm', () => {
    render(
      <IntlWrapper>
        <BulkActionsToolbar {...defaultToolbarProps} />
      </IntlWrapper>,
    );

    // Open dialog
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);

    // Confirm
    const confirmBtn = screen.getAllByRole('button', { name: /delete/i });
    const dialogConfirm = confirmBtn[confirmBtn.length - 1];
    if (dialogConfirm) {
      fireEvent.click(dialogConfirm);
    }

    expect(defaultToolbarProps.onDelete).toHaveBeenCalledOnce();
  });

  it('calls onClearSelection when clear button clicked', () => {
    render(
      <IntlWrapper>
        <BulkActionsToolbar {...defaultToolbarProps} />
      </IntlWrapper>,
    );

    const clearBtn = screen.getByLabelText('Clear selection');
    fireEvent.click(clearBtn);

    expect(defaultToolbarProps.onClearSelection).toHaveBeenCalledOnce();
  });

  it('calls onDuplicate when duplicate clicked', () => {
    render(
      <IntlWrapper>
        <BulkActionsToolbar {...defaultToolbarProps} />
      </IntlWrapper>,
    );

    const dupBtn = screen.getByRole('button', { name: /duplicate/i });
    fireEvent.click(dupBtn);

    expect(defaultToolbarProps.onDuplicate).toHaveBeenCalledOnce();
  });

  it('calls onCopy when copy clicked', () => {
    render(
      <IntlWrapper>
        <BulkActionsToolbar {...defaultToolbarProps} />
      </IntlWrapper>,
    );

    const copyBtn = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyBtn);

    expect(defaultToolbarProps.onCopy).toHaveBeenCalledOnce();
  });
});
