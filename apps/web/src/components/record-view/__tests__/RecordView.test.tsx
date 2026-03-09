// @vitest-environment jsdom

/**
 * Component tests for Record View overlay and sub-components.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordView } from '../RecordView';
import { RecordViewHeader } from '../RecordViewHeader';
import { RecordViewCanvas } from '../RecordViewCanvas';
import { FieldRenderer } from '../FieldRenderer';
import { useRecordView } from '../use-record-view';
import { renderHook } from '@testing-library/react';
import type { GridField, GridRecord } from '@/lib/types/grid';
import type { RecordViewLayout } from '@/data/record-view-configs';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/hooks/use-optimistic-record', () => ({
  useOptimisticRecord: () => ({
    updateCell: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/actions/record-actions', () => ({
  updateRecordField: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <IntlWrapper>{children}</IntlWrapper>
      </QueryClientProvider>
    );
  };
}

function createMockField(overrides: Partial<GridField> & { id: string; name: string; fieldType: string }): GridField {
  return {
    tenantId: 'tenant-1',
    tableId: 'table-1',
    isPrimary: false,
    readOnly: false,
    sortOrder: 0,
    fieldSubType: null,
    isSystem: false,
    required: false,
    unique: false,
    config: {},
    display: {},
    permissions: {},
    defaultValue: null,
    description: null,
    externalFieldId: null,
    environment: 'live',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GridField;
}

const mockFields: GridField[] = [
  createMockField({ id: 'field-1', name: 'Name', fieldType: 'text', isPrimary: true, sortOrder: 0 }),
  createMockField({ id: 'field-2', name: 'Status', fieldType: 'single_select', sortOrder: 1 }),
  createMockField({ id: 'field-3', name: 'Notes', fieldType: 'text', readOnly: true, sortOrder: 2 }),
];

const mockRecord = {
  id: 'record-1',
  tenantId: 'tenant-1',
  tableId: 'table-1',
  canonicalData: {
    'field-1': 'Acme Corp',
    'field-2': 'Active',
    'field-3': 'Some notes',
  },
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  syncMetadata: null,
  searchVector: null,
} as unknown as GridRecord;

const mockLayout: RecordViewLayout = {
  columns: 2,
  fields: [
    { fieldId: 'field-1', columnSpan: 2, height: 'auto', tab: null },
    { fieldId: 'field-2', columnSpan: 1, height: 'auto', tab: null },
    { fieldId: 'field-3', columnSpan: 1, height: 'auto', tab: null },
  ],
  tabs: [],
};

const recordIds = ['record-0', 'record-1', 'record-2'];

// ---------------------------------------------------------------------------
// useRecordView hook tests
// ---------------------------------------------------------------------------

describe('useRecordView', () => {
  it('starts closed with no record', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.currentRecordId).toBeNull();
    expect(result.current.currentConfigId).toBeNull();
  });

  it('opens with a record ID', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1', 'config-1');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.currentRecordId).toBe('record-1');
    expect(result.current.currentConfigId).toBe('config-1');
  });

  it('closes and clears record ID', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1');
    });

    act(() => {
      result.current.closeRecordView();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.currentRecordId).toBeNull();
  });

  it('navigates to next record', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1');
    });

    act(() => {
      result.current.navigateRecord('next');
    });

    expect(result.current.currentRecordId).toBe('record-2');
  });

  it('navigates to previous record', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1');
    });

    act(() => {
      result.current.navigateRecord('prev');
    });

    expect(result.current.currentRecordId).toBe('record-0');
  });

  it('does not navigate past first record', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-0');
    });

    act(() => {
      result.current.navigateRecord('prev');
    });

    expect(result.current.currentRecordId).toBe('record-0');
  });

  it('does not navigate past last record', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-2');
    });

    act(() => {
      result.current.navigateRecord('next');
    });

    expect(result.current.currentRecordId).toBe('record-2');
  });

  it('updates current record via setCurrentRecordId', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-0');
    });

    act(() => {
      result.current.setCurrentRecordId('record-2');
    });

    expect(result.current.currentRecordId).toBe('record-2');
    expect(result.current.isOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RecordViewHeader tests
// ---------------------------------------------------------------------------

describe('RecordViewHeader', () => {
  const defaultHeaderProps = {
    record: mockRecord,
    fields: mockFields,
    tableName: 'Clients',
    viewName: 'All Records',
    hasPrev: true,
    hasNext: true,
    onNavigate: vi.fn(),
    onClose: vi.fn(),
  };

  it('displays record name from primary field', () => {
    render(
      <IntlWrapper>
        <RecordViewHeader {...defaultHeaderProps} />
      </IntlWrapper>,
    );

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('displays table and view breadcrumb', () => {
    render(
      <IntlWrapper>
        <RecordViewHeader {...defaultHeaderProps} />
      </IntlWrapper>,
    );

    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('All Records')).toBeInTheDocument();
  });

  it('calls onNavigate with prev on prev click', () => {
    const onNavigate = vi.fn();
    render(
      <IntlWrapper>
        <RecordViewHeader {...defaultHeaderProps} onNavigate={onNavigate} />
      </IntlWrapper>,
    );

    const prevButton = screen.getByLabelText('Previous record');
    fireEvent.click(prevButton);
    expect(onNavigate).toHaveBeenCalledWith('prev');
  });

  it('calls onNavigate with next on next click', () => {
    const onNavigate = vi.fn();
    render(
      <IntlWrapper>
        <RecordViewHeader {...defaultHeaderProps} onNavigate={onNavigate} />
      </IntlWrapper>,
    );

    const nextButton = screen.getByLabelText('Next record');
    fireEvent.click(nextButton);
    expect(onNavigate).toHaveBeenCalledWith('next');
  });

  it('disables prev when hasPrev is false', () => {
    render(
      <IntlWrapper>
        <RecordViewHeader {...defaultHeaderProps} hasPrev={false} />
      </IntlWrapper>,
    );

    const prevButton = screen.getByLabelText('Previous record');
    expect(prevButton).toBeDisabled();
  });

  it('disables next when hasNext is false', () => {
    render(
      <IntlWrapper>
        <RecordViewHeader {...defaultHeaderProps} hasNext={false} />
      </IntlWrapper>,
    );

    const nextButton = screen.getByLabelText('Next record');
    expect(nextButton).toBeDisabled();
  });

  it('calls onClose on close button click', () => {
    const onClose = vi.fn();
    render(
      <IntlWrapper>
        <RecordViewHeader {...defaultHeaderProps} onClose={onClose} />
      </IntlWrapper>,
    );

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders chat placeholder as disabled', () => {
    render(
      <IntlWrapper>
        <RecordViewHeader {...defaultHeaderProps} />
      </IntlWrapper>,
    );

    const chatButton = screen.getByLabelText('Record thread (coming soon)');
    expect(chatButton).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// RecordViewCanvas tests
// ---------------------------------------------------------------------------

describe('RecordViewCanvas', () => {
  it('renders all layout fields', () => {
    render(
      <IntlWrapper>
        <RecordViewCanvas
          record={mockRecord}
          fields={mockFields}
          layout={mockLayout}
          onFieldSave={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('shows no fields message when layout is empty', () => {
    const emptyLayout: RecordViewLayout = {
      columns: 2,
      fields: [],
      tabs: [],
    };

    render(
      <IntlWrapper>
        <RecordViewCanvas
          record={mockRecord}
          fields={mockFields}
          layout={emptyLayout}
          onFieldSave={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('No fields configured for this view.')).toBeInTheDocument();
  });

  it('skips fields not in the fields list', () => {
    const layoutWithMissing: RecordViewLayout = {
      columns: 2,
      fields: [
        { fieldId: 'field-1', columnSpan: 1, height: 'auto', tab: null },
        { fieldId: 'field-missing', columnSpan: 1, height: 'auto', tab: null },
      ],
      tabs: [],
    };

    render(
      <IntlWrapper>
        <RecordViewCanvas
          record={mockRecord}
          fields={mockFields}
          layout={layoutWithMissing}
          onFieldSave={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FieldRenderer tests
// ---------------------------------------------------------------------------

describe('FieldRenderer', () => {
  it('renders field label and value', () => {
    render(
      <IntlWrapper>
        <FieldRenderer
          field={mockFields[0]!}
          record={mockRecord}
          onSave={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('shows lock icon for read-only fields', () => {
    render(
      <IntlWrapper>
        <FieldRenderer
          field={mockFields[2]!}
          record={mockRecord}
          onSave={vi.fn()}
          readOnly
        />
      </IntlWrapper>,
    );

    expect(screen.getByLabelText('Read-only')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RecordView overlay tests
// ---------------------------------------------------------------------------

describe('RecordView', () => {
  const Wrapper = createQueryWrapper();

  const defaultProps = {
    isOpen: true,
    record: mockRecord,
    fields: mockFields,
    layout: mockLayout,
    tableName: 'Clients',
    viewName: 'All Records',
    tableId: 'table-1',
    viewId: 'view-1',
    recordIds,
    currentRecordId: 'record-1',
    onNavigate: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders overlay when open', () => {
    render(
      <Wrapper>
        <RecordView {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
  });

  it('does not render when closed', () => {
    render(
      <Wrapper>
        <RecordView {...defaultProps} isOpen={false} />
      </Wrapper>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(
      <Wrapper>
        <RecordView {...defaultProps} isLoading />
      </Wrapper>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Should not show record name when loading
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('shows not found when record is null', () => {
    render(
      <Wrapper>
        <RecordView {...defaultProps} record={null} layout={null} />
      </Wrapper>,
    );

    expect(screen.getByText('Record not found.')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Wrapper>
        <RecordView {...defaultProps} onClose={onClose} />
      </Wrapper>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on overlay click', () => {
    const onClose = vi.fn();
    render(
      <Wrapper>
        <RecordView {...defaultProps} onClose={onClose} />
      </Wrapper>,
    );

    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside the panel', () => {
    const onClose = vi.fn();
    render(
      <Wrapper>
        <RecordView {...defaultProps} onClose={onClose} />
      </Wrapper>,
    );

    // Click on the record name inside the panel (use getAllByText since it appears in header and field)
    const elements = screen.getAllByText('Acme Corp');
    fireEvent.click(elements[0]!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
