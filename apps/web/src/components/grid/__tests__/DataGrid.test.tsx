// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { DataGrid } from '../DataGrid';
import type { GridRecord, GridField, ViewConfig } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Test data factories
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

function makeRecord(overrides: Partial<GridRecord> = {}): GridRecord {
  return {
    tenantId: 'tenant-1',
    id: 'record-1',
    tableId: 'table-1',
    canonicalData: { 'field-1': 'Test value', 'field-2': 42 },
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

const defaultFields: GridField[] = [
  makeField({ id: 'field-1', name: 'Name', fieldType: 'text', isPrimary: true, sortOrder: 0 }),
  makeField({ id: 'field-2', name: 'Amount', fieldType: 'number', isPrimary: false, sortOrder: 1 }),
];

const defaultRecords: GridRecord[] = [
  makeRecord({ id: 'rec-1', canonicalData: { 'field-1': 'Alice', 'field-2': 100 } }),
  makeRecord({ id: 'rec-2', canonicalData: { 'field-1': 'Bob', 'field-2': 200 } }),
  makeRecord({ id: 'rec-3', canonicalData: { 'field-1': 'Charlie', 'field-2': 300 } }),
];

const defaultViewConfig: ViewConfig = {};

const defaultProps = {
  records: defaultRecords,
  fields: defaultFields,
  viewConfig: defaultViewConfig,
  totalCount: 3,
  isLoading: false,
  error: null,
  userRole: 'manager' as const,
  activeCell: null,
  editingCell: null,
  density: 'medium' as const,
  frozenColumnCount: 0,
  columnWidths: {},
  columnOrder: [],
  onCellClick: vi.fn(),
  onCellDoubleClick: vi.fn(),
  onCellStartReplace: vi.fn(),
  onCellSave: vi.fn(),
  onCellCancel: vi.fn(),
  onSelectColumn: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataGrid', () => {
  it('renders with TanStack Table column model from fields', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} />
      </IntlWrapper>,
    );

    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  it('renders grid container with correct aria attributes', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} />
      </IntlWrapper>,
    );

    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-rowcount', '3');
    expect(grid).toHaveAttribute('aria-colcount', '2');
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} isLoading={true} records={[]} />
      </IntlWrapper>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('renders error state', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} error={new Error('fail')} records={[]} />
      </IntlWrapper>,
    );

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('renders empty state when no records', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} records={[]} totalCount={0} />
      </IntlWrapper>,
    );

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('shows "+" column when user role is Manager+', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} userRole="manager" />
      </IntlWrapper>,
    );

    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('hides "+" column when user role is below Manager', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} userRole="team_member" />
      </IntlWrapper>,
    );

    expect(screen.queryByText('+')).not.toBeInTheDocument();
  });

  it('renders header checkbox', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} />
      </IntlWrapper>,
    );

    // At minimum the header checkbox should render
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders header with column names', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} />
      </IntlWrapper>,
    );

    // Header row should always render (it's not virtualized)
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  it('renders header row with columnheader roles', () => {
    render(
      <IntlWrapper>
        <DataGrid {...defaultProps} />
      </IntlWrapper>,
    );

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders.length).toBe(2); // Name + Amount
  });
});
