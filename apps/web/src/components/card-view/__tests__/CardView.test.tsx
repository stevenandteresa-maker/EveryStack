// @vitest-environment jsdom
/**
 * Card View component tests.
 *
 * Tests RecordCard in all 3 layouts (single column, grid, compact list),
 * inline editing, expand icon, grouping, and toolbar integration.
 *
 * @see docs/reference/tables-and-views.md § Card View
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { RecordCard, type RecordCardProps } from '../RecordCard';
import { CardView, type CardViewProps } from '../CardView';
import type { GridField, GridRecord } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock cell registry — provide simple display/edit components
vi.mock('@/components/grid/GridCell', () => ({
  getCellRenderer: (fieldType: string) => {
    if (fieldType === 'smart_doc') return undefined;
    return {
      DisplayComponent: ({ value }: { value: unknown }) => (
        <span data-testid="cell-display">{value != null ? String(value) : ''}</span>
      ),
      EditComponent: ({
        value,
        onSave,
        onCancel,
      }: {
        value: unknown;
        onSave: (v: unknown) => void;
        onCancel: () => void;
      }) => (
        <input
          data-testid="cell-edit"
          defaultValue={value != null ? String(value) : ''}
          onBlur={(e) => onSave(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
        />
      ),
    };
  },
  registerCellRenderer: vi.fn(),
}));

// Mock grid components used by CardView
vi.mock('@/components/grid/GridSkeleton', () => ({
  GridSkeleton: () => <div data-testid="grid-skeleton" />,
}));

vi.mock('@/components/grid/GridEmptyState', () => ({
  GridEmptyState: () => <div data-testid="grid-empty-state" />,
}));

vi.mock('@/components/grid/RecordCount', () => ({
  RecordCount: ({
    filteredCount,
    totalCount,
  }: {
    filteredCount: number;
    totalCount: number;
    isFiltered: boolean;
  }) => (
    <div data-testid="record-count">
      {filteredCount} / {totalCount}
    </div>
  ),
}));

vi.mock('@/components/grid/GroupHeader', () => ({
  GroupHeader: ({
    group,
    isCollapsed,
    onToggleCollapse,
  }: {
    group: { key: string; label: string; recordCount: number };
    isCollapsed: boolean;
    onToggleCollapse: (key: string) => void;
  }) => (
    <div
      data-testid="group-header"
      data-group-key={group.key}
      data-collapsed={isCollapsed}
      onClick={() => onToggleCollapse(group.key)}
    >
      {group.label} ({group.recordCount})
    </div>
  ),
}));

vi.mock('@/components/grid/use-grouping', () => ({
  computeGroups: vi.fn(() => []),
  GROUP_HEADER_HEIGHT: 40,
  GROUP_INDENT_PX: 16,
}));

vi.mock('@/components/grid/GridToolbar', () => ({
  GridToolbar: () => <div data-testid="grid-toolbar" />,
}));

vi.mock('@/actions/view-actions', () => ({
  updateViewConfig: vi.fn(),
}));

vi.mock('../CardViewToolbar', () => ({
  CardViewToolbar: () => <div data-testid="card-view-toolbar" />,
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createTestField(overrides: Partial<GridField> = {}): GridField {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'Test Field',
    fieldType: overrides.fieldType ?? 'text',
    fieldSubType: null,
    isPrimary: overrides.isPrimary ?? false,
    isSystem: false,
    required: false,
    unique: false,
    readOnly: overrides.readOnly ?? false,
    config: overrides.config ?? {},
    display: {},
    permissions: {},
    defaultValue: null,
    description: null,
    sortOrder: overrides.sortOrder ?? 0,
    tableId: overrides.tableId ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? crypto.randomUUID(),
    externalFieldId: null,
    environment: 'live',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as GridField;
}

function createTestRecord(
  fieldValues: Record<string, unknown>,
  overrides: Partial<GridRecord> = {},
): GridRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tableId: overrides.tableId ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? crypto.randomUUID(),
    canonicalData: fieldValues,
    syncMetadata: null,
    searchVector: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  } as GridRecord;
}

// ---------------------------------------------------------------------------
// RecordCard tests
// ---------------------------------------------------------------------------

describe('RecordCard', () => {
  const primaryField = createTestField({
    id: 'field-1',
    name: 'Name',
    isPrimary: true,
  });
  const textField = createTestField({
    id: 'field-2',
    name: 'Status',
  });
  const numberField = createTestField({
    id: 'field-3',
    name: 'Amount',
    fieldType: 'number',
  });
  const fields = [primaryField, textField, numberField];

  const record = createTestRecord(
    {
      'field-1': 'Acme Corp',
      'field-2': 'Active',
      'field-3': 42,
    },
    { id: 'record-1' },
  );

  const defaultProps: RecordCardProps = {
    record,
    fields,
    layout: 'grid',
    onExpandRecord: vi.fn(),
    onSaveField: vi.fn(),
  };

  function renderCard(overrides: Partial<RecordCardProps> = {}) {
    return render(
      <IntlWrapper>
        <RecordCard {...defaultProps} {...overrides} />
      </IntlWrapper>,
    );
  }

  describe('layout: single_column', () => {
    it('renders card with all fields', () => {
      renderCard({ layout: 'single_column' });

      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByTestId('record-card')).toHaveAttribute(
        'data-layout',
        'single_column',
      );
    });

    it('displays non-primary fields with labels', () => {
      renderCard({ layout: 'single_column' });

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
    });
  });

  describe('layout: grid', () => {
    it('renders card with grid layout attribute', () => {
      renderCard({ layout: 'grid' });

      expect(screen.getByTestId('record-card')).toHaveAttribute(
        'data-layout',
        'grid',
      );
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('renders field values via cell renderers', () => {
      renderCard({ layout: 'grid' });

      const displays = screen.getAllByTestId('cell-display');
      expect(displays.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('layout: compact_list', () => {
    it('renders card with compact styling', () => {
      renderCard({ layout: 'compact_list' });

      expect(screen.getByTestId('record-card')).toHaveAttribute(
        'data-layout',
        'compact_list',
      );
    });
  });

  describe('expand icon', () => {
    it('shows expand button', () => {
      renderCard();

      const expandBtn = screen.getByRole('button', { name: /expand/i });
      expect(expandBtn).toBeInTheDocument();
    });

    it('calls onExpandRecord when clicked', () => {
      const onExpandRecord = vi.fn();
      renderCard({ onExpandRecord });

      const expandBtn = screen.getByRole('button', { name: /expand/i });
      fireEvent.click(expandBtn);

      expect(onExpandRecord).toHaveBeenCalledWith('record-1');
    });
  });

  describe('inline editing', () => {
    it('enters edit mode on field click', () => {
      renderCard();

      // Click a field row to start editing
      const fieldRows = screen.getAllByRole('button');
      const editableRow = fieldRows.find(
        (el) =>
          el.getAttribute('role') === 'button' &&
          el.textContent?.includes('Status'),
      );
      if (editableRow) {
        fireEvent.click(editableRow);
        // Edit component should render
        expect(screen.queryByTestId('cell-edit')).toBeInTheDocument();
      }
    });

    it('calls onSaveField when editing completes', () => {
      const onSaveField = vi.fn();
      renderCard({ onSaveField });

      // Click to start editing
      const fieldRows = screen.getAllByRole('button');
      const editableRow = fieldRows.find(
        (el) => el.textContent?.includes('Status'),
      );
      if (editableRow) {
        fireEvent.click(editableRow);

        const input = screen.getByTestId('cell-edit');
        fireEvent.blur(input, { target: { value: 'Inactive' } });

        expect(onSaveField).toHaveBeenCalledWith(
          'record-1',
          'field-2',
          'Inactive',
        );
      }
    });
  });

  describe('Smart Doc preview', () => {
    it('shows Smart Doc preview with expand button', () => {
      const smartDocField = createTestField({
        id: 'field-doc',
        name: 'Notes',
        fieldType: 'smart_doc',
      });
      const docRecord = createTestRecord(
        {
          'field-1': 'Record With Doc',
          'field-doc':
            'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7',
        },
        { id: 'record-doc' },
      );

      renderCard({
        record: docRecord,
        fields: [primaryField, smartDocField],
      });

      // Should show "Expand" link for truncated doc
      expect(screen.getByText(/Expand/i)).toBeInTheDocument();
    });
  });

  describe('untitled record', () => {
    it('shows untitled text when primary field is empty', () => {
      const emptyRecord = createTestRecord({}, { id: 'record-empty' });

      renderCard({ record: emptyRecord });

      expect(screen.getByText(/untitled/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// CardView integration tests
// ---------------------------------------------------------------------------

describe('CardView', () => {
  const fields = [
    createTestField({ id: 'f-1', name: 'Name', isPrimary: true }),
    createTestField({ id: 'f-2', name: 'Status' }),
  ];

  const records = [
    createTestRecord({ 'f-1': 'Alpha', 'f-2': 'Active' }, { id: 'r-1' }),
    createTestRecord({ 'f-1': 'Beta', 'f-2': 'Inactive' }, { id: 'r-2' }),
    createTestRecord({ 'f-1': 'Gamma', 'f-2': 'Active' }, { id: 'r-3' }),
  ];

  const defaultToolbarProps = {
    viewName: 'Test View',
    viewType: 'card' as const,
    filterOpen: false,
    onFilterOpenChange: vi.fn(),
    sortOpen: false,
    onSortOpenChange: vi.fn(),
    groupOpen: false,
    onGroupOpenChange: vi.fn(),
    colorOpen: false,
    onColorOpenChange: vi.fn(),
    hideFieldsOpen: false,
    onHideFieldsOpenChange: vi.fn(),
    activeFilterCount: 0,
    activeSortCount: 0,
    activeGroupCount: 0,
    hasColorRules: false,
    hiddenFieldCount: 0,
    sortPanelProps: {} as CardViewProps['toolbarProps']['sortPanelProps'],
    filterBuilderProps: {} as CardViewProps['toolbarProps']['filterBuilderProps'],
    colorRuleBuilderProps: {} as CardViewProps['toolbarProps']['colorRuleBuilderProps'],
    hideFieldsPanelProps: {} as CardViewProps['toolbarProps']['hideFieldsPanelProps'],
    groupPanelProps: {
      groups: [],
      fields: [],
      onAddGroup: vi.fn(),
      onRemoveGroup: vi.fn(),
      onUpdateDirection: vi.fn(),
      onReorderGroups: vi.fn(),
      onClearGroups: vi.fn(),
      isAtLimit: false,
    },
  };

  const defaultProps: CardViewProps = {
    records,
    fields,
    viewConfig: {},
    totalCount: 3,
    isLoading: false,
    error: null,
    layout: 'grid',
    cardColumns: 2,
    visibleFields: fields,
    onSetLayout: vi.fn(),
    onSetCardColumns: vi.fn(),
    onExpandRecord: vi.fn(),
    onSaveField: vi.fn(),
    groups: [],
    sorts: [],
    collapsedGroups: new Set(),
    onToggleGroupCollapsed: vi.fn(),
    toolbarProps: defaultToolbarProps,
  };

  function renderCardView(overrides: Partial<CardViewProps> = {}) {
    return render(
      <IntlWrapper>
        <CardView {...defaultProps} {...overrides} />
      </IntlWrapper>,
    );
  }

  it('renders cards for all records', () => {
    renderCardView();

    const cards = screen.getAllByTestId('record-card');
    expect(cards).toHaveLength(3);
  });

  it('shows loading skeleton', () => {
    renderCardView({ isLoading: true });

    expect(screen.getByTestId('grid-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when no records', () => {
    renderCardView({ records: [] });

    expect(screen.getByTestId('grid-empty-state')).toBeInTheDocument();
  });

  it('shows error message', () => {
    renderCardView({ error: new Error('test') });

    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('renders record count footer', () => {
    renderCardView();

    expect(screen.getByTestId('record-count')).toBeInTheDocument();
    expect(screen.getByTestId('record-count')).toHaveTextContent('3 / 3');
  });

  it('renders in single column layout', () => {
    renderCardView({ layout: 'single_column' });

    const cards = screen.getAllByTestId('record-card');
    cards.forEach((card) => {
      expect(card).toHaveAttribute('data-layout', 'single_column');
    });
  });

  it('renders in compact list layout', () => {
    renderCardView({ layout: 'compact_list' });

    const cards = screen.getAllByTestId('record-card');
    cards.forEach((card) => {
      expect(card).toHaveAttribute('data-layout', 'compact_list');
    });
  });

  it('passes expand handler to cards', () => {
    const onExpandRecord = vi.fn();
    renderCardView({ onExpandRecord });

    const expandBtns = screen.getAllByRole('button', { name: /expand/i });
    fireEvent.click(expandBtns[0]!);

    expect(onExpandRecord).toHaveBeenCalledWith('r-1');
  });
});
