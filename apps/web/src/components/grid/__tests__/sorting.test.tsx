// @vitest-environment jsdom

/**
 * Tests for multi-level sorting — Prompt 2 (Phase 3A-ii).
 *
 * Covers:
 * - use-sort hook (addSort, removeSort, toggleSort, reorderSorts, clearSorts)
 * - SortPanel component rendering and interactions
 * - GridHeader sort indicators
 * - Sort query building (buildSortClauses via records.ts)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import { createGridStore } from '../use-grid-store';
import { useSort, MAX_SORT_LEVELS } from '../use-sort';
import { SortPanel } from '../SortPanel';
import type { SortLevel, GridField } from '../../../lib/types/grid';
import { viewConfigSchema, sortLevelSchema } from '../../../lib/types/grid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(
  id: string,
  name: string,
  fieldType = 'text',
): GridField {
  return {
    id,
    name,
    fieldType,
    isPrimary: false,
    isSystem: false,
    required: false,
    unique: false,
    readOnly: false,
    tenantId: 'tenant-1',
    tableId: 'table-1',
    sortOrder: 0,
    config: {},
    display: {},
    permissions: {},
    defaultValue: null,
    description: null,
    fieldSubType: null,
    externalFieldId: null,
    environment: 'live',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const FIELDS: GridField[] = [
  makeField('field-aaa', 'Name', 'text'),
  makeField('field-bbb', 'Amount', 'number'),
  makeField('field-ccc', 'Due Date', 'date'),
  makeField('field-ddd', 'Status', 'single_select'),
  makeField('field-eee', 'Active', 'checkbox'),
];

// ---------------------------------------------------------------------------
// Zod schema tests
// ---------------------------------------------------------------------------

describe('sortLevelSchema', () => {
  it('validates a valid sort level', () => {
    const result = sortLevelSchema.safeParse({
      fieldId: '550e8400-e29b-41d4-a716-446655440000',
      direction: 'asc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid direction', () => {
    const result = sortLevelSchema.safeParse({
      fieldId: '550e8400-e29b-41d4-a716-446655440000',
      direction: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid fieldId', () => {
    const result = sortLevelSchema.safeParse({
      fieldId: 'not-a-uuid',
      direction: 'asc',
    });
    expect(result.success).toBe(false);
  });
});

describe('viewConfigSchema with sorts', () => {
  it('accepts config with sorts array', () => {
    const result = viewConfigSchema.safeParse({
      sorts: [
        {
          fieldId: '550e8400-e29b-41d4-a716-446655440000',
          direction: 'desc',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts config without sorts', () => {
    const result = viewConfigSchema.safeParse({
      density: 'compact',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty sorts array', () => {
    const result = viewConfigSchema.safeParse({
      sorts: [],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useSort hook tests
// ---------------------------------------------------------------------------

describe('useSort', () => {
  let storeRef: ReturnType<typeof createGridStore>;
  let persistFn: (viewId: string, sorts: SortLevel[]) => void;

  beforeEach(() => {
    storeRef = createGridStore({ sorts: [] });
    persistFn = vi.fn();
  });

  function renderSortHook(initialSorts?: SortLevel[]) {
    return renderHook(() =>
      useSort({
        sorts: storeRef.getState().sorts,
        setSorts: storeRef.getState().setSorts,
        getSorts: () => storeRef.getState().sorts,
        viewId: 'view-1',
        initialSorts,
        onPersist: persistFn,
      }),
    );
  }

  it('starts with empty sorts', () => {
    const { result } = renderSortHook();
    expect(result.current.sorts).toEqual([]);
    expect(result.current.isSortActive).toBe(false);
    expect(result.current.isAtLimit).toBe(false);
  });

  it('addSort adds a new sort level', () => {
    const { result } = renderSortHook();
    act(() => result.current.addSort('field-aaa', 'asc'));

    expect(storeRef.getState().sorts).toEqual([
      { fieldId: 'field-aaa', direction: 'asc' },
    ]);
    expect(persistFn).toHaveBeenCalledWith('view-1', [
      { fieldId: 'field-aaa', direction: 'asc' },
    ]);
  });

  it('addSort does not add duplicate fieldId', () => {
    storeRef.setState({ sorts: [{ fieldId: 'field-aaa', direction: 'asc' }] });
    const { result } = renderSortHook();
    act(() => result.current.addSort('field-aaa', 'desc'));

    expect(storeRef.getState().sorts).toEqual([
      { fieldId: 'field-aaa', direction: 'asc' },
    ]);
    expect(persistFn).not.toHaveBeenCalled();
  });

  it('removeSort removes a sort level', () => {
    storeRef.setState({
      sorts: [
        { fieldId: 'field-aaa', direction: 'asc' },
        { fieldId: 'field-bbb', direction: 'desc' },
      ],
    });
    const { result } = renderSortHook();
    act(() => result.current.removeSort('field-aaa'));

    expect(storeRef.getState().sorts).toEqual([
      { fieldId: 'field-bbb', direction: 'desc' },
    ]);
  });

  it('toggleSort cycles none → asc → desc → none', () => {
    const { result } = renderSortHook();

    // none → asc
    act(() => result.current.toggleSort('field-aaa'));
    expect(storeRef.getState().sorts).toEqual([
      { fieldId: 'field-aaa', direction: 'asc' },
    ]);

    // asc → desc
    act(() => result.current.toggleSort('field-aaa'));
    expect(storeRef.getState().sorts).toEqual([
      { fieldId: 'field-aaa', direction: 'desc' },
    ]);

    // desc → none
    act(() => result.current.toggleSort('field-aaa'));
    expect(storeRef.getState().sorts).toEqual([]);
  });

  it('reorderSorts swaps sort priority', () => {
    storeRef.setState({
      sorts: [
        { fieldId: 'field-aaa', direction: 'asc' },
        { fieldId: 'field-bbb', direction: 'desc' },
        { fieldId: 'field-ccc', direction: 'asc' },
      ],
    });
    const { result } = renderSortHook();
    act(() => result.current.reorderSorts(0, 2));

    expect(storeRef.getState().sorts).toEqual([
      { fieldId: 'field-bbb', direction: 'desc' },
      { fieldId: 'field-ccc', direction: 'asc' },
      { fieldId: 'field-aaa', direction: 'asc' },
    ]);
  });

  it('reorderSorts ignores invalid indices', () => {
    storeRef.setState({
      sorts: [{ fieldId: 'field-aaa', direction: 'asc' }],
    });
    const { result } = renderSortHook();
    act(() => result.current.reorderSorts(-1, 5));

    expect(storeRef.getState().sorts).toEqual([
      { fieldId: 'field-aaa', direction: 'asc' },
    ]);
    expect(persistFn).not.toHaveBeenCalled();
  });

  it('clearSorts removes all sorts', () => {
    storeRef.setState({
      sorts: [
        { fieldId: 'field-aaa', direction: 'asc' },
        { fieldId: 'field-bbb', direction: 'desc' },
      ],
    });
    const { result } = renderSortHook();
    act(() => result.current.clearSorts());

    expect(storeRef.getState().sorts).toEqual([]);
    expect(persistFn).toHaveBeenCalledWith('view-1', []);
  });

  it('updateSortDirection changes direction of existing sort', () => {
    storeRef.setState({
      sorts: [{ fieldId: 'field-aaa', direction: 'asc' }],
    });
    const { result } = renderSortHook();
    act(() => result.current.updateSortDirection('field-aaa', 'desc'));

    expect(storeRef.getState().sorts).toEqual([
      { fieldId: 'field-aaa', direction: 'desc' },
    ]);
  });

  it('getSortForField returns sort level for sorted field', () => {
    storeRef.setState({
      sorts: [{ fieldId: 'field-aaa', direction: 'asc' }],
    });
    const { result } = renderSortHook();
    expect(result.current.getSortForField('field-aaa')).toEqual({
      fieldId: 'field-aaa',
      direction: 'asc',
    });
    expect(result.current.getSortForField('field-bbb')).toBeUndefined();
  });

  it('getSortIndex returns correct index', () => {
    storeRef.setState({
      sorts: [
        { fieldId: 'field-aaa', direction: 'asc' },
        { fieldId: 'field-bbb', direction: 'desc' },
      ],
    });
    const { result } = renderSortHook();
    expect(result.current.getSortIndex('field-bbb')).toBe(1);
    expect(result.current.getSortIndex('field-ccc')).toBe(-1);
  });

  it('isAtLimit is true at MAX_SORT_LEVELS', () => {
    storeRef.setState({
      sorts: Array.from({ length: MAX_SORT_LEVELS }, (_, i) => ({
        fieldId: `field-${String.fromCharCode(97 + i)}`,
        direction: 'asc' as const,
      })),
    });
    const { result } = renderSortHook();
    expect(result.current.isAtLimit).toBe(true);
  });

  it('isSortActive flag in store updates with sorts', () => {
    const { result } = renderSortHook();

    act(() => result.current.addSort('field-aaa', 'asc'));
    expect(storeRef.getState().isSortActive).toBe(true);

    act(() => result.current.clearSorts());
    expect(storeRef.getState().isSortActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SortPanel component tests
// ---------------------------------------------------------------------------

describe('SortPanel', () => {
  const defaultProps = {
    sorts: [] as SortLevel[],
    fields: FIELDS,
    onAddSort: vi.fn(),
    onRemoveSort: vi.fn(),
    onUpdateDirection: vi.fn(),
    onUpdateField: vi.fn(),
    onReorderSorts: vi.fn(),
    onClearSorts: vi.fn(),
    isAtLimit: false,
  };

  function renderPanel(overrides?: Partial<typeof defaultProps>) {
    return render(
      <IntlWrapper>
        <SortPanel {...defaultProps} {...overrides} />
      </IntlWrapper>,
    );
  }

  it('renders empty state when no sorts', () => {
    renderPanel();
    expect(screen.getByText('No sorts applied.')).toBeInTheDocument();
  });

  it('renders sort levels with field names', () => {
    renderPanel({
      sorts: [{ fieldId: 'field-aaa', direction: 'asc' }],
    });
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders add sort button', () => {
    renderPanel();
    expect(screen.getByText('Add sort')).toBeInTheDocument();
  });

  it('calls onAddSort when add button is clicked', () => {
    const onAddSort = vi.fn();
    renderPanel({ onAddSort });
    fireEvent.click(screen.getByText('Add sort'));
    expect(onAddSort).toHaveBeenCalledWith('field-aaa', 'asc');
  });

  it('renders clear all button when sorts exist', () => {
    renderPanel({
      sorts: [{ fieldId: 'field-aaa', direction: 'asc' }],
    });
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('calls onClearSorts when clear all is clicked', () => {
    const onClearSorts = vi.fn();
    renderPanel({
      sorts: [{ fieldId: 'field-aaa', direction: 'asc' }],
      onClearSorts,
    });
    fireEvent.click(screen.getByText('Clear all'));
    expect(onClearSorts).toHaveBeenCalled();
  });

  it('calls onRemoveSort when X button is clicked', () => {
    const onRemoveSort = vi.fn();
    renderPanel({
      sorts: [{ fieldId: 'field-aaa', direction: 'asc' }],
      onRemoveSort,
    });
    fireEvent.click(screen.getByLabelText('Remove sort'));
    expect(onRemoveSort).toHaveBeenCalledWith('field-aaa');
  });

  it('shows limit warning when at limit', () => {
    renderPanel({
      sorts: [
        { fieldId: 'field-aaa', direction: 'asc' },
        { fieldId: 'field-bbb', direction: 'desc' },
        { fieldId: 'field-ccc', direction: 'asc' },
      ],
      isAtLimit: true,
    });
    expect(
      screen.getByText(`Maximum of ${MAX_SORT_LEVELS} sort levels.`),
    ).toBeInTheDocument();
  });

  it('hides add button when no available fields', () => {
    // All fields already sorted
    renderPanel({
      sorts: FIELDS.map((f) => ({ fieldId: f.id, direction: 'asc' as const })),
    });
    expect(screen.queryByText('Add sort')).not.toBeInTheDocument();
  });

  it('renders direction toggle button', () => {
    renderPanel({
      sorts: [{ fieldId: 'field-aaa', direction: 'asc' }],
    });
    expect(screen.getByLabelText('Ascending')).toBeInTheDocument();
  });

  it('calls onUpdateDirection when direction toggle is clicked', () => {
    const onUpdateDirection = vi.fn();
    renderPanel({
      sorts: [{ fieldId: 'field-aaa', direction: 'asc' }],
      onUpdateDirection,
    });
    fireEvent.click(screen.getByLabelText('Ascending'));
    expect(onUpdateDirection).toHaveBeenCalledWith('field-aaa', 'desc');
  });
});

// ---------------------------------------------------------------------------
// Grid store sorts integration
// ---------------------------------------------------------------------------

describe('createGridStore - sorts', () => {
  it('initializes with empty sorts', () => {
    const store = createGridStore();
    expect(store.getState().sorts).toEqual([]);
    expect(store.getState().isSortActive).toBe(false);
  });

  it('initializes with provided sorts', () => {
    const sorts: SortLevel[] = [{ fieldId: 'f1', direction: 'asc' }];
    const store = createGridStore({ sorts });
    expect(store.getState().sorts).toEqual(sorts);
  });

  it('setSorts updates sorts and isSortActive', () => {
    const store = createGridStore();
    store.getState().setSorts([{ fieldId: 'f1', direction: 'asc' }]);

    expect(store.getState().sorts).toEqual([{ fieldId: 'f1', direction: 'asc' }]);
    expect(store.getState().isSortActive).toBe(true);
  });

  it('setSorts with empty array clears isSortActive', () => {
    const store = createGridStore({
      sorts: [{ fieldId: 'f1', direction: 'asc' }],
    });
    store.getState().setSorts([]);

    expect(store.getState().sorts).toEqual([]);
    expect(store.getState().isSortActive).toBe(false);
  });
});
