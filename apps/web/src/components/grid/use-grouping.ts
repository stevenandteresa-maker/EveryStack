'use client';

/**
 * Grouping state hook for the grid view.
 *
 * Manages multi-level grouping (up to 3 levels), computes nested group
 * structure from records, and persists group config to views.config.groups.
 *
 * @see docs/reference/tables-and-views.md § Grouping
 */

import { useCallback, useEffect, useRef } from 'react';
import type { GroupLevel, SortLevel, GridRecord, GridField } from '@/lib/types/grid';

/** Maximum group levels for MVP. */
export const MAX_GROUP_LEVELS = 3;

/** Height of a group header row in pixels. */
export const GROUP_HEADER_HEIGHT = 40;

/** Height of a group footer row in pixels. */
export const GROUP_FOOTER_HEIGHT = 36;

/** Indent per nesting level in pixels. */
export const GROUP_INDENT_PX = 16;

// ---------------------------------------------------------------------------
// Grouping hook options & return type
// ---------------------------------------------------------------------------

export interface UseGroupingOptions {
  groups: GroupLevel[];
  setGroups: (groups: GroupLevel[]) => void;
  getGroups: () => GroupLevel[];
  collapsedGroups: Set<string>;
  toggleGroupCollapsed: (groupKey: string) => void;
  setCollapsedGroups: (collapsed: Set<string>) => void;
  viewId: string;
  initialGroups?: GroupLevel[];
  onPersist: (viewId: string, groups: GroupLevel[]) => void;
}

export interface UseGroupingReturn {
  groups: GroupLevel[];
  addGroup: (fieldId: string, direction: 'asc' | 'desc') => void;
  removeGroup: (fieldId: string) => void;
  reorderGroups: (fromIndex: number, toIndex: number) => void;
  clearGroups: () => void;
  updateGroupDirection: (fieldId: string, direction: 'asc' | 'desc') => void;
  collapsedGroups: Set<string>;
  toggleGroupCollapsed: (groupKey: string) => void;
  collapseAll: (groupKeys: string[]) => void;
  expandAll: () => void;
  isGroupActive: boolean;
  isAtLimit: boolean;
}

export function useGrouping({
  groups,
  setGroups,
  getGroups,
  collapsedGroups,
  toggleGroupCollapsed,
  setCollapsedGroups,
  viewId,
  initialGroups,
  onPersist,
}: UseGroupingOptions): UseGroupingReturn {
  const initialized = useRef(false);

  // Initialize groups from view config on mount
  useEffect(() => {
    if (!initialized.current && initialGroups) {
      setGroups(initialGroups);
      initialized.current = true;
    }
  }, [initialGroups, setGroups]);

  const persistAndSet = useCallback(
    (newGroups: GroupLevel[]) => {
      setGroups(newGroups);
      onPersist(viewId, newGroups);
    },
    [setGroups, viewId, onPersist],
  );

  const addGroup = useCallback(
    (fieldId: string, direction: 'asc' | 'desc') => {
      const current = getGroups();
      if (current.length >= MAX_GROUP_LEVELS) return;
      if (current.some((g) => g.fieldId === fieldId)) return;
      persistAndSet([...current, { fieldId, direction }]);
    },
    [getGroups, persistAndSet],
  );

  const removeGroup = useCallback(
    (fieldId: string) => {
      persistAndSet(getGroups().filter((g) => g.fieldId !== fieldId));
    },
    [getGroups, persistAndSet],
  );

  const reorderGroups = useCallback(
    (fromIndex: number, toIndex: number) => {
      const current = [...getGroups()];
      if (
        fromIndex < 0 ||
        fromIndex >= current.length ||
        toIndex < 0 ||
        toIndex >= current.length
      ) {
        return;
      }
      const removed = current.splice(fromIndex, 1);
      const moved = removed[0];
      if (!moved) return;
      current.splice(toIndex, 0, moved);
      persistAndSet(current);
    },
    [getGroups, persistAndSet],
  );

  const clearGroups = useCallback(() => {
    persistAndSet([]);
    setCollapsedGroups(new Set());
  }, [persistAndSet, setCollapsedGroups]);

  const updateGroupDirection = useCallback(
    (fieldId: string, direction: 'asc' | 'desc') => {
      persistAndSet(
        getGroups().map((g) =>
          g.fieldId === fieldId ? { ...g, direction } : g,
        ),
      );
    },
    [getGroups, persistAndSet],
  );

  const collapseAll = useCallback(
    (groupKeys: string[]) => {
      setCollapsedGroups(new Set(groupKeys));
    },
    [setCollapsedGroups],
  );

  const expandAll = useCallback(() => {
    setCollapsedGroups(new Set());
  }, [setCollapsedGroups]);

  return {
    groups,
    addGroup,
    removeGroup,
    reorderGroups,
    clearGroups,
    updateGroupDirection,
    collapsedGroups,
    toggleGroupCollapsed,
    collapseAll,
    expandAll,
    isGroupActive: groups.length > 0,
    isAtLimit: groups.length >= MAX_GROUP_LEVELS,
  };
}

// ---------------------------------------------------------------------------
// Group computation types
// ---------------------------------------------------------------------------

export interface GroupNode {
  /** Unique key for this group (concatenated field values, pipe-separated). */
  key: string;
  /** The field ID this group is grouped by. */
  fieldId: string;
  /** The field value for this group. */
  value: unknown;
  /** Display label for the value. */
  label: string;
  /** Nesting level (0-based). */
  level: number;
  /** Total record count (including nested sub-groups). */
  recordCount: number;
  /** Direct child records (only at the deepest level). */
  records: GridRecord[];
  /** Nested sub-groups (empty at deepest level). */
  children: GroupNode[];
}

/**
 * Represents a flattened item for virtualized rendering.
 * Can be a group header, a data row, or a group footer.
 */
export type VirtualGroupItem =
  | { type: 'group-header'; group: GroupNode; height: number }
  | { type: 'record'; record: GridRecord; level: number; height: number }
  | { type: 'group-footer'; group: GroupNode; height: number };

// ---------------------------------------------------------------------------
// Group computation
// ---------------------------------------------------------------------------

/**
 * Build a nested group tree from records.
 *
 * Records are grouped level by level. Within each leaf group, records
 * are sorted by the active sort config.
 */
export interface ComputeGroupsOptions {
  /** Translated label for empty/null group values. */
  emptyLabel?: string;
}

export function computeGroups(
  records: GridRecord[],
  groups: GroupLevel[],
  fields: GridField[],
  sorts: SortLevel[],
  options?: ComputeGroupsOptions,
): GroupNode[] {
  if (groups.length === 0) return [];

  const emptyLabel = options?.emptyLabel ?? '(empty)';
  return buildGroupLevel(records, groups, fields, sorts, 0, '', emptyLabel);
}

function buildGroupLevel(
  records: GridRecord[],
  groups: GroupLevel[],
  fields: GridField[],
  sorts: SortLevel[],
  levelIndex: number,
  parentKey: string,
  emptyLabel: string,
): GroupNode[] {
  const groupLevel = groups[levelIndex];
  if (!groupLevel) return [];

  const field = fields.find((f) => f.id === groupLevel.fieldId);
  const fieldId = groupLevel.fieldId;

  // Bucket records by the group field value
  const buckets = new Map<string, GridRecord[]>();
  const valueMap = new Map<string, unknown>();

  for (const record of records) {
    const data = record.canonicalData as Record<string, unknown> | null;
    const rawValue = data?.[fieldId] ?? null;
    const stringKey = normalizeGroupValue(rawValue);

    if (!buckets.has(stringKey)) {
      buckets.set(stringKey, []);
      valueMap.set(stringKey, rawValue);
    }
    buckets.get(stringKey)!.push(record);
  }

  // Sort bucket keys by direction
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
    const comparison = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    return groupLevel.direction === 'desc' ? -comparison : comparison;
  });

  const result: GroupNode[] = [];

  for (const bucketKey of sortedKeys) {
    const bucketRecords = buckets.get(bucketKey) ?? [];
    const rawValue = valueMap.get(bucketKey);
    const groupKey = parentKey ? `${parentKey}|${bucketKey}` : bucketKey;

    const label = formatGroupLabel(rawValue, field, emptyLabel);

    const isDeepest = levelIndex === groups.length - 1;
    let children: GroupNode[] = [];
    let leafRecords: GridRecord[] = [];

    if (isDeepest) {
      leafRecords = sortRecordsWithinGroup(bucketRecords, sorts, fields);
    } else {
      children = buildGroupLevel(
        bucketRecords,
        groups,
        fields,
        sorts,
        levelIndex + 1,
        groupKey,
        emptyLabel,
      );
    }

    const recordCount = isDeepest
      ? leafRecords.length
      : children.reduce((sum, c) => sum + c.recordCount, 0);

    result.push({
      key: groupKey,
      fieldId,
      value: rawValue,
      label,
      level: levelIndex,
      recordCount,
      records: leafRecords,
      children,
    });
  }

  return result;
}

function normalizeGroupValue(value: unknown): string {
  if (value == null) return '\0__empty__';
  if (Array.isArray(value)) return value.map(String).sort().join(',');
  return String(value);
}

function formatGroupLabel(value: unknown, _field: GridField | undefined, emptyLabel: string): string {
  if (value == null || value === '') return emptyLabel;
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function sortRecordsWithinGroup(
  records: GridRecord[],
  sorts: SortLevel[],
  _fields: GridField[],
): GridRecord[] {
  if (sorts.length === 0) return records;

  return [...records].sort((a, b) => {
    for (const sort of sorts) {
      const aData = a.canonicalData as Record<string, unknown> | null;
      const bData = b.canonicalData as Record<string, unknown> | null;
      const aVal = aData?.[sort.fieldId] ?? null;
      const bVal = bData?.[sort.fieldId] ?? null;

      const comparison = compareValues(aVal, bVal);
      if (comparison !== 0) {
        return sort.direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
}

function compareValues(a: unknown, b: unknown): number {
  // Nulls sort last
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

// ---------------------------------------------------------------------------
// Flatten group tree for virtualized rendering
// ---------------------------------------------------------------------------

/**
 * Flatten the group tree into a list of virtual items for rendering.
 *
 * Collapsed groups emit only a header (their children are hidden).
 * Each leaf group emits: header → records → footer.
 */
export function flattenGroupTree(
  groups: GroupNode[],
  collapsedGroups: Set<string>,
  rowHeight: number,
): VirtualGroupItem[] {
  const items: VirtualGroupItem[] = [];

  function walk(nodes: GroupNode[]) {
    for (const node of nodes) {
      // Always emit the header
      items.push({ type: 'group-header', group: node, height: GROUP_HEADER_HEIGHT });

      if (collapsedGroups.has(node.key)) {
        // Collapsed — skip children
        continue;
      }

      if (node.children.length > 0) {
        walk(node.children);
      } else {
        // Leaf group — emit records
        for (const record of node.records) {
          items.push({ type: 'record', record, level: node.level, height: rowHeight });
        }
        // Emit footer for leaf groups with records
        if (node.records.length > 0) {
          items.push({ type: 'group-footer', group: node, height: GROUP_FOOTER_HEIGHT });
        }
      }
    }
  }

  walk(groups);
  return items;
}

// ---------------------------------------------------------------------------
// Re-export aggregation helpers from shared module
// ---------------------------------------------------------------------------

export {
  computeAggregation,
  getDefaultAggregation,
  getAggregationOptions,
  type AggregationType,
} from './aggregation-utils';

/**
 * Check if a field type supports drag-to-regroup.
 * Only Select/Status fields allow dragging records between groups.
 */
export function isDragRegroupSupported(fieldType: string): boolean {
  return fieldType === 'single_select' || fieldType === 'status';
}

/**
 * Collect all group keys from a group tree (for collapse-all).
 */
export function collectAllGroupKeys(nodes: GroupNode[]): string[] {
  const keys: string[] = [];
  function walk(group: GroupNode) {
    keys.push(group.key);
    for (const child of group.children) {
      walk(child);
    }
  }
  for (const node of nodes) {
    walk(node);
  }
  return keys;
}
