/**
 * Grid instance Zustand store.
 *
 * Scoped per grid instance (not global). Manages active cell, editing state,
 * density, frozen columns, column widths, and column order.
 *
 * @see docs/reference/tables-and-views.md § Grid Anatomy
 */

import { create } from 'zustand';
import type { CellPosition } from './grid-types';
import type { RowDensity, SortLevel, GroupLevel } from '@/lib/types/grid';
import type { FilterConfig } from './filter-types';
import { createEmptyFilterConfig } from './filter-types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export type EditMode = 'replace' | 'edit';

export interface GridState {
  activeCell: CellPosition | null;
  editingCell: CellPosition | null;
  editMode: EditMode;
  density: RowDensity;
  frozenColumnCount: number;
  columnWidths: Record<string, number>;
  columnOrder: string[];
  columnColors: Record<string, string>;
  hiddenFieldIds: Set<string>;
  selectedRows: Set<string>;
  selectionAnchor: CellPosition | null;
  selectionRange: CellPosition | null;
  sorts: SortLevel[];
  isSortActive: boolean;
  filters: FilterConfig;
  isFilterActive: boolean;
  groups: GroupLevel[];
  isGroupActive: boolean;
  collapsedGroups: Set<string>;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface GridActions {
  setActiveCell: (cell: CellPosition | null) => void;
  startEditing: (cell: CellPosition, mode?: EditMode) => void;
  stopEditing: () => void;
  setDensity: (density: RowDensity) => void;
  setColumnWidth: (fieldId: string, width: number) => void;
  reorderColumn: (fieldId: string, newIndex: number) => void;
  setFrozenCount: (count: number) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnColor: (fieldId: string, colorName: string | null) => void;
  setHiddenFieldIds: (ids: Set<string>) => void;
  toggleFieldHidden: (fieldId: string) => void;
  setSelectedRows: (rows: Set<string>) => void;
  setSelectionAnchor: (cell: CellPosition | null) => void;
  setSelectionRange: (cell: CellPosition | null) => void;
  setSorts: (sorts: SortLevel[]) => void;
  setIsSortActive: (active: boolean) => void;
  setFilters: (filters: FilterConfig) => void;
  setIsFilterActive: (active: boolean) => void;
  setGroups: (groups: GroupLevel[]) => void;
  setIsGroupActive: (active: boolean) => void;
  setCollapsedGroups: (collapsed: Set<string>) => void;
  toggleGroupCollapsed: (groupKey: string) => void;
}

export type GridStore = GridState & GridActions;

// ---------------------------------------------------------------------------
// Store factory — creates a new store per grid instance
// ---------------------------------------------------------------------------

export function createGridStore(initialState?: Partial<GridState>) {
  return create<GridStore>()((set) => ({
    // Default state
    activeCell: null,
    editingCell: null,
    editMode: 'edit',
    density: 'medium',
    frozenColumnCount: 0,
    columnWidths: {},
    columnOrder: [],
    columnColors: {},
    hiddenFieldIds: new Set<string>(),
    selectedRows: new Set<string>(),
    selectionAnchor: null,
    selectionRange: null,
    sorts: [],
    isSortActive: false,
    filters: createEmptyFilterConfig(),
    isFilterActive: false,
    groups: [],
    isGroupActive: false,
    collapsedGroups: new Set<string>(),
    ...initialState,

    // Actions
    setActiveCell: (cell) => set({ activeCell: cell }),

    startEditing: (cell, mode = 'edit') =>
      set({ activeCell: cell, editingCell: cell, editMode: mode }),

    stopEditing: () => set({ editingCell: null, editMode: 'edit' }),

    setDensity: (density) => set({ density }),

    setColumnWidth: (fieldId, width) =>
      set((state) => ({
        columnWidths: { ...state.columnWidths, [fieldId]: width },
      })),

    reorderColumn: (fieldId, newIndex) =>
      set((state) => {
        const order = [...state.columnOrder];
        const currentIndex = order.indexOf(fieldId);
        if (currentIndex === -1) return state;

        order.splice(currentIndex, 1);
        order.splice(newIndex, 0, fieldId);
        return { columnOrder: order };
      }),

    setFrozenCount: (count) => set({ frozenColumnCount: count }),

    setColumnOrder: (order) => set({ columnOrder: order }),

    setColumnColor: (fieldId, colorName) =>
      set((state) => {
        const updated = { ...state.columnColors };
        if (colorName === null) {
          delete updated[fieldId];
        } else {
          updated[fieldId] = colorName;
        }
        return { columnColors: updated };
      }),

    setHiddenFieldIds: (ids) => set({ hiddenFieldIds: ids }),

    toggleFieldHidden: (fieldId) =>
      set((state) => {
        const updated = new Set(state.hiddenFieldIds);
        if (updated.has(fieldId)) {
          updated.delete(fieldId);
        } else {
          updated.add(fieldId);
        }
        return { hiddenFieldIds: updated };
      }),

    setSelectedRows: (rows) => set({ selectedRows: rows }),

    setSelectionAnchor: (cell) => set({ selectionAnchor: cell }),

    setSelectionRange: (cell) => set({ selectionRange: cell }),

    setSorts: (sorts) => set({ sorts, isSortActive: sorts.length > 0 }),

    setIsSortActive: (active) => set({ isSortActive: active }),

    setFilters: (filters) =>
      set({
        filters,
        isFilterActive:
          filters.conditions.length > 0 ||
          filters.groups.some((g) => g.conditions.length > 0),
      }),

    setIsFilterActive: (active) => set({ isFilterActive: active }),

    setGroups: (groups) => set({ groups, isGroupActive: groups.length > 0 }),

    setIsGroupActive: (active) => set({ isGroupActive: active }),

    setCollapsedGroups: (collapsed) => set({ collapsedGroups: collapsed }),

    toggleGroupCollapsed: (groupKey) =>
      set((state) => {
        const updated = new Set(state.collapsedGroups);
        if (updated.has(groupKey)) {
          updated.delete(groupKey);
        } else {
          updated.add(groupKey);
        }
        return { collapsedGroups: updated };
      }),
  }));
}
