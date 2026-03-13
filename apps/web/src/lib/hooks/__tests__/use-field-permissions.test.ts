// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { FieldPermissionState } from '@everystack/shared/auth';
import { useFieldPermissions } from '../use-field-permissions';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockPermissionEntries: Array<[string, FieldPermissionState]> = [
  ['field-1', 'read_write'],
  ['field-2', 'read_only'],
  ['field-3', 'hidden'],
];

let fetchResponse: { ok: boolean; status: number; data: unknown } = {
  ok: true,
  status: 200,
  data: { data: mockPermissionEntries },
};

vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: fetchResponse.ok,
    status: fetchResponse.status,
    json: () => Promise.resolve(fetchResponse.data),
  }),
));

// ---------------------------------------------------------------------------
// Test wrapper with QueryClientProvider
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFieldPermissions', () => {
  beforeEach(() => {
    fetchResponse = {
      ok: true,
      status: 200,
      data: { data: mockPermissionEntries },
    };
    vi.mocked(fetch).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially, then resolves permission map', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useFieldPermissions('view-1'), {
      wrapper: Wrapper,
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.permissionMap.size).toBe(0);

    // After fetch resolves
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.permissionMap.size).toBe(3);
    expect(result.current.permissionMap.get('field-1')).toBe('read_write');
    expect(result.current.permissionMap.get('field-2')).toBe('read_only');
    expect(result.current.permissionMap.get('field-3')).toBe('hidden');
  });

  it('calls fetch with correct URL', async () => {
    const { Wrapper } = createWrapper();

    renderHook(() => useFieldPermissions('view-abc'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/field-permissions?viewId=view-abc',
      );
    });
  });

  it('does not fetch when viewId is empty', () => {
    const { Wrapper } = createWrapper();

    renderHook(() => useFieldPermissions(''), {
      wrapper: Wrapper,
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns empty Map on fetch error', async () => {
    fetchResponse = { ok: false, status: 500, data: {} };
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useFieldPermissions('view-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Falls back to empty Map
    expect(result.current.permissionMap.size).toBe(0);
  });
});
