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
import type { RowDensity } from '@/lib/types/grid';

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
  }));
}
