/**
 * Grid component types and constants.
 *
 * Default column widths by field type — sourced from tables-and-views.md § Column Behavior.
 * Design tokens for grid rendering.
 *
 * @see docs/reference/tables-and-views.md lines 166–188
 */

// ---------------------------------------------------------------------------
// Default column widths by field type (px)
// ---------------------------------------------------------------------------

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  // Text types
  text_primary: 280,
  text: 200,
  textarea: 240,

  // Numeric types
  number: 120,
  currency: 120,
  percent: 120,

  // Date types
  date: 140,
  datetime: 180,

  // Selection types
  single_select: 160,
  multi_select: 200,

  // Boolean / rating
  checkbox: 60,
  rating: 100,

  // People
  people: 160,

  // Contact / URL
  phone: 180,
  email: 180,
  url: 180,

  // File
  attachment: 120,

  // Linked record
  linked_record: 200,

  // Rich text
  smart_doc: 200,

  // Other
  duration: 100,
  barcode: 140,
} as const;

/** Fallback width for field types not in the map. */
export const DEFAULT_COLUMN_WIDTH_FALLBACK = 160;

/**
 * Resolve the default width for a field type.
 * Primary fields get a wider default (280px).
 */
export function getDefaultColumnWidth(
  fieldType: string,
  isPrimary: boolean,
): number {
  if (isPrimary && fieldType === 'text') {
    return DEFAULT_COLUMN_WIDTHS['text_primary'] ?? DEFAULT_COLUMN_WIDTH_FALLBACK;
  }
  return DEFAULT_COLUMN_WIDTHS[fieldType] ?? DEFAULT_COLUMN_WIDTH_FALLBACK;
}

// ---------------------------------------------------------------------------
// Fixed column widths
// ---------------------------------------------------------------------------

/** Drag handle column width (visible on hover). */
export const DRAG_HANDLE_WIDTH = 28;

/** Checkbox column width. */
export const CHECKBOX_COLUMN_WIDTH = 40;

/** Row number column width. */
export const ROW_NUMBER_WIDTH = 52;

/** "+" (add field) column width. */
export const ADD_FIELD_COLUMN_WIDTH = 44;

// ---------------------------------------------------------------------------
// Virtualization constants
// ---------------------------------------------------------------------------

/** Number of rows to render above and below the visible area. */
export const ROW_OVERSCAN = 10;

/** Number of columns to render before and after the visible area. */
export const COLUMN_OVERSCAN = 3;

/** Maximum user-frozen columns (excluding primary which is always frozen). */
export const MAX_FROZEN_COLUMNS = 5;

// ---------------------------------------------------------------------------
// Design tokens (grid-specific)
// ---------------------------------------------------------------------------

export const GRID_TOKENS = {
  borderDefault: '#E2E8F0',
  panelBg: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  rowHover: '#F1F5F9',
  rowStripeEven: '#FFFFFF',
  rowStripeOdd: '#F8FAFC',
  activeCellBorder: '#3B82F6',
} as const;

// ---------------------------------------------------------------------------
// Grid cell state types
// ---------------------------------------------------------------------------

export interface CellPosition {
  rowId: string;
  fieldId: string;
}
