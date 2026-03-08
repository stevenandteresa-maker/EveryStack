'use client';

/**
 * NewRowInput — persistent empty row pinned at the bottom of the grid.
 *
 * Airtable-style: click to start typing in the primary field. Creates a
 * record via the createRecord Server Action on first input. After creation,
 * a new empty row takes its place.
 *
 * @see docs/reference/tables-and-views.md § Row Behavior — New row creation
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  GRID_TOKENS,
  DRAG_HANDLE_WIDTH,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_WIDTH,
} from './grid-types';
import type { GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NewRowInputProps {
  fields: GridField[];
  rowHeight: number;
  totalWidth: number;
  rowCount: number;
  /** Called on first keystroke (Airtable-style). */
  onCreateRecord: (primaryFieldId: string, initialValue: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewRowInput({
  fields,
  rowHeight,
  totalWidth,
  rowCount,
  onCreateRecord,
}: NewRowInputProps) {
  const t = useTranslations('grid');
  const [inputValue, setInputValue] = useState('');
  const [isActive, setIsActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const primaryField = fields.find((f) => f.isPrimary);
  const primaryFieldWidth = primaryField
    ? 280 // Default primary field width
    : 200;
  // Track whether we already fired the create for this input session
  const hasFiredRef = useRef(false);

  const handleClick = useCallback(() => {
    setIsActive(true);
    hasFiredRef.current = false;
    // Defer focus to allow state update and render
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  /**
   * Airtable-style: fire onCreateRecord on the first keystroke, not on
   * Enter / blur. Subsequent keystrokes just update the local input value
   * — the parent is responsible for patching the record's primary field.
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      if (!hasFiredRef.current && value.length > 0 && primaryField) {
        hasFiredRef.current = true;
        onCreateRecord(primaryField.id, value);
      }
    },
    [primaryField, onCreateRecord],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        // Reset for next row entry
        setInputValue('');
        hasFiredRef.current = false;
      } else if (e.key === 'Escape') {
        setInputValue('');
        setIsActive(false);
        hasFiredRef.current = false;
        inputRef.current?.blur();
      }
    },
    [],
  );

  const handleBlur = useCallback(() => {
    setInputValue('');
    setIsActive(false);
    hasFiredRef.current = false;
  }, []);

  return (
    <div
      className="flex border-b"
      style={{
        height: rowHeight,
        width: totalWidth,
        borderColor: GRID_TOKENS.borderDefault,
        backgroundColor: GRID_TOKENS.rowStripeEven,
      }}
    >
      {/* Drag handle placeholder */}
      <div
        className="shrink-0 border-r"
        style={{
          width: DRAG_HANDLE_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
        }}
      />

      {/* Checkbox placeholder */}
      <div
        className="shrink-0 border-r"
        style={{
          width: CHECKBOX_COLUMN_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
        }}
      />

      {/* Row number (+ icon) */}
      <div
        className="shrink-0 flex items-center justify-center border-r text-xs cursor-pointer"
        style={{
          width: ROW_NUMBER_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
          color: GRID_TOKENS.textSecondary,
        }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={t('new_row')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
      >
        +
      </div>

      {/* Primary field input */}
      <div
        className={cn(
          'flex items-center border-r px-3',
          isActive && 'ring-2 ring-inset z-10',
        )}
        style={{
          width: primaryFieldWidth,
          borderColor: GRID_TOKENS.borderDefault,
          ...(isActive
            ? ({ '--tw-ring-color': GRID_TOKENS.activeCellBorder } as React.CSSProperties)
            : {}),
        }}
        onClick={handleClick}
      >
        {isActive ? (
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: GRID_TOKENS.textPrimary }}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={t('new_row_placeholder')}
          />
        ) : (
          <span
            className="text-sm cursor-pointer"
            style={{ color: GRID_TOKENS.textSecondary }}
          >
            {rowCount + 1}
          </span>
        )}
      </div>
    </div>
  );
}
