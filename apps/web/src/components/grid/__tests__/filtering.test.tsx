// @vitest-environment jsdom
/**
 * Filter system tests — filter-types, use-filters hook, and filter clause builder.
 *
 * @see docs/reference/tables-and-views.md § Filtering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import {
  getOperatorsForFieldType,
  isUnaryOperator,
  createFilterCondition,
  createFilterGroup,
  createEmptyFilterConfig,
  FILTER_OPERATORS,
  ME_TOKEN,
  type FilterConfig,
} from '../filter-types';

import { useFilters } from '../use-filters';
import { createGridStore } from '../use-grid-store';
import { buildFilterClauses } from '../../../data/records';

// ---------------------------------------------------------------------------
// filter-types.ts tests
// ---------------------------------------------------------------------------

describe('filter-types', () => {
  describe('getOperatorsForFieldType', () => {
    it('returns text operators for text fields', () => {
      const ops = getOperatorsForFieldType('text');
      expect(ops).toContain('is');
      expect(ops).toContain('contains');
      expect(ops).toContain('starts_with');
      expect(ops).toContain('ends_with');
      expect(ops).toContain('is_empty');
    });

    it('returns numeric operators for number fields', () => {
      const ops = getOperatorsForFieldType('number');
      expect(ops).toContain('gt');
      expect(ops).toContain('gte');
      expect(ops).toContain('lt');
      expect(ops).toContain('lte');
      expect(ops).toContain('between');
    });

    it('returns date operators for date fields', () => {
      const ops = getOperatorsForFieldType('date');
      expect(ops).toContain('is_before');
      expect(ops).toContain('is_after');
      expect(ops).toContain('is_within');
    });

    it('returns select operators for single_select', () => {
      const ops = getOperatorsForFieldType('single_select');
      expect(ops).toContain('is_any_of');
      expect(ops).toContain('is_none_of');
    });

    it('returns multi-select operators for multi_select', () => {
      const ops = getOperatorsForFieldType('multi_select');
      expect(ops).toContain('contains_any_of');
      expect(ops).toContain('contains_all_of');
    });

    it('returns checkbox operators (only is)', () => {
      const ops = getOperatorsForFieldType('checkbox');
      expect(ops).toEqual([FILTER_OPERATORS.IS]);
    });

    it('returns people operators with support for contains', () => {
      const ops = getOperatorsForFieldType('people');
      expect(ops).toContain('is');
      expect(ops).toContain('contains');
      expect(ops).toContain('is_empty');
    });

    it('returns linked_record operators', () => {
      const ops = getOperatorsForFieldType('linked_record');
      expect(ops).toContain('is');
      expect(ops).toContain('is_not');
      expect(ops).toContain('is_empty');
    });

    it('returns rating operators', () => {
      const ops = getOperatorsForFieldType('rating');
      expect(ops).toContain('gt');
      expect(ops).toContain('lt');
      expect(ops).not.toContain('contains');
    });

    it('falls back to text operators for unknown types', () => {
      const ops = getOperatorsForFieldType('unknown_type');
      expect(ops).toEqual(getOperatorsForFieldType('text'));
    });

    it('returns same operators for url, email, phone as text', () => {
      const textOps = getOperatorsForFieldType('text');
      expect(getOperatorsForFieldType('url')).toEqual(textOps);
      expect(getOperatorsForFieldType('email')).toEqual(textOps);
      expect(getOperatorsForFieldType('phone')).toEqual(textOps);
    });

    it('returns same operators for currency and percent as number', () => {
      const numOps = getOperatorsForFieldType('number');
      expect(getOperatorsForFieldType('currency')).toEqual(numOps);
      expect(getOperatorsForFieldType('percent')).toEqual(numOps);
    });
  });

  describe('isUnaryOperator', () => {
    it('returns true for is_empty', () => {
      expect(isUnaryOperator('is_empty')).toBe(true);
    });

    it('returns true for is_not_empty', () => {
      expect(isUnaryOperator('is_not_empty')).toBe(true);
    });

    it('returns false for is', () => {
      expect(isUnaryOperator('is')).toBe(false);
    });

    it('returns false for contains', () => {
      expect(isUnaryOperator('contains')).toBe(false);
    });
  });

  describe('createFilterCondition', () => {
    it('creates a condition with correct field and default operator', () => {
      const condition = createFilterCondition('field-id', 'text');
      expect(condition.fieldId).toBe('field-id');
      expect(condition.operator).toBe('is');
      expect(condition.value).toBeNull();
      expect(condition.id).toBeTruthy();
    });

    it('uses first operator for the field type', () => {
      const condition = createFilterCondition('field-id', 'checkbox');
      expect(condition.operator).toBe('is');
    });

    it('generates unique IDs', () => {
      const c1 = createFilterCondition('f1', 'text');
      const c2 = createFilterCondition('f2', 'text');
      expect(c1.id).not.toBe(c2.id);
    });
  });

  describe('createFilterGroup', () => {
    it('creates an empty group with AND logic', () => {
      const group = createFilterGroup();
      expect(group.logic).toBe('and');
      expect(group.conditions).toEqual([]);
      expect(group.id).toBeTruthy();
    });
  });

  describe('createEmptyFilterConfig', () => {
    it('creates default empty filter config', () => {
      const config = createEmptyFilterConfig();
      expect(config.logic).toBe('and');
      expect(config.conditions).toEqual([]);
      expect(config.groups).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// use-filters hook tests
// ---------------------------------------------------------------------------

describe('useFilters', () => {
  let storeRef: ReturnType<typeof createGridStore>;
  let persistFn: (viewId: string, filters: FilterConfig) => void;

  beforeEach(() => {
    storeRef = createGridStore();
    persistFn = vi.fn();
  });

  function renderFilterHook(initialFilters?: FilterConfig) {
    return renderHook(() =>
      useFilters({
        filters: storeRef.getState().filters,
        setFilters: storeRef.getState().setFilters,
        getFilters: () => storeRef.getState().filters,
        viewId: 'view-1',
        initialFilters,
        onPersist: persistFn,
      }),
    );
  }

  it('returns empty filter state initially', () => {
    const { result } = renderFilterHook();
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.isFilterActive).toBe(false);
    expect(result.current.filteredFieldIds.size).toBe(0);
  });

  it('adds a condition', () => {
    const { result } = renderFilterHook();

    act(() => {
      result.current.addCondition('field-1', 'is', 'test');
    });

    const state = storeRef.getState().filters;
    expect(state.conditions).toHaveLength(1);
    expect(state.conditions[0]?.fieldId).toBe('field-1');
    expect(state.conditions[0]?.operator).toBe('is');
    expect(state.conditions[0]?.value).toBe('test');
    expect(persistFn).toHaveBeenCalledWith('view-1', state);
  });

  it('removes a condition', () => {
    const initial: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: 'a' },
        { id: 'c2', fieldId: 'f2', operator: 'is', value: 'b' },
      ],
      groups: [],
    };
    storeRef.setState({ filters: initial });

    const { result } = renderFilterHook();

    act(() => {
      result.current.removeCondition('c1');
    });

    const state = storeRef.getState().filters;
    expect(state.conditions).toHaveLength(1);
    expect(state.conditions[0]?.id).toBe('c2');
  });

  it('removes a condition from within a group', () => {
    const initial: FilterConfig = {
      logic: 'and',
      conditions: [],
      groups: [
        {
          id: 'g1',
          logic: 'and',
          conditions: [
            { id: 'c1', fieldId: 'f1', operator: 'is', value: 'a' },
          ],
        },
      ],
    };
    storeRef.setState({ filters: initial });

    const { result } = renderFilterHook();

    act(() => {
      result.current.removeCondition('c1');
    });

    const state = storeRef.getState().filters;
    expect(state.groups[0]?.conditions).toHaveLength(0);
  });

  it('updates a condition', () => {
    const initial: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: 'old' },
      ],
      groups: [],
    };
    storeRef.setState({ filters: initial });

    const { result } = renderFilterHook();

    act(() => {
      result.current.updateCondition('c1', { value: 'new' });
    });

    const state = storeRef.getState().filters;
    expect(state.conditions[0]?.value).toBe('new');
  });

  it('adds a group', () => {
    const { result } = renderFilterHook();

    act(() => {
      result.current.addGroup();
    });

    const state = storeRef.getState().filters;
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0]?.logic).toBe('and');
    expect(state.groups[0]?.conditions).toEqual([]);
  });

  it('adds a condition to a group', () => {
    const initial: FilterConfig = {
      logic: 'and',
      conditions: [],
      groups: [{ id: 'g1', logic: 'and', conditions: [] }],
    };
    storeRef.setState({ filters: initial });

    const { result } = renderFilterHook();

    act(() => {
      result.current.addConditionToGroup('g1', 'f1', 'contains', 'test');
    });

    const state = storeRef.getState().filters;
    expect(state.groups[0]?.conditions).toHaveLength(1);
    expect(state.groups[0]?.conditions[0]?.fieldId).toBe('f1');
  });

  it('removes a group', () => {
    const initial: FilterConfig = {
      logic: 'and',
      conditions: [],
      groups: [
        { id: 'g1', logic: 'and', conditions: [] },
        { id: 'g2', logic: 'or', conditions: [] },
      ],
    };
    storeRef.setState({ filters: initial });

    const { result } = renderFilterHook();

    act(() => {
      result.current.removeGroup('g1');
    });

    const state = storeRef.getState().filters;
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0]?.id).toBe('g2');
  });

  it('sets top-level logic', () => {
    const { result } = renderFilterHook();

    act(() => {
      result.current.setLogic('or');
    });

    expect(storeRef.getState().filters.logic).toBe('or');
  });

  it('sets group logic', () => {
    const initial: FilterConfig = {
      logic: 'and',
      conditions: [],
      groups: [{ id: 'g1', logic: 'and', conditions: [] }],
    };
    storeRef.setState({ filters: initial });

    const { result } = renderFilterHook();

    act(() => {
      result.current.setGroupLogic('g1', 'or');
    });

    expect(storeRef.getState().filters.groups[0]?.logic).toBe('or');
  });

  it('clears all filters', () => {
    const initial: FilterConfig = {
      logic: 'or',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: 'a' },
      ],
      groups: [
        {
          id: 'g1',
          logic: 'and',
          conditions: [
            { id: 'c2', fieldId: 'f2', operator: 'gt', value: 5 },
          ],
        },
      ],
    };
    storeRef.setState({ filters: initial });

    const { result } = renderFilterHook();

    act(() => {
      result.current.clearFilters();
    });

    const state = storeRef.getState().filters;
    expect(state.conditions).toEqual([]);
    expect(state.groups).toEqual([]);
    expect(state.logic).toBe('and');
  });

  it('computes activeFilterCount correctly', () => {
    const filtersWithConditions: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: 'a' },
        { id: 'c2', fieldId: 'f2', operator: 'is', value: 'b' },
      ],
      groups: [
        {
          id: 'g1',
          logic: 'and',
          conditions: [
            { id: 'c3', fieldId: 'f3', operator: 'gt', value: 5 },
          ],
        },
      ],
    };
    storeRef.setState({ filters: filtersWithConditions });

    const { result } = renderFilterHook();

    expect(result.current.activeFilterCount).toBe(3);
    expect(result.current.isFilterActive).toBe(true);
  });

  it('computes filteredFieldIds correctly', () => {
    const filtersWithConditions: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: 'a' },
      ],
      groups: [
        {
          id: 'g1',
          logic: 'and',
          conditions: [
            { id: 'c2', fieldId: 'f2', operator: 'gt', value: 5 },
          ],
        },
      ],
    };
    storeRef.setState({ filters: filtersWithConditions });

    const { result } = renderFilterHook();

    expect(result.current.filteredFieldIds.has('f1')).toBe(true);
    expect(result.current.filteredFieldIds.has('f2')).toBe(true);
    expect(result.current.filteredFieldIds.has('f3')).toBe(false);
  });

  it('persists on every mutation', () => {
    const { result } = renderFilterHook();

    act(() => {
      result.current.addCondition('f1', 'is', 'test');
    });

    expect(persistFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// buildFilterClauses tests
// ---------------------------------------------------------------------------

describe('buildFilterClauses', () => {
  it('returns null for undefined filters', () => {
    expect(buildFilterClauses(undefined)).toBeNull();
  });

  it('returns null for empty filter config', () => {
    const result = buildFilterClauses(createEmptyFilterConfig());
    expect(result).toBeNull();
  });

  it('returns a SQL clause for a single text "is" condition', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'field-abc', operator: 'is', value: 'hello' },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters);
    expect(clause).not.toBeNull();
  });

  it('builds AND clauses for multiple conditions with and logic', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: 'a' },
        { id: 'c2', fieldId: 'f2', operator: 'is', value: 'b' },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters);
    expect(clause).not.toBeNull();
  });

  it('builds OR clauses for or logic', () => {
    const filters: FilterConfig = {
      logic: 'or',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: 'a' },
        { id: 'c2', fieldId: 'f2', operator: 'is', value: 'b' },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters);
    expect(clause).not.toBeNull();
  });

  it('handles numeric field type casting', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'gt', value: 100 },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters, { f1: 'number' });
    expect(clause).not.toBeNull();
  });

  it('handles is_empty operator', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is_empty', value: null },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters);
    expect(clause).not.toBeNull();
  });

  it('resolves $me token to currentUserId', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: ME_TOKEN },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters, { f1: 'people' }, 'user-123');
    expect(clause).not.toBeNull();
  });

  it('handles nested groups', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: 'a' },
      ],
      groups: [
        {
          id: 'g1',
          logic: 'or',
          conditions: [
            { id: 'c2', fieldId: 'f2', operator: 'is', value: 'b' },
            { id: 'c3', fieldId: 'f3', operator: 'is', value: 'c' },
          ],
        },
      ],
    };
    const clause = buildFilterClauses(filters);
    expect(clause).not.toBeNull();
  });

  it('handles between operator', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        {
          id: 'c1',
          fieldId: 'f1',
          operator: 'between',
          value: { min: 10, max: 100 },
        },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters, { f1: 'number' });
    expect(clause).not.toBeNull();
  });

  it('handles contains operator with ILIKE', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'contains', value: 'search' },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters);
    expect(clause).not.toBeNull();
  });

  it('handles is_within date preset', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        {
          id: 'c1',
          fieldId: 'f1',
          operator: 'is_within',
          value: 'last_7_days',
        },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters, { f1: 'date' });
    expect(clause).not.toBeNull();
  });

  it('handles checkbox is operator with boolean cast', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'is', value: true },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters, { f1: 'checkbox' });
    expect(clause).not.toBeNull();
  });

  it('skips conditions with unknown operators', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'f1', operator: 'unknown_op', value: 'test' },
      ],
      groups: [],
    };
    const clause = buildFilterClauses(filters);
    expect(clause).toBeNull();
  });

  it('skips empty groups', () => {
    const filters: FilterConfig = {
      logic: 'and',
      conditions: [],
      groups: [{ id: 'g1', logic: 'and', conditions: [] }],
    };
    const clause = buildFilterClauses(filters);
    expect(clause).toBeNull();
  });
});
