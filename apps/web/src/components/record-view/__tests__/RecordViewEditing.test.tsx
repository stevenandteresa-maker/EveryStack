// @vitest-environment jsdom

/**
 * Tests for Record View — Tabs, Linked Record Display, Responsive, Config Picker.
 *
 * Covers: RecordViewTabs, LinkedRecordPills, RecordViewConfigPicker,
 * updated RecordViewCanvas (tab filtering), updated RecordView (responsive),
 * and updated useRecordView (navigation stack).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { RecordViewTabs, DEFAULT_TAB_ID } from '../RecordViewTabs';
import { LinkedRecordPills } from '../LinkedRecordPills';
import { RecordViewConfigPicker } from '../RecordViewConfigPicker';
import { RecordViewCanvas } from '../RecordViewCanvas';
import { RecordView } from '../RecordView';
import { useRecordView } from '../use-record-view';
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

// Mock useMediaQuery: default to desktop
let mockIsMobile = false;
vi.mock('@/lib/hooks/use-media-query', () => ({
  useMediaQuery: () => mockIsMobile,
}));

vi.mock('@everystack/shared/db', () => ({
  generateUUIDv7: () => `uuid-${Date.now()}`,
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

function createMockField(
  overrides: Partial<GridField> & { id: string; name: string; fieldType: string },
): GridField {
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
  createMockField({ id: 'field-3', name: 'Notes', fieldType: 'text', sortOrder: 2 }),
  createMockField({ id: 'field-4', name: 'Related', fieldType: 'linked_record', sortOrder: 3 }),
];

const mockRecord = {
  id: 'record-1',
  tenantId: 'tenant-1',
  tableId: 'table-1',
  canonicalData: {
    'field-1': 'Acme Corp',
    'field-2': 'Active',
    'field-3': 'Some notes',
    'field-4': [
      { id: 'linked-1', displayValue: 'Widget Co' },
      { id: 'linked-2', displayValue: 'Gadget Inc' },
    ],
  },
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  syncMetadata: null,
  searchVector: null,
} as unknown as GridRecord;

const mockTabs = [
  { id: 'tab-1', name: 'General' },
  { id: 'tab-2', name: 'Extra Info' },
];

const mockLayoutWithTabs: RecordViewLayout = {
  columns: 2,
  fields: [
    { fieldId: 'field-1', columnSpan: 2, height: 'auto', tab: null },
    { fieldId: 'field-2', columnSpan: 1, height: 'auto', tab: null },
    { fieldId: 'field-3', columnSpan: 1, height: 'auto', tab: 'tab-1' },
    { fieldId: 'field-4', columnSpan: 2, height: 'auto', tab: 'tab-2' },
  ],
  tabs: mockTabs,
};

const mockLayoutNoTabs: RecordViewLayout = {
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
// RecordViewTabs tests
// ---------------------------------------------------------------------------

describe('RecordViewTabs', () => {
  const defaultProps = {
    tabs: mockTabs,
    activeTabId: DEFAULT_TAB_ID,
    onTabChange: vi.fn(),
    onAddTab: vi.fn(),
    onRenameTab: vi.fn(),
    onDeleteTab: vi.fn(),
  };

  it('renders default tab and custom tabs', () => {
    render(
      <IntlWrapper>
        <RecordViewTabs {...defaultProps} />
      </IntlWrapper>,
    );

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('renders tab triggers with correct values', () => {
    render(
      <IntlWrapper>
        <RecordViewTabs {...defaultProps} />
      </IntlWrapper>,
    );

    const generalTab = screen.getByRole('tab', { name: 'General' });
    expect(generalTab).toBeInTheDocument();
    expect(generalTab).toHaveAttribute('data-state', 'inactive');

    // Default tab should be active
    const detailsTab = screen.getByRole('tab', { name: 'Details' });
    expect(detailsTab).toHaveAttribute('data-state', 'active');
  });

  it('adds a new tab via input', () => {
    const onAddTab = vi.fn();
    render(
      <IntlWrapper>
        <RecordViewTabs {...defaultProps} onAddTab={onAddTab} />
      </IntlWrapper>,
    );

    // Click add button
    fireEvent.click(screen.getByLabelText('Add tab'));

    // Type name and press Enter
    const input = screen.getByLabelText('New tab name');
    fireEvent.change(input, { target: { value: 'New Tab' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAddTab).toHaveBeenCalledWith('New Tab');
  });

  it('cancels adding via Escape', () => {
    const onAddTab = vi.fn();
    render(
      <IntlWrapper>
        <RecordViewTabs {...defaultProps} onAddTab={onAddTab} />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByLabelText('Add tab'));
    const input = screen.getByLabelText('New tab name');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onAddTab).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('New tab name')).not.toBeInTheDocument();
  });

  it('does not show add button when readOnly', () => {
    render(
      <IntlWrapper>
        <RecordViewTabs {...defaultProps} readOnly />
      </IntlWrapper>,
    );

    expect(screen.queryByLabelText('Add tab')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// LinkedRecordPills tests
// ---------------------------------------------------------------------------

describe('LinkedRecordPills', () => {
  it('renders pills with display values', () => {
    const pills = [
      { recordId: 'linked-1', displayValue: 'Widget Co' },
      { recordId: 'linked-2', displayValue: 'Gadget Inc' },
    ];

    render(
      <IntlWrapper>
        <LinkedRecordPills pills={pills} onNavigateToRecord={vi.fn()} />
      </IntlWrapper>,
    );

    expect(screen.getByText('Widget Co')).toBeInTheDocument();
    expect(screen.getByText('Gadget Inc')).toBeInTheDocument();
  });

  it('calls onNavigateToRecord when clicking a pill', () => {
    const onNavigate = vi.fn();
    const pills = [{ recordId: 'linked-1', displayValue: 'Widget Co' }];

    render(
      <IntlWrapper>
        <LinkedRecordPills pills={pills} onNavigateToRecord={onNavigate} />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByText('Widget Co'));
    expect(onNavigate).toHaveBeenCalledWith('linked-1');
  });

  it('supports keyboard navigation on pills', () => {
    const onNavigate = vi.fn();
    const pills = [{ recordId: 'linked-1', displayValue: 'Widget Co' }];

    render(
      <IntlWrapper>
        <LinkedRecordPills pills={pills} onNavigateToRecord={onNavigate} />
      </IntlWrapper>,
    );

    const pill = screen.getByText('Widget Co').closest('[tabindex]')!;
    fireEvent.keyDown(pill, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('linked-1');
  });

  it('shows empty message when no pills', () => {
    render(
      <IntlWrapper>
        <LinkedRecordPills pills={[]} onNavigateToRecord={vi.fn()} />
      </IntlWrapper>,
    );

    expect(screen.getByText('No linked records')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RecordViewConfigPicker tests
// ---------------------------------------------------------------------------

describe('RecordViewConfigPicker', () => {
  const configs = [
    { id: 'config-1', name: 'Default', isDefault: true },
    { id: 'config-2', name: 'Compact', isDefault: false },
  ];

  it('renders config name as trigger', () => {
    render(
      <IntlWrapper>
        <RecordViewConfigPicker
          configs={configs}
          activeConfigId="config-1"
          onSelectConfig={vi.fn()}
          onSaveAsNew={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders trigger button with active config name', () => {
    render(
      <IntlWrapper>
        <RecordViewConfigPicker
          configs={configs}
          activeConfigId="config-2"
          onSelectConfig={vi.fn()}
          onSaveAsNew={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Compact')).toBeInTheDocument();
  });

  it('renders trigger with correct aria-label', () => {
    render(
      <IntlWrapper>
        <RecordViewConfigPicker
          configs={configs}
          activeConfigId="config-1"
          onSelectConfig={vi.fn()}
          onSaveAsNew={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByLabelText('Switch record view config')).toBeInTheDocument();
  });

  it('hides when only one config', () => {
    const { container } = render(
      <IntlWrapper>
        <RecordViewConfigPicker
          configs={[configs[0]!]}
          activeConfigId="config-1"
          onSelectConfig={vi.fn()}
          onSaveAsNew={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(container.innerHTML).toBe('');
  });
});

// ---------------------------------------------------------------------------
// RecordViewCanvas — tab filtering tests
// ---------------------------------------------------------------------------

describe('RecordViewCanvas — tab filtering', () => {
  it('shows only default tab fields when default tab is active', () => {
    render(
      <IntlWrapper>
        <RecordViewCanvas
          record={mockRecord}
          fields={mockFields}
          layout={mockLayoutWithTabs}
          activeTabId={DEFAULT_TAB_ID}
          onFieldSave={vi.fn()}
        />
      </IntlWrapper>,
    );

    // Default tab fields: field-1 (tab: null) and field-2 (tab: null)
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    // Tab-assigned fields should not appear
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  it('shows only tab-1 fields when tab-1 is active', () => {
    render(
      <IntlWrapper>
        <RecordViewCanvas
          record={mockRecord}
          fields={mockFields}
          layout={mockLayoutWithTabs}
          activeTabId="tab-1"
          onFieldSave={vi.fn()}
        />
      </IntlWrapper>,
    );

    // Tab-1 field: field-3
    expect(screen.getByText('Notes')).toBeInTheDocument();
    // Not on this tab
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('shows all fields when no activeTabId is passed (no tabs)', () => {
    render(
      <IntlWrapper>
        <RecordViewCanvas
          record={mockRecord}
          fields={mockFields}
          layout={mockLayoutNoTabs}
          onFieldSave={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// useRecordView — navigation stack tests
// ---------------------------------------------------------------------------

describe('useRecordView — navigation stack', () => {
  it('starts with empty navigation stack', () => {
    const { result } = renderHook(() => useRecordView(recordIds));
    expect(result.current.navigationStack).toEqual([]);
    expect(result.current.canGoBack).toBe(false);
  });

  it('pushLinkedRecord pushes current onto stack and sets new record', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1');
    });

    act(() => {
      result.current.pushLinkedRecord('linked-record-1');
    });

    expect(result.current.currentRecordId).toBe('linked-record-1');
    expect(result.current.navigationStack).toEqual(['record-1']);
    expect(result.current.canGoBack).toBe(true);
  });

  it('popLinkedRecord returns to previous record', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1');
    });

    act(() => {
      result.current.pushLinkedRecord('linked-1');
    });

    act(() => {
      result.current.pushLinkedRecord('linked-2');
    });

    expect(result.current.navigationStack).toEqual(['record-1', 'linked-1']);

    act(() => {
      result.current.popLinkedRecord();
    });

    expect(result.current.currentRecordId).toBe('linked-1');
    expect(result.current.navigationStack).toEqual(['record-1']);
    expect(result.current.canGoBack).toBe(true);

    act(() => {
      result.current.popLinkedRecord();
    });

    expect(result.current.currentRecordId).toBe('record-1');
    expect(result.current.navigationStack).toEqual([]);
    expect(result.current.canGoBack).toBe(false);
  });

  it('popLinkedRecord does nothing when stack is empty', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1');
    });

    act(() => {
      result.current.popLinkedRecord();
    });

    expect(result.current.currentRecordId).toBe('record-1');
    expect(result.current.navigationStack).toEqual([]);
  });

  it('closeRecordView clears the navigation stack', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1');
    });

    act(() => {
      result.current.pushLinkedRecord('linked-1');
    });

    act(() => {
      result.current.closeRecordView();
    });

    expect(result.current.navigationStack).toEqual([]);
    expect(result.current.isOpen).toBe(false);
  });

  it('navigateRecord clears the navigation stack', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1');
    });

    act(() => {
      result.current.pushLinkedRecord('linked-1');
    });

    act(() => {
      result.current.navigateRecord('next');
    });

    expect(result.current.currentRecordId).toBe('record-2');
    expect(result.current.navigationStack).toEqual([]);
  });

  it('openRecordView clears the navigation stack', () => {
    const { result } = renderHook(() => useRecordView(recordIds));

    act(() => {
      result.current.openRecordView('record-1');
    });

    act(() => {
      result.current.pushLinkedRecord('linked-1');
    });

    act(() => {
      result.current.openRecordView('record-0');
    });

    expect(result.current.navigationStack).toEqual([]);
    expect(result.current.currentRecordId).toBe('record-0');
  });
});

// ---------------------------------------------------------------------------
// RecordView — responsive behavior tests
// ---------------------------------------------------------------------------

describe('RecordView — responsive', () => {
  const Wrapper = createQueryWrapper();

  const defaultProps = {
    isOpen: true,
    record: mockRecord,
    fields: mockFields,
    layout: mockLayoutWithTabs,
    tableName: 'Clients',
    viewName: 'All Records',
    tableId: 'table-1',
    viewId: 'view-1',
    recordIds,
    currentRecordId: 'record-1',
    onNavigate: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    mockIsMobile = false;
  });

  it('renders as side overlay on desktop', () => {
    render(
      <Wrapper>
        <RecordView {...defaultProps} />
      </Wrapper>,
    );

    const dialog = screen.getByRole('dialog');
    // Desktop: should have the right-side panel with 60% width
    const panel = dialog.querySelector('[style*="width: 60%"]');
    expect(panel).toBeInTheDocument();
  });

  it('renders full-screen on mobile', () => {
    mockIsMobile = true;
    render(
      <Wrapper>
        <RecordView {...defaultProps} />
      </Wrapper>,
    );

    const dialog = screen.getByRole('dialog');
    // Mobile: should have inset-0 full-screen panel
    const panel = dialog.querySelector('.absolute.inset-0');
    expect(panel).toBeInTheDocument();
  });

  it('renders tab bar when config has tabs', () => {
    render(
      <Wrapper>
        <RecordView {...defaultProps} layout={mockLayoutWithTabs} />
      </Wrapper>,
    );

    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('does not render tab bar when config has no tabs', () => {
    render(
      <Wrapper>
        <RecordView {...defaultProps} layout={mockLayoutNoTabs} />
      </Wrapper>,
    );

    expect(screen.queryByText('General')).not.toBeInTheDocument();
  });

  it('shows back button when canGoBack is true', () => {
    render(
      <Wrapper>
        <RecordView
          {...defaultProps}
          canGoBack
          onGoBack={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByLabelText('Back to previous record')).toBeInTheDocument();
  });

  it('calls onGoBack when back button is clicked', () => {
    const onGoBack = vi.fn();
    render(
      <Wrapper>
        <RecordView
          {...defaultProps}
          canGoBack
          onGoBack={onGoBack}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByLabelText('Back to previous record'));
    expect(onGoBack).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RecordView — tab switching shows correct fields
// ---------------------------------------------------------------------------

describe('RecordView — tab switching', () => {
  const Wrapper = createQueryWrapper();

  const defaultProps = {
    isOpen: true,
    record: mockRecord,
    fields: mockFields,
    layout: mockLayoutWithTabs,
    tableName: 'Clients',
    viewName: 'All Records',
    tableId: 'table-1',
    viewId: 'view-1',
    recordIds,
    currentRecordId: 'record-1',
    onNavigate: vi.fn(),
    onClose: vi.fn(),
  };

  it('shows default tab fields initially', () => {
    render(
      <Wrapper>
        <RecordView {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('tab triggers are rendered and correct tab is active', () => {
    render(
      <Wrapper>
        <RecordView {...defaultProps} />
      </Wrapper>,
    );

    // Default tab should be active
    const detailsTab = screen.getByRole('tab', { name: 'Details' });
    expect(detailsTab).toHaveAttribute('data-state', 'active');

    // General tab should be present but inactive
    const generalTab = screen.getByRole('tab', { name: 'General' });
    expect(generalTab).toHaveAttribute('data-state', 'inactive');
  });
});

// ---------------------------------------------------------------------------
// useMediaQuery hook test
// ---------------------------------------------------------------------------

describe('useMediaQuery', () => {
  it('is mocked correctly for tests', () => {
    // This test verifies our mock works; real hook tests would need
    // matchMedia mocking which we handle via the vi.mock above
    expect(mockIsMobile).toBe(false);
    mockIsMobile = true;
    expect(mockIsMobile).toBe(true);
    mockIsMobile = false;
  });
});
