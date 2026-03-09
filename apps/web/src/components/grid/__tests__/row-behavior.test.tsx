// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import { useRowReorder } from '../use-row-reorder';
import { useUndoRedo } from '../use-undo-redo';
import { NewRowInput } from '../NewRowInput';
import type { GridRecord, GridField } from '../../../lib/types/grid';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function makeRecord(id: string): GridRecord {
  return {
    id,
    tenantId: 't1',
    tableId: 'table1',
    canonicalData: { f1: `value-${id}` },
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    syncMetadata: null,
    searchVector: null,
  } as GridRecord;
}

function makeField(id: string, opts?: Partial<GridField>): GridField {
  return {
    id,
    name: `Field ${id}`,
    fieldType: 'text',
    isPrimary: false,
    readOnly: false,
    sortOrder: 0,
    tableId: 'table1',
    tenantId: 't1',
    ...opts,
  } as GridField;
}

const records: GridRecord[] = [
  makeRecord('r1'),
  makeRecord('r2'),
  makeRecord('r3'),
];

// ---------------------------------------------------------------------------
// useRowReorder
// ---------------------------------------------------------------------------

describe('useRowReorder', () => {
  it('returns isDisabled true when sort is active', () => {
    const { result } = renderHook(() =>
      useRowReorder({
        records,
        isSortActive: true,
        onReorder: vi.fn(),
      }),
    );

    expect(result.current.isDisabled).toBe(true);
  });

  it('returns isDisabled false when sort is not active', () => {
    const { result } = renderHook(() =>
      useRowReorder({
        records,
        isSortActive: false,
        onReorder: vi.fn(),
      }),
    );

    expect(result.current.isDisabled).toBe(false);
  });

  it('tracks dragged row state', () => {
    const { result } = renderHook(() =>
      useRowReorder({
        records,
        isSortActive: false,
        onReorder: vi.fn(),
      }),
    );

    expect(result.current.draggedRowId).toBeNull();
    expect(result.current.dropTargetIndex).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useUndoRedo
// ---------------------------------------------------------------------------

describe('useUndoRedo', () => {
  let onApply: (recordId: string, fieldId: string, value: unknown) => void;

  beforeEach(() => {
    onApply = vi.fn<(recordId: string, fieldId: string, value: unknown) => void>();
  });

  it('starts with empty stacks', () => {
    const { result } = renderHook(() => useUndoRedo({ onApply }));

    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(false);
  });

  it('pushEdit adds to undo stack', () => {
    const { result } = renderHook(() => useUndoRedo({ onApply }));

    act(() => {
      result.current.pushEdit('r1', 'f1', 'old', 'new');
    });

    expect(result.current.canUndo()).toBe(true);
    expect(result.current.canRedo()).toBe(false);
  });

  it('undo calls onApply with old value', () => {
    const { result } = renderHook(() => useUndoRedo({ onApply }));

    act(() => {
      result.current.pushEdit('r1', 'f1', 'old', 'new');
    });

    act(() => {
      result.current.undo();
    });

    expect(onApply).toHaveBeenCalledWith('r1', 'f1', 'old');
    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(true);
  });

  it('redo calls onApply with new value', () => {
    const { result } = renderHook(() => useUndoRedo({ onApply }));

    act(() => {
      result.current.pushEdit('r1', 'f1', 'old', 'new');
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });

    expect(onApply).toHaveBeenCalledWith('r1', 'f1', 'new');
    expect(result.current.canUndo()).toBe(true);
    expect(result.current.canRedo()).toBe(false);
  });

  it('pushEdit clears redo stack', () => {
    const { result } = renderHook(() => useUndoRedo({ onApply }));

    act(() => {
      result.current.pushEdit('r1', 'f1', 'v1', 'v2');
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo()).toBe(true);

    act(() => {
      result.current.pushEdit('r1', 'f1', 'v2', 'v3');
    });

    expect(result.current.canRedo()).toBe(false);
  });

  it('caps undo stack at 50 entries', () => {
    const { result } = renderHook(() => useUndoRedo({ onApply }));

    act(() => {
      for (let i = 0; i < 60; i++) {
        result.current.pushEdit('r1', 'f1', `old${i}`, `new${i}`);
      }
    });

    // Undo 50 times should work
    let undoCount = 0;
    act(() => {
      while (result.current.canUndo()) {
        result.current.undo();
        undoCount++;
      }
    });

    expect(undoCount).toBe(50);
  });

  it('clear empties both stacks', () => {
    const { result } = renderHook(() => useUndoRedo({ onApply }));

    act(() => {
      result.current.pushEdit('r1', 'f1', 'old', 'new');
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo()).toBe(true);

    act(() => {
      result.current.clear();
    });

    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NewRowInput
// ---------------------------------------------------------------------------

describe('NewRowInput', () => {
  const primaryField = makeField('f1', { isPrimary: true, fieldType: 'text' });
  const fields: GridField[] = [primaryField, makeField('f2')];

  it('renders the + button and row number', () => {
    render(
      <IntlWrapper>
        <NewRowInput
          fields={fields}
          rowHeight={44}
          totalWidth={800}
          rowCount={5}
          onCreateRecord={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByRole('button', { name: /add new row/i })).toBeInTheDocument();
  });

  it('creates record on first keystroke', async () => {
    const user = userEvent.setup();
    const onCreateRecord = vi.fn();

    render(
      <IntlWrapper>
        <NewRowInput
          fields={fields}
          rowHeight={44}
          totalWidth={800}
          rowCount={5}
          onCreateRecord={onCreateRecord}
        />
      </IntlWrapper>,
    );

    // Click the + button to activate the input
    await user.click(screen.getByRole('button', { name: /add new row/i }));

    // Type the first character — should fire immediately
    const input = screen.getByPlaceholderText(/type to create/i);
    await user.type(input, 'H');

    expect(onCreateRecord).toHaveBeenCalledTimes(1);
    expect(onCreateRecord).toHaveBeenCalledWith('f1', 'H');
  });

  it('does not fire again on subsequent keystrokes in same session', async () => {
    const user = userEvent.setup();
    const onCreateRecord = vi.fn();

    render(
      <IntlWrapper>
        <NewRowInput
          fields={fields}
          rowHeight={44}
          totalWidth={800}
          rowCount={5}
          onCreateRecord={onCreateRecord}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByRole('button', { name: /add new row/i }));
    const input = screen.getByPlaceholderText(/type to create/i);
    await user.type(input, 'Hello');

    // Only fired once on the first character
    expect(onCreateRecord).toHaveBeenCalledTimes(1);
    expect(onCreateRecord).toHaveBeenCalledWith('f1', 'H');
  });

  it('resets on Enter so next keystroke creates a new record', async () => {
    const user = userEvent.setup();
    const onCreateRecord = vi.fn();

    render(
      <IntlWrapper>
        <NewRowInput
          fields={fields}
          rowHeight={44}
          totalWidth={800}
          rowCount={5}
          onCreateRecord={onCreateRecord}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByRole('button', { name: /add new row/i }));
    const input = screen.getByPlaceholderText(/type to create/i);
    await user.type(input, 'A');
    expect(onCreateRecord).toHaveBeenCalledTimes(1);

    // Press Enter to reset
    await user.keyboard('{Enter}');

    // Type again — should fire a second time
    await user.type(input, 'B');
    expect(onCreateRecord).toHaveBeenCalledTimes(2);
    expect(onCreateRecord).toHaveBeenLastCalledWith('f1', 'B');
  });
});
