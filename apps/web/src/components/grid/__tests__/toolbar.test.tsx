/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GridToolbar, type GridToolbarProps } from '../GridToolbar';
import { HideFieldsPanel, type HideFieldsPanelProps } from '../HideFieldsPanel';
import { RecordCount } from '../RecordCount';
import type { GridField, SortLevel } from '@/lib/types/grid';
import { createEmptyFilterConfig } from '../filter-types';
import { createEmptyColorRulesConfig } from '../use-color-rules';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function createField(overrides: Partial<GridField> = {}): GridField {
  return {
    id: crypto.randomUUID(),
    name: 'Test Field',
    fieldType: 'text',
    isPrimary: false,
    readOnly: false,
    sortOrder: 0,
    tableId: crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    platformFieldId: null,
    config: null,
    ...overrides,
  } as GridField;
}

function createSortPanelProps(fields: GridField[]) {
  return {
    sorts: [] as SortLevel[],
    fields,
    onAddSort: vi.fn(),
    onRemoveSort: vi.fn(),
    onUpdateDirection: vi.fn(),
    onUpdateField: vi.fn(),
    onReorderSorts: vi.fn(),
    onClearSorts: vi.fn(),
    isAtLimit: false,
  };
}

function createFilterBuilderProps(fields: GridField[]) {
  return {
    filters: createEmptyFilterConfig(),
    fields,
    activeFilterCount: 0,
    onAddCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    onUpdateCondition: vi.fn(),
    onAddGroup: vi.fn(),
    onAddConditionToGroup: vi.fn(),
    onRemoveGroup: vi.fn(),
    onSetLogic: vi.fn(),
    onSetGroupLogic: vi.fn(),
    onClearFilters: vi.fn(),
  };
}

function createColorRuleBuilderProps(fields: GridField[]) {
  return {
    colorRules: createEmptyColorRulesConfig(),
    fields,
    onAddRowRule: vi.fn(),
    onAddCellRule: vi.fn(),
    onUpdateRule: vi.fn(),
    onRemoveRule: vi.fn(),
    onClearRules: vi.fn(),
  };
}

function createHideFieldsPanelProps(fields: GridField[]): HideFieldsPanelProps {
  return {
    fields,
    hiddenFieldIds: new Set<string>(),
    fieldOrder: fields.map((f) => f.id),
    onToggleField: vi.fn(),
    onShowAll: vi.fn(),
    onHideAll: vi.fn(),
    onReorderFields: vi.fn(),
  };
}

function createGroupPanelProps(fields: GridField[]) {
  return {
    groups: [] as { fieldId: string; direction: 'asc' | 'desc' }[],
    fields,
    onAddGroup: vi.fn(),
    onRemoveGroup: vi.fn(),
    onUpdateDirection: vi.fn(),
    onReorderGroups: vi.fn(),
    onClearGroups: vi.fn(),
    isAtLimit: false,
  };
}

function createToolbarProps(overrides: Partial<GridToolbarProps> = {}): GridToolbarProps {
  const fields = [
    createField({ name: 'Name', isPrimary: true }),
    createField({ name: 'Status' }),
    createField({ name: 'Due Date', fieldType: 'date' }),
  ];

  return {
    viewName: 'Default View',
    viewType: 'grid',
    density: 'medium',
    onSetDensity: vi.fn(),
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
    sortPanelProps: createSortPanelProps(fields),
    filterBuilderProps: createFilterBuilderProps(fields),
    colorRuleBuilderProps: createColorRuleBuilderProps(fields),
    hideFieldsPanelProps: createHideFieldsPanelProps(fields),
    groupPanelProps: createGroupPanelProps(fields),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GridToolbar tests
// ---------------------------------------------------------------------------

function renderToolbar(overrides: Partial<GridToolbarProps> = {}) {
  return render(
    <IntlWrapper>
      <TooltipProvider>
        <GridToolbar {...createToolbarProps(overrides)} />
      </TooltipProvider>
    </IntlWrapper>,
  );
}

describe('GridToolbar', () => {
  it('renders all toolbar buttons', () => {
    renderToolbar();

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();

    // Left group buttons
    expect(screen.getByText('Default View')).toBeInTheDocument();
    expect(screen.getByText('Hide fields')).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByText('Sort')).toBeInTheDocument();
    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();

    // Right group buttons
    expect(screen.getByText('Default')).toBeInTheDocument(); // density medium label
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('shows active filter count badge when filters are active', () => {
    renderToolbar({ activeFilterCount: 3 });

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows active sort count badge when sorts are active', () => {
    renderToolbar({ activeSortCount: 2 });

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows active group count badge when groups are active', () => {
    renderToolbar({ activeGroupCount: 1 });

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('cycles density on density button click', async () => {
    const onSetDensity = vi.fn();
    const user = userEvent.setup();

    renderToolbar({ density: 'medium', onSetDensity });

    // Click the density button (shows "Default" for medium)
    await user.click(screen.getByText('Default'));
    expect(onSetDensity).toHaveBeenCalledWith('tall');
  });

  it('cycles density from tall to compact', async () => {
    const onSetDensity = vi.fn();
    const user = userEvent.setup();

    renderToolbar({ density: 'tall', onSetDensity });

    await user.click(screen.getByText('Expanded'));
    expect(onSetDensity).toHaveBeenCalledWith('compact');
  });

  it('shows hidden field count badge', () => {
    renderToolbar({ hiddenFieldCount: 4 });

    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows color dot when color rules are active', () => {
    renderToolbar({ hasColorRules: true });

    // Color button should have a dot indicator
    const colorButton = screen.getByText('Color').closest('button');
    expect(colorButton).toBeInTheDocument();
    // The dot is rendered as a span with rounded-full
    const dot = colorButton?.querySelector('.rounded-full');
    expect(dot).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// HideFieldsPanel tests
// ---------------------------------------------------------------------------

describe('HideFieldsPanel', () => {
  const primaryField = createField({ name: 'Name', isPrimary: true, sortOrder: 0 });
  const statusField = createField({ name: 'Status', sortOrder: 1 });
  const dateField = createField({ name: 'Due Date', fieldType: 'date', sortOrder: 2 });
  const allFields = [primaryField, statusField, dateField];

  it('renders all fields in the panel', () => {
    render(
      <IntlWrapper>
        <HideFieldsPanel
          {...createHideFieldsPanelProps(allFields)}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();
  });

  it('primary field toggle is disabled', () => {
    render(
      <IntlWrapper>
        <HideFieldsPanel
          {...createHideFieldsPanelProps(allFields)}
        />
      </IntlWrapper>,
    );

    const primaryToggle = screen.getByLabelText('Primary field is always visible');
    expect(primaryToggle).toBeDisabled();
  });

  it('calls onToggleField when clicking a field toggle', async () => {
    const onToggleField = vi.fn();
    const user = userEvent.setup();

    render(
      <IntlWrapper>
        <HideFieldsPanel
          {...createHideFieldsPanelProps(allFields)}
          onToggleField={onToggleField}
        />
      </IntlWrapper>,
    );

    const hideStatusBtn = screen.getByLabelText(`Hide Status`);
    await user.click(hideStatusBtn);
    expect(onToggleField).toHaveBeenCalledWith(statusField.id);
  });

  it('shows correct visible count', () => {
    render(
      <IntlWrapper>
        <HideFieldsPanel
          {...createHideFieldsPanelProps(allFields)}
          hiddenFieldIds={new Set([statusField.id])}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('2 of 3 visible')).toBeInTheDocument();
  });

  it('calls onShowAll when "Show all" is clicked', async () => {
    const onShowAll = vi.fn();
    const user = userEvent.setup();

    render(
      <IntlWrapper>
        <HideFieldsPanel
          {...createHideFieldsPanelProps(allFields)}
          hiddenFieldIds={new Set([statusField.id])}
          onShowAll={onShowAll}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByText('Show all'));
    expect(onShowAll).toHaveBeenCalled();
  });

  it('calls onHideAll when "Hide all" is clicked', async () => {
    const onHideAll = vi.fn();
    const user = userEvent.setup();

    render(
      <IntlWrapper>
        <HideFieldsPanel
          {...createHideFieldsPanelProps(allFields)}
          onHideAll={onHideAll}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByText('Hide all'));
    expect(onHideAll).toHaveBeenCalled();
  });

  it('disables "Show all" when all fields are visible', () => {
    render(
      <IntlWrapper>
        <HideFieldsPanel
          {...createHideFieldsPanelProps(allFields)}
          hiddenFieldIds={new Set()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Show all')).toBeDisabled();
  });

  it('disables "Hide all" when all non-primary fields are hidden', () => {
    render(
      <IntlWrapper>
        <HideFieldsPanel
          {...createHideFieldsPanelProps(allFields)}
          hiddenFieldIds={new Set([statusField.id, dateField.id])}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Hide all')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// RecordCount tests
// ---------------------------------------------------------------------------

describe('RecordCount', () => {
  it('shows total count when unfiltered', () => {
    render(
      <IntlWrapper>
        <RecordCount filteredCount={247} totalCount={247} isFiltered={false} />
      </IntlWrapper>,
    );

    expect(screen.getByText('247 records')).toBeInTheDocument();
  });

  it('shows filtered count of total when filtered', () => {
    render(
      <IntlWrapper>
        <RecordCount filteredCount={32} totalCount={247} isFiltered={true} />
      </IntlWrapper>,
    );

    expect(screen.getByText('32 of 247 records')).toBeInTheDocument();
  });

  it('shows singular form for 1 record', () => {
    render(
      <IntlWrapper>
        <RecordCount filteredCount={1} totalCount={1} isFiltered={false} />
      </IntlWrapper>,
    );

    expect(screen.getByText('1 record')).toBeInTheDocument();
  });

  it('has aria-live for accessibility', () => {
    render(
      <IntlWrapper>
        <RecordCount filteredCount={100} totalCount={100} isFiltered={false} />
      </IntlWrapper>,
    );

    const container = screen.getByText('100 records').closest('div');
    expect(container).toHaveAttribute('aria-live', 'polite');
  });
});
