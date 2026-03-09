// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboard } from '../use-clipboard';
import type { GridRecord, GridField } from '@/lib/types/grid';
import type { CellPosition } from '../grid-types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// ---------------------------------------------------------------------------
// Mock navigator.clipboard
// ---------------------------------------------------------------------------

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(''),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function makeRecord(id: string, data: Record<string, unknown>): GridRecord {
  return {
    id,
    tenantId: 't1',
    tableId: 'table1',
    canonicalData: data,
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    syncMetadata: null,
    searchVector: null,
  } as GridRecord;
}

function makeField(
  id: string,
  fieldType: string,
  opts?: Partial<GridField>,
): GridField {
  return {
    id,
    name: `Field ${id}`,
    fieldType,
    isPrimary: false,
    readOnly: false,
    sortOrder: 0,
    tableId: 'table1',
    tenantId: 't1',
    ...opts,
  } as GridField;
}

const fields: GridField[] = [
  makeField('f1', 'text', { isPrimary: true }),
  makeField('f2', 'number'),
  makeField('f3', 'checkbox'),
];

const records: GridRecord[] = [
  makeRecord('r1', { f1: 'Alice', f2: 42, f3: true }),
  makeRecord('r2', { f1: 'Bob', f2: 99, f3: false }),
  makeRecord('r3', { f1: 'Carol', f2: 7, f3: true }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useClipboard', () => {
  let onUpdateCell: (recordId: string, fieldId: string, value: unknown) => void;
  let onShowToast: (message: string) => void;

  beforeEach(() => {
    onUpdateCell = vi.fn<(recordId: string, fieldId: string, value: unknown) => void>();
    onShowToast = vi.fn<(message: string) => void>();
    mockClipboard.writeText.mockReset();
    mockClipboard.readText.mockReset();
  });

  function setup(
    activeCell: CellPosition | null = null,
    selectionAnchor: CellPosition | null = null,
    selectionRange: CellPosition | null = null,
  ) {
    return renderHook(() =>
      useClipboard({
        records,
        fields,
        activeCell,
        selectionAnchor,
        selectionRange,
        onUpdateCell,
        onShowToast,
      }),
    );
  }

  describe('handleCopy', () => {
    it('copies a single cell value to clipboard', () => {
      const { result } = setup({ rowId: 'r1', fieldId: 'f1' });

      act(() => {
        result.current.handleCopy();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith('Alice');
    });

    it('copies a range of cells as TSV', () => {
      const { result } = setup(
        { rowId: 'r1', fieldId: 'f1' },
        { rowId: 'r1', fieldId: 'f1' },
        { rowId: 'r2', fieldId: 'f2' },
      );

      act(() => {
        result.current.handleCopy();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        'Alice\t42\nBob\t99',
      );
    });

    it('does nothing when no cell is active', () => {
      const { result } = setup(null);

      act(() => {
        result.current.handleCopy();
      });

      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('handlePaste', () => {
    it('pastes text into a single cell', async () => {
      mockClipboard.readText.mockResolvedValue('Hello');
      const { result } = setup({ rowId: 'r1', fieldId: 'f1' });

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(onUpdateCell).toHaveBeenCalledWith('r1', 'f1', 'Hello');
    });

    it('coerces text to number for number fields', async () => {
      mockClipboard.readText.mockResolvedValue('123');
      const { result } = setup({ rowId: 'r1', fieldId: 'f2' });

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(onUpdateCell).toHaveBeenCalledWith('r1', 'f2', 123);
    });

    it('coerces checkbox values', async () => {
      mockClipboard.readText.mockResolvedValue('yes');
      const { result } = setup({ rowId: 'r1', fieldId: 'f3' });

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(onUpdateCell).toHaveBeenCalledWith('r1', 'f3', true);
    });

    it('skips incompatible number values and shows toast', async () => {
      mockClipboard.readText.mockResolvedValue('abc');
      const { result } = setup({ rowId: 'r1', fieldId: 'f2' });

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(onUpdateCell).not.toHaveBeenCalled();
      expect(onShowToast).toHaveBeenCalledWith(
        expect.stringContaining('1 cell'),
      );
    });

    it('pastes multi-cell TSV into grid', async () => {
      mockClipboard.readText.mockResolvedValue('X\t10\nY\t20');
      const { result } = setup({ rowId: 'r1', fieldId: 'f1' });

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(onUpdateCell).toHaveBeenCalledWith('r1', 'f1', 'X');
      expect(onUpdateCell).toHaveBeenCalledWith('r1', 'f2', 10);
      expect(onUpdateCell).toHaveBeenCalledWith('r2', 'f1', 'Y');
      expect(onUpdateCell).toHaveBeenCalledWith('r2', 'f2', 20);
    });
  });

  describe('handleFillDown', () => {
    it('fills down the topmost cell in a range', () => {
      const { result } = setup(
        { rowId: 'r1', fieldId: 'f1' },
        { rowId: 'r1', fieldId: 'f1' },
        { rowId: 'r3', fieldId: 'f1' },
      );

      act(() => {
        result.current.handleFillDown();
      });

      expect(onUpdateCell).toHaveBeenCalledWith('r2', 'f1', 'Alice');
      expect(onUpdateCell).toHaveBeenCalledWith('r3', 'f1', 'Alice');
    });

    it('does nothing with single row selection', () => {
      const { result } = setup(
        { rowId: 'r1', fieldId: 'f1' },
        { rowId: 'r1', fieldId: 'f1' },
        { rowId: 'r1', fieldId: 'f1' },
      );

      act(() => {
        result.current.handleFillDown();
      });

      expect(onUpdateCell).not.toHaveBeenCalled();
    });

    it('skips read-only fields', () => {
      const roFields = [
        ...fields.slice(0, 2),
        makeField('f3', 'checkbox', { readOnly: true }),
      ];

      const roOnUpdateCell = vi.fn<(recordId: string, fieldId: string, value: unknown) => void>();
      const roOnShowToast = vi.fn<(message: string) => void>();
      const { result } = renderHook(() =>
        useClipboard({
          records,
          fields: roFields,
          activeCell: { rowId: 'r1', fieldId: 'f3' },
          selectionAnchor: { rowId: 'r1', fieldId: 'f3' },
          selectionRange: { rowId: 'r2', fieldId: 'f3' },
          onUpdateCell: roOnUpdateCell,
          onShowToast: roOnShowToast,
        }),
      );

      act(() => {
        result.current.handleFillDown();
      });

      expect(roOnUpdateCell).not.toHaveBeenCalled();
    });
  });
});
