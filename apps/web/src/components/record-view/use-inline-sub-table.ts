'use client';

/**
 * useInlineSubTable — manages state and data for the Inline Sub-Table widget.
 *
 * Handles: fetching linked records, inline editing, row creation,
 * row deletion, and search filtering.
 *
 * @see docs/reference/tables-and-views.md § Inline Sub-Table Display
 */

import { useState, useCallback, useMemo } from 'react';
import type { DbRecord, Field } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InlineSubTableConfig {
  style: 'inline_table';
  inline_columns: string[];
  inline_column_widths: Record<string, number>;
  allow_inline_create: boolean;
  allow_inline_delete: boolean;
  allow_reorder: boolean;
  max_visible_rows: number;
  empty_state_text: string;
}

export interface InlineSubTableRow {
  record: DbRecord;
  isNew?: boolean;
}

export interface UseInlineSubTableOptions {
  recordId: string;
  fieldId: string;
  config: InlineSubTableConfig;
  linkedRecords: DbRecord[];
  targetFields: Field[];
  canCreate: boolean;
  canDelete: boolean;
  onCreateRecord?: (canonicalData: Record<string, unknown>) => void;
  onDeleteLink?: (targetRecordId: string) => void;
  onUpdateLinkedRecord?: (
    targetRecordId: string,
    fieldId: string,
    value: unknown,
  ) => void;
}

export interface UseInlineSubTableResult {
  /** Visible columns (filtered by inline_columns config) */
  visibleColumns: Field[];
  /** Column widths map */
  columnWidths: Record<string, number>;
  /** Filtered rows (after search) */
  filteredRows: DbRecord[];
  /** Whether we're showing all or just max_visible_rows */
  isExpanded: boolean;
  /** Total record count */
  totalCount: number;
  /** Visible row count (capped by max_visible_rows unless expanded) */
  visibleCount: number;
  /** Search query */
  searchQuery: string;
  /** Whether the creation row is active */
  isCreating: boolean;
  /** Data for the creation row */
  creationRowData: Record<string, unknown>;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Toggle expand/collapse */
  toggleExpanded: () => void;
  /** Start creating a new row */
  startCreating: () => void;
  /** Cancel creating */
  cancelCreating: () => void;
  /** Update a cell in the creation row */
  updateCreationCell: (fieldId: string, value: unknown) => void;
  /** Confirm creation */
  confirmCreation: () => void;
  /** Handle cell edit on an existing linked record */
  handleCellEdit: (
    targetRecordId: string,
    fieldId: string,
    value: unknown,
  ) => void;
  /** Handle row deletion */
  handleDeleteRow: (targetRecordId: string) => void;
}

// ---------------------------------------------------------------------------
// Default column width
// ---------------------------------------------------------------------------

const DEFAULT_INLINE_COLUMN_WIDTH = 150;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInlineSubTable({
  config,
  linkedRecords,
  targetFields,
  canCreate,
  canDelete: _canDelete,
  onCreateRecord,
  onDeleteLink,
  onUpdateLinkedRecord,
}: UseInlineSubTableOptions): UseInlineSubTableResult {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationRowData, setCreationRowData] = useState<
    Record<string, unknown>
  >({});

  // Resolve visible columns from config
  const visibleColumns = useMemo(() => {
    const fieldMap = new Map(targetFields.map((f) => [f.id, f]));
    return config.inline_columns
      .map((id) => fieldMap.get(id))
      .filter((f): f is Field => f != null);
  }, [targetFields, config.inline_columns]);

  // Column widths
  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    for (const col of visibleColumns) {
      widths[col.id] =
        config.inline_column_widths[col.id] ?? DEFAULT_INLINE_COLUMN_WIDTH;
    }
    return widths;
  }, [visibleColumns, config.inline_column_widths]);

  // Filter by search query (searches canonical_data values)
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return linkedRecords;
    const query = searchQuery.toLowerCase();
    return linkedRecords.filter((record) => {
      const data = record.canonicalData as Record<string, unknown> | null;
      if (!data) return false;
      return Object.values(data).some(
        (val) => val != null && String(val).toLowerCase().includes(query),
      );
    });
  }, [linkedRecords, searchQuery]);

  // Visible rows (capped unless expanded)
  const totalCount = filteredRows.length;
  const visibleCount = isExpanded
    ? totalCount
    : Math.min(totalCount, config.max_visible_rows);

  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCount),
    [filteredRows, visibleCount],
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const startCreating = useCallback(() => {
    if (!canCreate) return;
    setIsCreating(true);
    setCreationRowData({});
  }, [canCreate]);

  const cancelCreating = useCallback(() => {
    setIsCreating(false);
    setCreationRowData({});
  }, []);

  const updateCreationCell = useCallback(
    (fieldId: string, value: unknown) => {
      setCreationRowData((prev) => ({ ...prev, [fieldId]: value }));
    },
    [],
  );

  const confirmCreation = useCallback(() => {
    // Don't create if all values are empty
    const hasData = Object.values(creationRowData).some(
      (v) => v != null && v !== '',
    );
    if (!hasData) {
      cancelCreating();
      return;
    }
    onCreateRecord?.(creationRowData);
    setCreationRowData({});
    // Keep creating mode active for chaining
  }, [creationRowData, onCreateRecord, cancelCreating]);

  const handleCellEdit = useCallback(
    (targetRecordId: string, fieldId: string, value: unknown) => {
      onUpdateLinkedRecord?.(targetRecordId, fieldId, value);
    },
    [onUpdateLinkedRecord],
  );

  const handleDeleteRow = useCallback(
    (targetRecordId: string) => {
      onDeleteLink?.(targetRecordId);
    },
    [onDeleteLink],
  );

  return {
    visibleColumns,
    columnWidths,
    filteredRows: visibleRows,
    isExpanded,
    totalCount,
    visibleCount,
    searchQuery,
    isCreating,
    creationRowData,
    setSearchQuery,
    toggleExpanded,
    startCreating,
    cancelCreating,
    updateCreationCell,
    confirmCreation,
    handleCellEdit,
    handleDeleteRow,
  };
}
