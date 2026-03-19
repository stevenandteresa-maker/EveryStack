// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMergeTagFields } from '../hooks/use-merge-tag-fields';
import type { MergeTagFieldGroup } from '../hooks/use-merge-tag-fields';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockGroups: MergeTagFieldGroup[] = [
  {
    tableId: 'table-1',
    tableName: 'Invoices',
    isLinked: false,
    fields: [
      { fieldId: 'f1', tableId: 'table-1', fieldName: 'Invoice Number', fieldType: 'text', isLinked: false },
      { fieldId: 'f2', tableId: 'table-1', fieldName: 'Amount', fieldType: 'currency', isLinked: false },
      { fieldId: 'f3', tableId: 'table-1', fieldName: 'Logo', fieldType: 'attachment', isLinked: false },
    ],
  },
  {
    tableId: 'table-2',
    tableName: 'Clients',
    isLinked: true,
    crossLinkId: 'cl-1',
    fields: [
      { fieldId: 'f4', tableId: 'table-2', fieldName: 'Client Name', fieldType: 'text', isLinked: true, crossLinkId: 'cl-1' },
    ],
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ groups: mockGroups }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMergeTagFields', () => {
  it('fetches fields and returns grouped results', async () => {
    const { result } = renderHook(() =>
      useMergeTagFields({
        tenantId: 'tenant-1',
        tableId: 'table-1',
        userId: 'user-1',
      }),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.groups).toHaveLength(2);
    expect(result.current.groups[0]!.tableName).toBe('Invoices');
    expect(result.current.groups[1]!.tableName).toBe('Clients');
    expect(result.current.error).toBeNull();
  });

  it('filters out excluded field types (attachment, button, linked_record)', async () => {
    const { result } = renderHook(() =>
      useMergeTagFields({
        tenantId: 'tenant-1',
        tableId: 'table-1',
        userId: 'user-1',
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Invoice group originally had 3 fields; attachment should be filtered
    const invoiceGroup = result.current.groups[0]!;
    expect(invoiceGroup.fields).toHaveLength(2);
    expect(invoiceGroup.fields.find((f) => f.fieldType === 'attachment')).toBeUndefined();
  });

  it('sends correct payload to API', async () => {
    renderHook(() =>
      useMergeTagFields({
        tenantId: 'tenant-1',
        tableId: 'table-1',
        userId: 'user-1',
        viewId: 'view-1',
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/editor/merge-tag-fields');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body).toEqual({
      tenantId: 'tenant-1',
      tableId: 'table-1',
      userId: 'user-1',
      viewId: 'view-1',
    });
  });

  it('handles fetch error gracefully', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() =>
      useMergeTagFields({
        tenantId: 'tenant-1',
        tableId: 'table-1',
        userId: 'user-1',
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load merge-tag fields');
    expect(result.current.groups).toEqual([]);
  });

  it('returns empty groups when tenantId is missing', async () => {
    const { result } = renderHook(() =>
      useMergeTagFields({
        tenantId: '',
        tableId: 'table-1',
        userId: 'user-1',
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.groups).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refetch triggers a new fetch', async () => {
    const { result } = renderHook(() =>
      useMergeTagFields({
        tenantId: 'tenant-1',
        tableId: 'table-1',
        userId: 'user-1',
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    result.current.refetch();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
