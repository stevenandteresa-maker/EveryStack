'use client';

/**
 * Undo/redo hook for grid cell edits.
 *
 * @see docs/reference/tables-and-views.md § Cell Behavior — Undo/redo
 */

import { useCallback, useEffect, useRef } from 'react';

/** A single cell edit operation stored on the undo/redo stacks. */
export interface UndoRedoEntry {
  recordId: string;
  fieldId: string;
  oldValue: unknown;
  newValue: unknown;
}

const MAX_STACK_DEPTH = 50;

interface UseUndoRedoOptions {
  onApply: (recordId: string, fieldId: string, value: unknown) => void;
}

export function useUndoRedo({ onApply }: UseUndoRedoOptions) {
  const undoStackRef = useRef<UndoRedoEntry[]>([]);
  const redoStackRef = useRef<UndoRedoEntry[]>([]);

  // Store onApply in a ref so callbacks don't go stale
  const onApplyRef = useRef(onApply);
  useEffect(() => {
    onApplyRef.current = onApply;
  }, [onApply]);

  const canUndo = useCallback(() => undoStackRef.current.length > 0, []);

  const canRedo = useCallback(() => redoStackRef.current.length > 0, []);

  const pushEdit = useCallback(
    (recordId: string, fieldId: string, oldValue: unknown, newValue: unknown) => {
      const entry: UndoRedoEntry = { recordId, fieldId, oldValue, newValue };

      undoStackRef.current = [...undoStackRef.current, entry].slice(
        -MAX_STACK_DEPTH,
      );

      // Clear redo stack on new edit
      redoStackRef.current = [];
    },
    [],
  );

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;

    const entry = stack[stack.length - 1]!;
    undoStackRef.current = stack.slice(0, -1);

    redoStackRef.current = [...redoStackRef.current, entry].slice(
      -MAX_STACK_DEPTH,
    );

    onApplyRef.current(entry.recordId, entry.fieldId, entry.oldValue);
  }, []);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;

    const entry = stack[stack.length - 1]!;
    redoStackRef.current = stack.slice(0, -1);

    undoStackRef.current = [...undoStackRef.current, entry].slice(
      -MAX_STACK_DEPTH,
    );

    onApplyRef.current(entry.recordId, entry.fieldId, entry.newValue);
  }, []);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
  }, []);

  return { pushEdit, undo, redo, canUndo, canRedo, clear } as const;
}
