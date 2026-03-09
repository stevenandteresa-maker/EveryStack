'use client';

/**
 * useCellEdit — manages the edit lifecycle for a single grid cell.
 *
 * Handles: focus, blur (auto-save), cancel (Escape), confirm (Enter/Tab),
 * and distinguishes between replace mode (single-click + type) and
 * edit mode (double-click with existing content).
 *
 * @see docs/reference/tables-and-views.md § Cell Behavior
 * @see docs/Playbooks/playbook-phase-3a-i.md § Prompt 6
 */

import { useState, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditMode = 'replace' | 'edit';

export interface UseCellEditOptions {
  /** Current field value from canonical data */
  value: unknown;
  /** Whether the field is read-only */
  readOnly: boolean;
  /** Called with the new value on save */
  onSave: (value: unknown) => void;
  /** Called when editing is cancelled */
  onCancel: () => void;
  /** Called on Enter to move to next row */
  onMoveDown?: () => void;
  /** Called on Tab to move to next column */
  onMoveRight?: () => void;
}

export interface UseCellEditResult {
  /** Whether the cell is currently in edit mode */
  isEditing: boolean;
  /** The current edit mode (replace clears content, edit preserves it) */
  editMode: EditMode;
  /** The current local value being edited */
  localValue: unknown;
  /** Update the local value during editing */
  setLocalValue: (value: unknown) => void;
  /** Enter replace mode (single-click + type) */
  startReplace: () => void;
  /** Enter edit mode (double-click, preserves content) */
  startEdit: () => void;
  /** Save and exit edit mode */
  save: () => void;
  /** Cancel and revert to original value */
  cancel: () => void;
  /** Handle keydown events (Enter, Tab, Escape) */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Handle blur (auto-save) */
  handleBlur: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCellEdit({
  value,
  readOnly,
  onSave,
  onCancel,
  onMoveDown,
  onMoveRight,
}: UseCellEditOptions): UseCellEditResult {
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>('edit');
  const [localValue, setLocalValue] = useState<unknown>(value);
  const [originalValue, setOriginalValue] = useState<unknown>(value);
  const [trackedValue, setTrackedValue] = useState<unknown>(value);
  const isSavingRef = useRef(false);

  // Keep local value in sync when the external value changes while not editing.
  // Uses state-based sync pattern to satisfy react-hooks/refs lint rule.
  if (!isEditing && trackedValue !== value) {
    setTrackedValue(value);
    setLocalValue(value);
  }

  const startReplace = useCallback(() => {
    if (readOnly) return;
    setEditMode('replace');
    setLocalValue('');
    setOriginalValue(value);
    setIsEditing(true);
  }, [readOnly, value]);

  const startEdit = useCallback(() => {
    if (readOnly) return;
    setEditMode('edit');
    setLocalValue(value);
    setOriginalValue(value);
    setIsEditing(true);
  }, [readOnly, value]);

  const save = useCallback(() => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    setIsEditing(false);
    // Only save if value actually changed
    if (localValue !== originalValue) {
      onSave(localValue);
    } else {
      onCancel();
    }

    isSavingRef.current = false;
  }, [localValue, originalValue, onSave, onCancel]);

  const cancel = useCallback(() => {
    setIsEditing(false);
    setLocalValue(originalValue);
    onCancel();
  }, [originalValue, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        save();
        onMoveDown?.();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        save();
        onMoveRight?.();
      }
    },
    [cancel, save, onMoveDown, onMoveRight],
  );

  const handleBlur = useCallback(() => {
    if (isEditing) {
      save();
    }
  }, [isEditing, save]);

  return {
    isEditing,
    editMode,
    localValue,
    setLocalValue,
    startReplace,
    startEdit,
    save,
    cancel,
    handleKeyDown,
    handleBlur,
  };
}
