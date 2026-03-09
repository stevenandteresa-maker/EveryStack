import { describe, it, expect } from 'vitest';
import { createGridStore } from '../use-grid-store';

describe('createGridStore', () => {
  it('creates store with default state', () => {
    const useStore = createGridStore();
    const state = useStore.getState();

    expect(state.activeCell).toBeNull();
    expect(state.editingCell).toBeNull();
    expect(state.density).toBe('medium');
    expect(state.frozenColumnCount).toBe(0);
    expect(state.columnWidths).toEqual({});
    expect(state.columnOrder).toEqual([]);
  });

  it('creates store with initial state overrides', () => {
    const useStore = createGridStore({
      density: 'compact',
      frozenColumnCount: 2,
    });
    const state = useStore.getState();

    expect(state.density).toBe('compact');
    expect(state.frozenColumnCount).toBe(2);
  });

  it('setActiveCell updates active cell', () => {
    const useStore = createGridStore();
    useStore.getState().setActiveCell({ rowId: 'r1', fieldId: 'f1' });

    expect(useStore.getState().activeCell).toEqual({ rowId: 'r1', fieldId: 'f1' });
  });

  it('setActiveCell to null clears active cell', () => {
    const useStore = createGridStore();
    useStore.getState().setActiveCell({ rowId: 'r1', fieldId: 'f1' });
    useStore.getState().setActiveCell(null);

    expect(useStore.getState().activeCell).toBeNull();
  });

  it('startEditing sets both activeCell and editingCell', () => {
    const useStore = createGridStore();
    useStore.getState().startEditing({ rowId: 'r1', fieldId: 'f1' });

    expect(useStore.getState().activeCell).toEqual({ rowId: 'r1', fieldId: 'f1' });
    expect(useStore.getState().editingCell).toEqual({ rowId: 'r1', fieldId: 'f1' });
  });

  it('stopEditing clears editingCell but preserves activeCell', () => {
    const useStore = createGridStore();
    useStore.getState().startEditing({ rowId: 'r1', fieldId: 'f1' });
    useStore.getState().stopEditing();

    expect(useStore.getState().activeCell).toEqual({ rowId: 'r1', fieldId: 'f1' });
    expect(useStore.getState().editingCell).toBeNull();
  });

  it('setDensity updates density', () => {
    const useStore = createGridStore();
    useStore.getState().setDensity('tall');

    expect(useStore.getState().density).toBe('tall');
  });

  it('setColumnWidth updates width for a field', () => {
    const useStore = createGridStore();
    useStore.getState().setColumnWidth('f1', 300);

    expect(useStore.getState().columnWidths).toEqual({ f1: 300 });
  });

  it('setColumnWidth preserves other column widths', () => {
    const useStore = createGridStore({ columnWidths: { f1: 200 } });
    useStore.getState().setColumnWidth('f2', 300);

    expect(useStore.getState().columnWidths).toEqual({ f1: 200, f2: 300 });
  });

  it('reorderColumn moves a field to a new position', () => {
    const useStore = createGridStore({
      columnOrder: ['f1', 'f2', 'f3', 'f4'],
    });
    useStore.getState().reorderColumn('f3', 1);

    expect(useStore.getState().columnOrder).toEqual(['f1', 'f3', 'f2', 'f4']);
  });

  it('reorderColumn does nothing for unknown field', () => {
    const useStore = createGridStore({
      columnOrder: ['f1', 'f2'],
    });
    useStore.getState().reorderColumn('f99', 0);

    expect(useStore.getState().columnOrder).toEqual(['f1', 'f2']);
  });

  it('setFrozenCount updates frozen column count', () => {
    const useStore = createGridStore();
    useStore.getState().setFrozenCount(3);

    expect(useStore.getState().frozenColumnCount).toBe(3);
  });

  it('setColumnOrder replaces the entire column order', () => {
    const useStore = createGridStore();
    useStore.getState().setColumnOrder(['f3', 'f1', 'f2']);

    expect(useStore.getState().columnOrder).toEqual(['f3', 'f1', 'f2']);
  });
});
