// @vitest-environment jsdom
/**
 * Tests for multi-level grouping with collapsible groups.
 *
 * @see docs/Playbooks/Phase 3/playbook-phase-3a-ii.md § Prompt 4
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import {
  useGrouping,
  MAX_GROUP_LEVELS,
  computeGroups,
  flattenGroupTree,
  computeAggregation,
  getDefaultAggregation,
  isDragRegroupSupported,
  collectAllGroupKeys,
  GROUP_HEADER_HEIGHT,
  GROUP_FOOTER_HEIGHT,
} from '../use-grouping';
import { GroupHeader } from '../GroupHeader';
import { GroupFooter } from '../GroupFooter';
import type { GroupLevel, SortLevel, GridRecord, GridField } from '@/lib/types/grid';
import type { GroupNode } from '../use-grouping';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createTestField(overrides: Partial<GridField> = {}): GridField {
  return {
    id: 'field-1',
    tenantId: 'tenant-1',
    tableId: 'table-1',
    name: 'Status',
    fieldType: 'single_select',
    fieldSubType: null,
    isPrimary: false,
    isSystem: false,
    required: false,
    unique: false,
    readOnly: false,
    sortOrder: 0,
    config: {
      options: [
        { value: 'active', label: 'Active', color: 0 },
        { value: 'inactive', label: 'Inactive', color: 1 },
        { value: 'pending', label: 'Pending', color: 2 },
      ],
    },
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

function createTestRecord(
  id: string,
  data: Record<string, unknown>,
): GridRecord {
  return {
    id,
    tenantId: 'tenant-1',
    tableId: 'table-1',
    canonicalData: data,
    createdBy: null,
    updatedBy: null,
    syncMetadata: null,
    searchVector: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  } as GridRecord;
}

// ---------------------------------------------------------------------------
// useGrouping hook tests
// ---------------------------------------------------------------------------

describe('useGrouping', () => {
  function createGroupingHook(
    initialGroups: GroupLevel[] = [],
  ) {
    const state = {
      groups: initialGroups,
      collapsed: new Set<string>(),
    };
    const onPersist = vi.fn();

    return {
      ...renderHook(() =>
        useGrouping({
          groups: state.groups,
          setGroups: (g) => { state.groups = g; },
          getGroups: () => state.groups,
          collapsedGroups: state.collapsed,
          toggleGroupCollapsed: (key) => {
            const next = new Set(state.collapsed);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            state.collapsed = next;
          },
          setCollapsedGroups: (c) => { state.collapsed = c; },
          viewId: 'view-1',
          initialGroups: undefined,
          onPersist,
        }),
      ),
      state,
      onPersist,
    };
  }

  it('starts with no active groups', () => {
    const { result } = createGroupingHook();
    expect(result.current.isGroupActive).toBe(false);
    expect(result.current.groups).toHaveLength(0);
    expect(result.current.isAtLimit).toBe(false);
  });

  it('adds a group level', () => {
    const { state, result } = createGroupingHook();
    act(() => result.current.addGroup('field-1', 'asc'));
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0]?.fieldId).toBe('field-1');
  });

  it('prevents duplicate group fields', () => {
    const { state, result } = createGroupingHook([{ fieldId: 'field-1', direction: 'asc' }]);
    act(() => result.current.addGroup('field-1', 'desc'));
    expect(state.groups).toHaveLength(1);
  });

  it('enforces MAX_GROUP_LEVELS', () => {
    const initial: GroupLevel[] = [
      { fieldId: 'f1', direction: 'asc' },
      { fieldId: 'f2', direction: 'asc' },
      { fieldId: 'f3', direction: 'asc' },
    ];
    const { state, result } = createGroupingHook(initial);
    expect(result.current.isAtLimit).toBe(true);
    act(() => result.current.addGroup('f4', 'asc'));
    expect(state.groups).toHaveLength(MAX_GROUP_LEVELS);
  });

  it('removes a group level', () => {
    const { state, result } = createGroupingHook([{ fieldId: 'f1', direction: 'asc' }]);
    act(() => result.current.removeGroup('f1'));
    expect(state.groups).toHaveLength(0);
  });

  it('reorders groups', () => {
    const initial: GroupLevel[] = [
      { fieldId: 'f1', direction: 'asc' },
      { fieldId: 'f2', direction: 'desc' },
    ];
    const { state, result } = createGroupingHook(initial);
    act(() => result.current.reorderGroups(0, 1));
    expect(state.groups[0]?.fieldId).toBe('f2');
    expect(state.groups[1]?.fieldId).toBe('f1');
  });

  it('clears all groups and collapsed state', () => {
    const { state, result } = createGroupingHook([{ fieldId: 'f1', direction: 'asc' }]);
    act(() => result.current.clearGroups());
    expect(state.groups).toHaveLength(0);
    expect(state.collapsed.size).toBe(0);
  });

  it('updates group direction', () => {
    const { state, result } = createGroupingHook([{ fieldId: 'f1', direction: 'asc' }]);
    act(() => result.current.updateGroupDirection('f1', 'desc'));
    expect(state.groups[0]?.direction).toBe('desc');
  });
});

// ---------------------------------------------------------------------------
// computeGroups tests
// ---------------------------------------------------------------------------

describe('computeGroups', () => {
  const statusField = createTestField({ id: 'status', name: 'Status', fieldType: 'single_select' });
  const priorityField = createTestField({
    id: 'priority',
    name: 'Priority',
    fieldType: 'single_select',
    config: {
      options: [
        { value: 'high', label: 'High', color: 0 },
        { value: 'low', label: 'Low', color: 1 },
      ],
    },
  });
  const numberField = createTestField({ id: 'amount', name: 'Amount', fieldType: 'number' });

  const records: GridRecord[] = [
    createTestRecord('r1', { status: 'active', priority: 'high', amount: 100 }),
    createTestRecord('r2', { status: 'active', priority: 'low', amount: 200 }),
    createTestRecord('r3', { status: 'inactive', priority: 'high', amount: 50 }),
    createTestRecord('r4', { status: 'inactive', priority: 'low', amount: 75 }),
    createTestRecord('r5', { status: 'active', priority: 'high', amount: 150 }),
  ];

  const fields = [statusField, priorityField, numberField];

  it('groups records by a single field', () => {
    const groups: GroupLevel[] = [{ fieldId: 'status', direction: 'asc' }];
    const result = computeGroups(records, groups, fields, []);

    expect(result).toHaveLength(2);
    expect(result[0]?.value).toBe('active');
    expect(result[0]?.recordCount).toBe(3);
    expect(result[1]?.value).toBe('inactive');
    expect(result[1]?.recordCount).toBe(2);
  });

  it('groups records in descending order', () => {
    const groups: GroupLevel[] = [{ fieldId: 'status', direction: 'desc' }];
    const result = computeGroups(records, groups, fields, []);

    expect(result[0]?.value).toBe('inactive');
    expect(result[1]?.value).toBe('active');
  });

  it('supports multi-level grouping', () => {
    const groups: GroupLevel[] = [
      { fieldId: 'status', direction: 'asc' },
      { fieldId: 'priority', direction: 'asc' },
    ];
    const result = computeGroups(records, groups, fields, []);

    expect(result).toHaveLength(2); // active, inactive
    const activeGroup = result[0];
    expect(activeGroup?.children).toHaveLength(2); // high, low
    expect(activeGroup?.children[0]?.value).toBe('high');
    expect(activeGroup?.children[0]?.recordCount).toBe(2);
    expect(activeGroup?.children[1]?.value).toBe('low');
    expect(activeGroup?.children[1]?.recordCount).toBe(1);
  });

  it('sorts records within leaf groups by active sorts', () => {
    const groups: GroupLevel[] = [{ fieldId: 'status', direction: 'asc' }];
    const sorts: SortLevel[] = [{ fieldId: 'amount', direction: 'desc' }];
    const result = computeGroups(records, groups, fields, sorts);

    const activeRecords = result[0]?.records ?? [];
    expect(activeRecords[0]?.id).toBe('r2'); // 200
    expect(activeRecords[1]?.id).toBe('r5'); // 150
    expect(activeRecords[2]?.id).toBe('r1'); // 100
  });

  it('handles null/empty values', () => {
    const recordsWithNull = [
      ...records,
      createTestRecord('r6', { status: null, priority: 'high', amount: 0 }),
    ];
    const groups: GroupLevel[] = [{ fieldId: 'status', direction: 'asc' }];
    const result = computeGroups(recordsWithNull, groups, fields, []);

    // Null values get their own group
    const nullGroup = result.find((g) => g.value === null);
    expect(nullGroup).toBeDefined();
    expect(nullGroup?.recordCount).toBe(1);
  });

  it('returns empty array when no groups configured', () => {
    const result = computeGroups(records, [], fields, []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// flattenGroupTree tests
// ---------------------------------------------------------------------------

describe('flattenGroupTree', () => {
  const statusField = createTestField();
  const fields = [statusField];

  const records: GridRecord[] = [
    createTestRecord('r1', { 'field-1': 'active' }),
    createTestRecord('r2', { 'field-1': 'active' }),
    createTestRecord('r3', { 'field-1': 'inactive' }),
  ];

  it('flattens a single-level group tree', () => {
    const groups: GroupLevel[] = [{ fieldId: 'field-1', direction: 'asc' }];
    const tree = computeGroups(records, groups, fields, []);
    const items = flattenGroupTree(tree, new Set(), 44);

    // active: header + 2 records + footer = 4
    // inactive: header + 1 record + footer = 3
    expect(items).toHaveLength(7);
    expect(items[0]?.type).toBe('group-header');
    expect(items[1]?.type).toBe('record');
    expect(items[2]?.type).toBe('record');
    expect(items[3]?.type).toBe('group-footer');
    expect(items[4]?.type).toBe('group-header');
    expect(items[5]?.type).toBe('record');
    expect(items[6]?.type).toBe('group-footer');
  });

  it('hides records when group is collapsed', () => {
    const groups: GroupLevel[] = [{ fieldId: 'field-1', direction: 'asc' }];
    const tree = computeGroups(records, groups, fields, []);

    // Collapse the 'active' group
    const activeKey = tree[0]?.key ?? '';
    const items = flattenGroupTree(tree, new Set([activeKey]), 44);

    // active: header only (collapsed) = 1
    // inactive: header + 1 record + footer = 3
    expect(items).toHaveLength(4);
    expect(items[0]?.type).toBe('group-header');
    expect(items[1]?.type).toBe('group-header');
    expect(items[2]?.type).toBe('record');
    expect(items[3]?.type).toBe('group-footer');
  });

  it('assigns correct heights', () => {
    const groups: GroupLevel[] = [{ fieldId: 'field-1', direction: 'asc' }];
    const tree = computeGroups(records, groups, fields, []);
    const items = flattenGroupTree(tree, new Set(), 44);

    const headers = items.filter((i) => i.type === 'group-header');
    const recordItems = items.filter((i) => i.type === 'record');
    const footers = items.filter((i) => i.type === 'group-footer');

    for (const h of headers) expect(h.height).toBe(GROUP_HEADER_HEIGHT);
    for (const r of recordItems) expect(r.height).toBe(44);
    for (const f of footers) expect(f.height).toBe(GROUP_FOOTER_HEIGHT);
  });
});

// ---------------------------------------------------------------------------
// computeAggregation tests
// ---------------------------------------------------------------------------

describe('computeAggregation', () => {
  const records: GridRecord[] = [
    createTestRecord('r1', { amount: 100, status: 'active', done: true }),
    createTestRecord('r2', { amount: 200, status: 'active', done: false }),
    createTestRecord('r3', { amount: 50, status: 'inactive', done: true }),
    createTestRecord('r4', { amount: null, status: null, done: null }),
  ];

  it('computes count', () => {
    const result = computeAggregation(records, 'amount', 'count');
    expect(result.raw).toBe(4);
  });

  it('computes sum', () => {
    const result = computeAggregation(records, 'amount', 'sum');
    expect(result.raw).toBe(350);
  });

  it('computes avg', () => {
    const result = computeAggregation(records, 'amount', 'avg');
    expect(result.raw).toBeCloseTo(116.67, 1);
  });

  it('computes min', () => {
    const result = computeAggregation(records, 'amount', 'min');
    expect(result.raw).toBe(50);
  });

  it('computes max', () => {
    const result = computeAggregation(records, 'amount', 'max');
    expect(result.raw).toBe(200);
  });

  it('computes empty', () => {
    const result = computeAggregation(records, 'amount', 'empty');
    expect(result.raw).toBe(1);
  });

  it('computes filled', () => {
    const result = computeAggregation(records, 'done', 'filled');
    expect(result.raw).toBe(3);
  });

  it('computes unique', () => {
    const result = computeAggregation(records, 'status', 'unique');
    expect(result.raw).toBe(2); // 'active', 'inactive' — null excluded
  });

  it('handles none aggregation', () => {
    const result = computeAggregation(records, 'amount', 'none');
    expect(result.value).toBe('');
  });

  it('returns dash for avg/min/max with no numeric values', () => {
    const emptyRecords = [createTestRecord('r1', { amount: null })];
    expect(computeAggregation(emptyRecords, 'amount', 'avg').value).toBe('-');
    expect(computeAggregation(emptyRecords, 'amount', 'min').value).toBe('-');
    expect(computeAggregation(emptyRecords, 'amount', 'max').value).toBe('-');
  });
});

// ---------------------------------------------------------------------------
// getDefaultAggregation tests
// ---------------------------------------------------------------------------

describe('getDefaultAggregation', () => {
  it('returns sum for numeric types', () => {
    expect(getDefaultAggregation('number')).toBe('sum');
    expect(getDefaultAggregation('currency')).toBe('sum');
    expect(getDefaultAggregation('percent')).toBe('sum');
    expect(getDefaultAggregation('duration')).toBe('sum');
  });

  it('returns avg for rating', () => {
    expect(getDefaultAggregation('rating')).toBe('avg');
  });

  it('returns filled for checkbox', () => {
    expect(getDefaultAggregation('checkbox')).toBe('filled');
  });

  it('returns count for other types', () => {
    expect(getDefaultAggregation('text')).toBe('count');
    expect(getDefaultAggregation('single_select')).toBe('count');
    expect(getDefaultAggregation('date')).toBe('count');
  });
});

// ---------------------------------------------------------------------------
// isDragRegroupSupported tests
// ---------------------------------------------------------------------------

describe('isDragRegroupSupported', () => {
  it('returns true for single_select and status', () => {
    expect(isDragRegroupSupported('single_select')).toBe(true);
    expect(isDragRegroupSupported('status')).toBe(true);
  });

  it('returns false for other field types', () => {
    expect(isDragRegroupSupported('text')).toBe(false);
    expect(isDragRegroupSupported('number')).toBe(false);
    expect(isDragRegroupSupported('date')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// collectAllGroupKeys tests
// ---------------------------------------------------------------------------

describe('collectAllGroupKeys', () => {
  it('collects all keys from nested groups', () => {
    const nodes: GroupNode[] = [
      {
        key: 'a',
        fieldId: 'f1',
        value: 'a',
        label: 'A',
        level: 0,
        recordCount: 3,
        records: [],
        children: [
          {
            key: 'a|x',
            fieldId: 'f2',
            value: 'x',
            label: 'X',
            level: 1,
            recordCount: 2,
            records: [],
            children: [],
          },
          {
            key: 'a|y',
            fieldId: 'f2',
            value: 'y',
            label: 'Y',
            level: 1,
            recordCount: 1,
            records: [],
            children: [],
          },
        ],
      },
    ];

    const keys = collectAllGroupKeys(nodes);
    expect(keys).toEqual(['a', 'a|x', 'a|y']);
  });
});

// ---------------------------------------------------------------------------
// GroupHeader component tests
// ---------------------------------------------------------------------------

describe('GroupHeader', () => {
  const statusField = createTestField();

  const group: GroupNode = {
    key: 'active',
    fieldId: 'field-1',
    value: 'active',
    label: 'Active',
    level: 0,
    recordCount: 5,
    records: [],
    children: [],
  };

  it('renders field name and value', () => {
    render(
      <IntlWrapper>
        <GroupHeader
          group={group}
          field={statusField}
          isCollapsed={false}
          totalWidth={1000}
          onToggleCollapse={() => {}}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Status:')).toBeInTheDocument();
  });

  it('shows correct record count badge', () => {
    render(
      <IntlWrapper>
        <GroupHeader
          group={group}
          field={statusField}
          isCollapsed={false}
          totalWidth={1000}
          onToggleCollapse={() => {}}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('5 records')).toBeInTheDocument();
  });

  it('renders colored pill for select fields', () => {
    render(
      <IntlWrapper>
        <GroupHeader
          group={group}
          field={statusField}
          isCollapsed={false}
          totalWidth={1000}
          onToggleCollapse={() => {}}
        />
      </IntlWrapper>,
    );

    // The Active label appears in a pill with backgroundColor set
    const pill = screen.getByText('Active');
    expect(pill).toBeInTheDocument();
    expect(pill.style.backgroundColor).toBeTruthy();
  });

  it('calls onToggleCollapse on click', () => {
    const onToggle = vi.fn();
    render(
      <IntlWrapper>
        <GroupHeader
          group={group}
          field={statusField}
          isCollapsed={false}
          totalWidth={1000}
          onToggleCollapse={onToggle}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByRole('row'));
    expect(onToggle).toHaveBeenCalledWith('active');
  });

  it('has aria-expanded attribute', () => {
    const { rerender } = render(
      <IntlWrapper>
        <GroupHeader
          group={group}
          field={statusField}
          isCollapsed={false}
          totalWidth={1000}
          onToggleCollapse={() => {}}
        />
      </IntlWrapper>,
    );

    expect(screen.getByRole('row')).toHaveAttribute('aria-expanded', 'true');

    rerender(
      <IntlWrapper>
        <GroupHeader
          group={group}
          field={statusField}
          isCollapsed={true}
          totalWidth={1000}
          onToggleCollapse={() => {}}
        />
      </IntlWrapper>,
    );

    expect(screen.getByRole('row')).toHaveAttribute('aria-expanded', 'false');
  });

  it('indents based on level', () => {
    const nestedGroup: GroupNode = { ...group, level: 2 };
    render(
      <IntlWrapper>
        <GroupHeader
          group={nestedGroup}
          field={statusField}
          isCollapsed={false}
          totalWidth={1000}
          onToggleCollapse={() => {}}
        />
      </IntlWrapper>,
    );

    const row = screen.getByRole('row');
    // Level 2 = 2 * 16 = 32px indent, plus base 12px = 44px paddingLeft
    expect(row.style.paddingLeft).toBe('44px');
  });
});

// ---------------------------------------------------------------------------
// GroupFooter component tests
// ---------------------------------------------------------------------------

describe('GroupFooter', () => {
  const numberField = createTestField({
    id: 'amount',
    name: 'Amount',
    fieldType: 'number',
  });

  const records = [
    createTestRecord('r1', { amount: 100 }),
    createTestRecord('r2', { amount: 200 }),
  ];

  const group: GroupNode = {
    key: 'active',
    fieldId: 'status',
    value: 'active',
    label: 'Active',
    level: 0,
    recordCount: 2,
    records,
    children: [],
  };

  it('renders aggregation values', () => {
    render(
      <IntlWrapper>
        <GroupFooter
          group={group}
          fields={[numberField]}
          columnWidths={{}}
          totalWidth={1000}
        />
      </IntlWrapper>,
    );

    // Default aggregation for number is sum = 300
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('shows summary label', () => {
    render(
      <IntlWrapper>
        <GroupFooter
          group={group}
          fields={[numberField]}
          columnWidths={{}}
          totalWidth={1000}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Summary')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ViewConfig groups schema tests
// ---------------------------------------------------------------------------

describe('ViewConfig groups schema', () => {
  it('accepts groups in viewConfigSchema', async () => {
    const { viewConfigSchema } = await import('@/lib/types/grid');
    const config = viewConfigSchema.parse({
      groups: [
        { fieldId: '019503a1-b3c4-7def-8123-456789abcdef', direction: 'asc' },
        { fieldId: '019503a1-b3c4-7def-8123-456789abcde0', direction: 'desc' },
      ],
    });

    expect(config.groups).toHaveLength(2);
    expect(config.groups?.[0]?.direction).toBe('asc');
  });

  it('allows groups to be undefined', async () => {
    const { viewConfigSchema } = await import('@/lib/types/grid');
    const config = viewConfigSchema.parse({});
    expect(config.groups).toBeUndefined();
  });
});
