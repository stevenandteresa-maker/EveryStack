'use client';

/**
 * useMergeTagFields — fetches available fields for merge-tag insertion.
 *
 * Loads fields from the source table and all cross-linked target tables,
 * filters out hidden fields (via field permissions), and returns
 * MergeTagField[] grouped by table.
 *
 * @see docs/reference/smart-docs.md § Template Authoring Mode
 */

import { useCallback, useEffect, useState } from 'react';
import type { MergeTagField } from '@/lib/types/document-templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MergeTagFieldGroup {
  /** Table UUID */
  tableId: string;
  /** Table display name */
  tableName: string;
  /** Whether this is a linked table (cross-link target) */
  isLinked: boolean;
  /** Cross-link ID (only for linked tables) */
  crossLinkId?: string;
  /** Fields available for merge-tag insertion */
  fields: MergeTagField[];
}

export interface UseMergeTagFieldsOptions {
  /** Tenant ID for data access */
  tenantId: string;
  /** Source table ID (the table the document template belongs to) */
  tableId: string;
  /** User ID for permission filtering */
  userId: string;
  /** View ID for field permission resolution (optional) */
  viewId?: string;
}

export interface UseMergeTagFieldsResult {
  /** Field groups (source table first, then linked tables) */
  groups: MergeTagFieldGroup[];
  /** Whether the data is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refetch the field data */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Field types excluded from merge-tag insertion
// ---------------------------------------------------------------------------

const EXCLUDED_FIELD_TYPES = new Set([
  'attachment',
  'button',
  'linked_record',
]);

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface FetchFieldsPayload {
  tenantId: string;
  tableId: string;
  userId: string;
  viewId?: string;
}

/**
 * Fetch merge-tag fields via the server action endpoint.
 *
 * This function is called from the client — it invokes the server action
 * that performs the actual DB queries and permission filtering.
 */
async function fetchMergeTagFields(
  payload: FetchFieldsPayload,
): Promise<MergeTagFieldGroup[]> {
  const response = await fetch('/api/editor/merge-tag-fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to load merge-tag fields');
  }

  const data = (await response.json()) as { groups: MergeTagFieldGroup[] };
  return data.groups;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook that fetches and returns merge-tag fields grouped by table.
 *
 * Source table fields appear first, followed by linked tables (via cross-links).
 * Fields with the 'hidden' permission state are excluded. Non-insertable field
 * types (attachments, buttons, linked_record) are also excluded.
 */
export function useMergeTagFields(
  options: UseMergeTagFieldsOptions,
): UseMergeTagFieldsResult {
  const { tenantId, tableId, userId, viewId } = options;

  const [groups, setGroups] = useState<MergeTagFieldGroup[]>([]);
  const [isLoading, setIsLoading] = useState(
    Boolean(tenantId && tableId && userId),
  );
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  const canFetch = Boolean(tenantId && tableId && userId);

  useEffect(() => {
    if (!canFetch) return;

    let cancelled = false;

    fetchMergeTagFields({ tenantId, tableId, userId, viewId })
      .then((result) => {
        if (!cancelled) {
          // Client-side filter for excluded field types
          const filtered = result.map((group) => ({
            ...group,
            fields: group.fields.filter(
              (f) => !EXCLUDED_FIELD_TYPES.has(f.fieldType),
            ),
          }));
          setGroups(filtered);
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canFetch, tenantId, tableId, userId, viewId, fetchKey]);

  return { groups, isLoading, error, refetch };
}
