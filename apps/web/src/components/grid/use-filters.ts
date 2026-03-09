'use client';

/**
 * Filter state hook for the grid view.
 *
 * Manages filter conditions and groups, persists filter config
 * to views.config.filters via updateViewConfig().
 *
 * @see docs/reference/tables-and-views.md § Filtering
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { generateUUIDv7 } from '@everystack/shared/db';
import type {
  FilterCondition,
  FilterConfig,
} from './filter-types';
import {
  createEmptyFilterConfig,
  createFilterGroup,
} from './filter-types';

// ---------------------------------------------------------------------------
// Options & return type
// ---------------------------------------------------------------------------

export interface UseFiltersOptions {
  /** Current filter config from store. */
  filters: FilterConfig;
  /** Setter to update filters in the store. */
  setFilters: (filters: FilterConfig) => void;
  /** Getter for latest filters (avoids stale closures). */
  getFilters: () => FilterConfig;
  viewId: string;
  initialFilters?: FilterConfig;
  onPersist: (viewId: string, filters: FilterConfig) => void;
}

export interface UseFiltersReturn {
  filters: FilterConfig;
  /** Add a new filter condition to the top-level conditions list. */
  addCondition: (fieldId: string, operator: string, value: unknown) => void;
  /** Remove a condition by its id (searches top-level and groups). */
  removeCondition: (conditionId: string) => void;
  /** Update a condition's operator and/or value. */
  updateCondition: (
    conditionId: string,
    updates: Partial<Pick<FilterCondition, 'fieldId' | 'operator' | 'value'>>,
  ) => void;
  /** Add a new nested filter group. */
  addGroup: () => void;
  /** Add a condition to a specific group. */
  addConditionToGroup: (
    groupId: string,
    fieldId: string,
    operator: string,
    value: unknown,
  ) => void;
  /** Remove a filter group by its id. */
  removeGroup: (groupId: string) => void;
  /** Set the top-level logic operator (and/or). */
  setLogic: (logic: 'and' | 'or') => void;
  /** Set a group's logic operator. */
  setGroupLogic: (groupId: string, logic: 'and' | 'or') => void;
  /** Clear all filters. */
  clearFilters: () => void;
  /** Number of active filter conditions (top-level + groups). */
  activeFilterCount: number;
  /** Whether any filters are active. */
  isFilterActive: boolean;
  /** Returns the set of field IDs that have active filter conditions. */
  filteredFieldIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFilters({
  filters,
  setFilters,
  getFilters,
  viewId,
  initialFilters,
  onPersist,
}: UseFiltersOptions): UseFiltersReturn {
  const initialized = useRef(false);

  // Initialize filters from view config on mount
  useEffect(() => {
    if (!initialized.current && initialFilters) {
      setFilters(initialFilters);
      initialized.current = true;
    }
  }, [initialFilters, setFilters]);

  const persistAndSet = useCallback(
    (newFilters: FilterConfig) => {
      setFilters(newFilters);
      onPersist(viewId, newFilters);
    },
    [setFilters, viewId, onPersist],
  );

  const addCondition = useCallback(
    (fieldId: string, operator: string, value: unknown) => {
      const current = getFilters();
      const condition: FilterCondition = {
        id: generateUUIDv7(),
        fieldId,
        operator,
        value,
      };
      persistAndSet({
        ...current,
        conditions: [...current.conditions, condition],
      });
    },
    [getFilters, persistAndSet],
  );

  const removeCondition = useCallback(
    (conditionId: string) => {
      const current = getFilters();
      // Try top-level
      const topLevelFiltered = current.conditions.filter(
        (c) => c.id !== conditionId,
      );
      // Try groups
      const groupsFiltered = current.groups.map((g) => ({
        ...g,
        conditions: g.conditions.filter((c) => c.id !== conditionId),
      }));
      persistAndSet({
        ...current,
        conditions: topLevelFiltered,
        groups: groupsFiltered,
      });
    },
    [getFilters, persistAndSet],
  );

  const updateCondition = useCallback(
    (
      conditionId: string,
      updates: Partial<Pick<FilterCondition, 'fieldId' | 'operator' | 'value'>>,
    ) => {
      const current = getFilters();

      const updateInList = (conditions: FilterCondition[]) =>
        conditions.map((c) => {
          if (c.id !== conditionId) return c;
          const updated = { ...c, ...updates };
          // If field changed, reset operator to first available for new field type
          // (caller should handle this if needed)
          return updated;
        });

      persistAndSet({
        ...current,
        conditions: updateInList(current.conditions),
        groups: current.groups.map((g) => ({
          ...g,
          conditions: updateInList(g.conditions),
        })),
      });
    },
    [getFilters, persistAndSet],
  );

  const addGroup = useCallback(() => {
    const current = getFilters();
    persistAndSet({
      ...current,
      groups: [...current.groups, createFilterGroup()],
    });
  }, [getFilters, persistAndSet]);

  const addConditionToGroup = useCallback(
    (groupId: string, fieldId: string, operator: string, value: unknown) => {
      const current = getFilters();
      const condition: FilterCondition = {
        id: generateUUIDv7(),
        fieldId,
        operator,
        value,
      };
      persistAndSet({
        ...current,
        groups: current.groups.map((g) =>
          g.id === groupId
            ? { ...g, conditions: [...g.conditions, condition] }
            : g,
        ),
      });
    },
    [getFilters, persistAndSet],
  );

  const removeGroup = useCallback(
    (groupId: string) => {
      const current = getFilters();
      persistAndSet({
        ...current,
        groups: current.groups.filter((g) => g.id !== groupId),
      });
    },
    [getFilters, persistAndSet],
  );

  const setLogic = useCallback(
    (logic: 'and' | 'or') => {
      const current = getFilters();
      persistAndSet({ ...current, logic });
    },
    [getFilters, persistAndSet],
  );

  const setGroupLogic = useCallback(
    (groupId: string, logic: 'and' | 'or') => {
      const current = getFilters();
      persistAndSet({
        ...current,
        groups: current.groups.map((g) =>
          g.id === groupId ? { ...g, logic } : g,
        ),
      });
    },
    [getFilters, persistAndSet],
  );

  const clearFilters = useCallback(() => {
    persistAndSet(createEmptyFilterConfig());
  }, [persistAndSet]);

  // Computed values
  const activeFilterCount = useMemo(() => {
    let count = filters.conditions.length;
    for (const group of filters.groups) {
      count += group.conditions.length;
    }
    return count;
  }, [filters]);

  const isFilterActive = activeFilterCount > 0;

  const filteredFieldIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of filters.conditions) {
      ids.add(c.fieldId);
    }
    for (const g of filters.groups) {
      for (const c of g.conditions) {
        ids.add(c.fieldId);
      }
    }
    return ids;
  }, [filters]);

  return {
    filters,
    addCondition,
    removeCondition,
    updateCondition,
    addGroup,
    addConditionToGroup,
    removeGroup,
    setLogic,
    setGroupLogic,
    clearFilters,
    activeFilterCount,
    isFilterActive,
    filteredFieldIds,
  };
}
