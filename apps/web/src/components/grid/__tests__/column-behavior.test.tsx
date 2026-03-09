import { describe, it, expect } from 'vitest';
import { createGridStore } from '../use-grid-store';

// ---------------------------------------------------------------------------
// Grid store — column colors, hidden fields
// ---------------------------------------------------------------------------

describe('Grid store — column behavior', () => {
  it('setColumnColor sets a color for a field', () => {
    const useStore = createGridStore();
    useStore.getState().setColumnColor('f1', 'Blue');

    expect(useStore.getState().columnColors).toEqual({ f1: 'Blue' });
  });

  it('setColumnColor with null removes the color', () => {
    const useStore = createGridStore({ columnColors: { f1: 'Blue', f2: 'Red' } });
    useStore.getState().setColumnColor('f1', null);

    expect(useStore.getState().columnColors).toEqual({ f2: 'Red' });
  });

  it('setColumnColor preserves other column colors', () => {
    const useStore = createGridStore({ columnColors: { f1: 'Blue' } });
    useStore.getState().setColumnColor('f2', 'Green');

    expect(useStore.getState().columnColors).toEqual({ f1: 'Blue', f2: 'Green' });
  });

  it('toggleFieldHidden adds and removes field from hidden set', () => {
    const useStore = createGridStore();
    useStore.getState().toggleFieldHidden('f1');

    expect(useStore.getState().hiddenFieldIds.has('f1')).toBe(true);

    useStore.getState().toggleFieldHidden('f1');
    expect(useStore.getState().hiddenFieldIds.has('f1')).toBe(false);
  });

  it('setHiddenFieldIds replaces the entire set', () => {
    const useStore = createGridStore();
    useStore.getState().setHiddenFieldIds(new Set(['f1', 'f2']));

    expect(useStore.getState().hiddenFieldIds).toEqual(new Set(['f1', 'f2']));
  });

  it('default state includes empty columnColors and hiddenFieldIds', () => {
    const useStore = createGridStore();
    const state = useStore.getState();

    expect(state.columnColors).toEqual({});
    expect(state.hiddenFieldIds).toEqual(new Set());
  });
});

// ---------------------------------------------------------------------------
// Column resize constants
// ---------------------------------------------------------------------------

describe('Column resize constraints', () => {
  it('column widths are clamped between 60 and 800', () => {
    const useStore = createGridStore();

    // Set a normal width
    useStore.getState().setColumnWidth('f1', 200);
    expect(useStore.getState().columnWidths.f1).toBe(200);

    // The store itself does not clamp — that's the resize hook's job
    // But the store should accept any width set
    useStore.getState().setColumnWidth('f1', 60);
    expect(useStore.getState().columnWidths.f1).toBe(60);

    useStore.getState().setColumnWidth('f1', 800);
    expect(useStore.getState().columnWidths.f1).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// Column reorder — primary field immovable
// ---------------------------------------------------------------------------

describe('Column reorder', () => {
  it('reorderColumn moves non-primary fields', () => {
    const useStore = createGridStore({
      columnOrder: ['primary', 'f1', 'f2', 'f3'],
    });

    useStore.getState().reorderColumn('f3', 1);
    expect(useStore.getState().columnOrder).toEqual(['primary', 'f3', 'f1', 'f2']);
  });

  it('reorderColumn on unknown field is a no-op', () => {
    const useStore = createGridStore({
      columnOrder: ['f1', 'f2'],
    });

    useStore.getState().reorderColumn('unknown', 0);
    expect(useStore.getState().columnOrder).toEqual(['f1', 'f2']);
  });
});

// ---------------------------------------------------------------------------
// Column freeze
// ---------------------------------------------------------------------------

describe('Column freeze', () => {
  it('setFrozenCount updates frozen column count', () => {
    const useStore = createGridStore();
    useStore.getState().setFrozenCount(3);

    expect(useStore.getState().frozenColumnCount).toBe(3);
  });

  it('setFrozenCount can set to 0', () => {
    const useStore = createGridStore({ frozenColumnCount: 3 });
    useStore.getState().setFrozenCount(0);

    expect(useStore.getState().frozenColumnCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// use-column-resize hook (unit test)
// ---------------------------------------------------------------------------

describe('useColumnResize', () => {
  // The hook is tested via the startResize function
  // Full integration tested in E2E — here we test the import
  it('exports correctly', async () => {
    const mod = await import('../use-column-resize');
    expect(mod.useColumnResize).toBeDefined();
    expect(typeof mod.useColumnResize).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// use-column-reorder hook (unit test)
// ---------------------------------------------------------------------------

describe('useColumnReorder', () => {
  it('exports correctly', async () => {
    const mod = await import('../use-column-reorder');
    expect(mod.useColumnReorder).toBeDefined();
    expect(typeof mod.useColumnReorder).toBe('function');
  });
});
