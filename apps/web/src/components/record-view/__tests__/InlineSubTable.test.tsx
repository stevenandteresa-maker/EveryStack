// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { InlineSubTable } from '../InlineSubTable';
import type { InlineSubTableConfig } from '../use-inline-sub-table';
import type { DbRecord, Field } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------

vi.mock('@/lib/hooks/use-media-query', () => ({
  useMediaQuery: vi.fn(() => false), // Default: desktop
}));

// Mock cell registry so renderers resolve
vi.mock('@/components/grid/GridCell', () => ({
  getCellRenderer: (fieldType: string) => {
    if (fieldType === 'text' || fieldType === 'number') {
      return {
        DisplayComponent: ({ value }: { value: unknown }) => (
          <span data-testid="cell-display">{value != null ? String(value) : ''}</span>
        ),
        EditComponent: ({ value, onSave }: { value: unknown; onSave: (v: unknown) => void }) => (
          <input
            data-testid="cell-edit"
            defaultValue={value != null ? String(value) : ''}
            onBlur={(e) => onSave(e.target.value)}
          />
        ),
      };
    }
    return undefined;
  },
  registerCellRenderer: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockConfig: InlineSubTableConfig = {
  style: 'inline_table',
  inline_columns: ['field-desc', 'field-qty'],
  inline_column_widths: { 'field-desc': 240, 'field-qty': 80 },
  allow_inline_create: true,
  allow_inline_delete: true,
  allow_reorder: false,
  max_visible_rows: 10,
  empty_state_text: '',
};

const mockTargetFields: Field[] = [
  {
    id: 'field-desc',
    tenantId: 'tenant-1',
    tableId: 'target-table',
    name: 'Description',
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
  },
  {
    id: 'field-qty',
    tenantId: 'tenant-1',
    tableId: 'target-table',
    name: 'Quantity',
    fieldType: 'number',
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
    sortOrder: 1,
    externalFieldId: null,
    environment: 'live',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function createMockRecord(
  id: string,
  data: Record<string, unknown>,
): DbRecord {
  return {
    tenantId: 'tenant-1',
    id,
    tableId: 'target-table',
    canonicalData: data,
    syncMetadata: null,
    searchVector: null,
    archivedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const mockLinkedRecords: DbRecord[] = [
  createMockRecord('rec-1', {
    'field-desc': 'Frontend dev',
    'field-qty': 20,
  }),
  createMockRecord('rec-2', {
    'field-desc': 'API integration',
    'field-qty': 12,
  }),
  createMockRecord('rec-3', {
    'field-desc': 'QA testing',
    'field-qty': 8,
  }),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSubTable(overrides: Partial<React.ComponentProps<typeof InlineSubTable>> = {}) {
  const defaultProps = {
    fieldName: 'Line Items',
    recordId: 'source-rec-1',
    fieldId: 'link-field-1',
    config: mockConfig,
    linkedRecords: mockLinkedRecords,
    targetFields: mockTargetFields,
    canCreate: true,
    canDelete: true,
  };

  return render(
    <IntlWrapper>
      <InlineSubTable {...defaultProps} {...overrides} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InlineSubTable', () => {
  it('renders field name and item count', () => {
    renderSubTable();

    expect(screen.getByText('Line Items')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  it('renders column headers from config', () => {
    renderSubTable();

    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
  });

  it('renders linked record rows', () => {
    renderSubTable();

    // Each record should render cells
    const displays = screen.getAllByTestId('cell-display');
    expect(displays.length).toBeGreaterThanOrEqual(6); // 3 records × 2 columns
  });

  it('renders search bar', () => {
    renderSubTable();

    const searchInput = screen.getByPlaceholderText(/search linked records/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('renders add row button when canCreate is true', () => {
    renderSubTable({ canCreate: true });

    expect(screen.getByText(/add row/i)).toBeInTheDocument();
  });

  it('hides add row button when canCreate is false', () => {
    renderSubTable({ canCreate: false });

    expect(screen.queryByText(/add row/i)).not.toBeInTheDocument();
  });

  it('hides add row button when readOnly', () => {
    renderSubTable({ readOnly: true });

    expect(screen.queryByText(/add row/i)).not.toBeInTheDocument();
  });

  it('renders delete buttons on hover for each row', () => {
    renderSubTable();

    const deleteButtons = screen.getAllByLabelText(/remove linked record/i);
    expect(deleteButtons).toHaveLength(3);
  });

  it('hides delete buttons when canDelete is false', () => {
    renderSubTable({ canDelete: false });

    expect(screen.queryByLabelText(/remove linked record/i)).not.toBeInTheDocument();
  });

  it('renders empty state when no linked records', () => {
    renderSubTable({ linkedRecords: [] });

    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
  });

  it('renders custom empty state text from config', () => {
    renderSubTable({
      linkedRecords: [],
      config: { ...mockConfig, empty_state_text: 'No line items added' },
    });

    expect(screen.getByText('No line items added')).toBeInTheDocument();
  });

  it('calls onDeleteLink when delete button clicked', () => {
    const onDeleteLink = vi.fn();
    renderSubTable({ onDeleteLink });

    const deleteButtons = screen.getAllByLabelText(/remove linked record/i);
    fireEvent.click(deleteButtons[0]!);

    expect(onDeleteLink).toHaveBeenCalledWith('rec-1');
  });

  it('shows expand/collapse when records exceed max_visible_rows', () => {
    // Create more records than max_visible_rows
    const manyRecords = Array.from({ length: 15 }, (_, i) =>
      createMockRecord(`rec-${i}`, {
        'field-desc': `Item ${i}`,
        'field-qty': i,
      }),
    );

    renderSubTable({
      linkedRecords: manyRecords,
      config: { ...mockConfig, max_visible_rows: 10 },
    });

    expect(screen.getByText(/show 5 more/i)).toBeInTheDocument();
  });

  it('does not show expand when records are within max_visible_rows', () => {
    renderSubTable({ config: { ...mockConfig, max_visible_rows: 10 } });

    expect(screen.queryByText(/show.*more/i)).not.toBeInTheDocument();
  });

  it('filters rows by search query', () => {
    renderSubTable();

    const searchInput = screen.getByPlaceholderText(/search linked records/i);
    fireEvent.change(searchInput, { target: { value: 'Frontend' } });

    // Only one record should match
    const displays = screen.getAllByTestId('cell-display');
    // 1 record × 2 columns = 2 cells
    expect(displays.length).toBe(2);
  });

  it('respects allow_inline_create=false', () => {
    renderSubTable({
      config: { ...mockConfig, allow_inline_create: false },
    });

    expect(screen.queryByText(/add row/i)).not.toBeInTheDocument();
  });

  it('respects allow_inline_delete=false', () => {
    renderSubTable({
      config: { ...mockConfig, allow_inline_delete: false },
    });

    expect(screen.queryByLabelText(/remove linked record/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Mobile rendering
// ---------------------------------------------------------------------------

describe('InlineSubTable — mobile', () => {
  it('renders compact summary on mobile', async () => {
    const { useMediaQuery } = await import('@/lib/hooks/use-media-query');
    vi.mocked(useMediaQuery).mockReturnValue(true);

    renderSubTable();

    expect(screen.getByText('Line Items')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
    expect(screen.getByText(/view all/i)).toBeInTheDocument();
  });

  it('shows add button on mobile when canCreate', async () => {
    const { useMediaQuery } = await import('@/lib/hooks/use-media-query');
    vi.mocked(useMediaQuery).mockReturnValue(true);

    renderSubTable({ canCreate: true });

    expect(screen.getByText(/^add$/i)).toBeInTheDocument();
  });

  it('hides add button on mobile when canCreate is false', async () => {
    const { useMediaQuery } = await import('@/lib/hooks/use-media-query');
    vi.mocked(useMediaQuery).mockReturnValue(true);

    renderSubTable({ canCreate: false });

    expect(screen.queryByText(/^add$/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// useInlineSubTable hook
// ---------------------------------------------------------------------------

describe('useInlineSubTable', () => {
  // Hook is tested indirectly via component tests above.

  it('starts creation flow on add row click', async () => {
    // Reset to desktop mode
    const { useMediaQuery } = await import('@/lib/hooks/use-media-query');
    vi.mocked(useMediaQuery).mockReturnValue(false);

    const onCreateRecord = vi.fn();
    renderSubTable({ onCreateRecord });

    const addButton = screen.getByText(/add row/i);
    fireEvent.click(addButton);

    // Creation row should appear (dashed border row)
    const rows = screen.getAllByRole('row');
    // Header row + 3 data rows + 1 creation row
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });
});
