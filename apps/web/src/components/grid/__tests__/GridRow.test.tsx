// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import { GridRow } from '../GridRow';
import type { GridRecord, GridField } from '../../../lib/types/grid';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

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

const testFields: GridField[] = [
  makeField({ id: 'f1', name: 'Name', isPrimary: true }),
  makeField({ id: 'f2', name: 'Age', fieldType: 'number', isPrimary: false, sortOrder: 1 }),
];

const testRecord: GridRecord = {
  tenantId: 'tenant-1',
  id: 'rec-1',
  tableId: 'table-1',
  canonicalData: { f1: 'Alice', f2: 42 },
  syncMetadata: {},
  searchVector: null,
  archivedAt: null,
  createdBy: 'user-1',
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as GridRecord;

// Wrapper that creates a TanStack Table row
function TestWrapper({ children }: { children: (row: Row<GridRecord>) => React.ReactNode }) {
  const columns: ColumnDef<GridRecord>[] = testFields.map((f) => ({
    id: f.id,
    accessorFn: (row: GridRecord) => (row.canonicalData as Record<string, unknown>)?.[f.id],
    header: f.name,
    size: 200,
  }));

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<GridRecord>({
    data: [testRecord],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const row = table.getRowModel().rows[0];
  if (!row) return null;

  return <IntlWrapper>{children(row)}</IntlWrapper>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GridRow', () => {
  it('renders with row role', () => {
    render(
      <TestWrapper>
        {(row) => (
          <GridRow
            row={row}
            rowIndex={0}
            fields={testFields}
            density="medium"
            rowHeight={44}
            activeCell={null}
            editingCell={null}
            onCellClick={vi.fn()}
            onCellDoubleClick={vi.fn()}
            onCellStartReplace={vi.fn()}
            onCellSave={vi.fn()}
            columnColors={{}}
            onCellCancel={vi.fn()}
          />
        )}
      </TestWrapper>,
    );

    expect(screen.getByRole('row')).toBeInTheDocument();
  });

  it('renders row number', () => {
    render(
      <TestWrapper>
        {(row) => (
          <GridRow
            row={row}
            rowIndex={2}
            fields={testFields}
            density="medium"
            rowHeight={44}
            activeCell={null}
            editingCell={null}
            onCellClick={vi.fn()}
            onCellDoubleClick={vi.fn()}
            onCellStartReplace={vi.fn()}
            onCellSave={vi.fn()}
            columnColors={{}}
            onCellCancel={vi.fn()}
          />
        )}
      </TestWrapper>,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders checkbox', () => {
    render(
      <TestWrapper>
        {(row) => (
          <GridRow
            row={row}
            rowIndex={0}
            fields={testFields}
            density="medium"
            rowHeight={44}
            activeCell={null}
            editingCell={null}
            onCellClick={vi.fn()}
            onCellDoubleClick={vi.fn()}
            onCellStartReplace={vi.fn()}
            onCellSave={vi.fn()}
            columnColors={{}}
            onCellCancel={vi.fn()}
          />
        )}
      </TestWrapper>,
    );

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('shows drag handle on hover', () => {
    render(
      <TestWrapper>
        {(row) => (
          <GridRow
            row={row}
            rowIndex={0}
            fields={testFields}
            density="medium"
            rowHeight={44}
            activeCell={null}
            editingCell={null}
            onCellClick={vi.fn()}
            onCellDoubleClick={vi.fn()}
            onCellStartReplace={vi.fn()}
            onCellSave={vi.fn()}
            columnColors={{}}
            onCellCancel={vi.fn()}
          />
        )}
      </TestWrapper>,
    );

    const rowEl = screen.getByRole('row');
    expect(screen.queryByText('⠿')).not.toBeInTheDocument();

    fireEvent.mouseEnter(rowEl);
    expect(screen.getByText('⠿')).toBeInTheDocument();

    fireEvent.mouseLeave(rowEl);
    expect(screen.queryByText('⠿')).not.toBeInTheDocument();
  });

  it('shows expand icon on primary field hover', () => {
    render(
      <TestWrapper>
        {(row) => (
          <GridRow
            row={row}
            rowIndex={0}
            fields={testFields}
            density="medium"
            rowHeight={44}
            activeCell={null}
            editingCell={null}
            onCellClick={vi.fn()}
            onCellDoubleClick={vi.fn()}
            onCellStartReplace={vi.fn()}
            onCellSave={vi.fn()}
            columnColors={{}}
            onCellCancel={vi.fn()}
          />
        )}
      </TestWrapper>,
    );

    const rowEl = screen.getByRole('row');
    fireEvent.mouseEnter(rowEl);

    expect(screen.getByText('⤢')).toBeInTheDocument();
  });

  it('applies zebra striping for odd rows', () => {
    render(
      <TestWrapper>
        {(row) => (
          <GridRow
            row={row}
            rowIndex={1}
            fields={testFields}
            density="medium"
            rowHeight={44}
            activeCell={null}
            editingCell={null}
            onCellClick={vi.fn()}
            onCellDoubleClick={vi.fn()}
            onCellStartReplace={vi.fn()}
            onCellSave={vi.fn()}
            columnColors={{}}
            onCellCancel={vi.fn()}
          />
        )}
      </TestWrapper>,
    );

    const rowEl = screen.getByRole('row');
    expect(rowEl.style.backgroundColor).toBe('rgb(248, 250, 252)'); // #F8FAFC
  });
});
