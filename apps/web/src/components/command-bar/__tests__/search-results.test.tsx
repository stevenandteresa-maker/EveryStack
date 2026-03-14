// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { Command, CommandList } from '@/components/ui/command';
import { CommandBarSearchResults } from '../search-results';
import type { SearchResult, NavigationResult } from '@/lib/command-bar/types';

// Polyfill ResizeObserver + scrollIntoView for cmdk in jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() { /* noop */ }
      unobserve() { /* noop */ }
      disconnect() { /* noop */ }
    };
  }
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

afterEach(() => {
  mockPush.mockClear();
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_RECORDS: SearchResult[] = [
  {
    record_id: 'rec-1',
    table_id: 'tbl-1',
    table_name: 'Projects',
    primary_field_value: 'Alpha Project',
    rank: 0.9,
  },
  {
    record_id: 'rec-2',
    table_id: 'tbl-2',
    table_name: 'Contacts',
    primary_field_value: 'John Alpha',
    rank: 0.7,
  },
];

const MOCK_NAV_RESULTS: NavigationResult[] = [
  { entity_type: 'table', entity_id: 'tbl-1', name: 'Projects' },
  {
    entity_type: 'view',
    entity_id: 'view-1',
    name: 'Active Projects',
    parent_name: 'Projects',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSearchFns(
  records: SearchResult[] = MOCK_RECORDS,
  navResults: NavigationResult[] = MOCK_NAV_RESULTS,
) {
  return {
    searchRecordsFn: vi.fn().mockResolvedValue(records),
    searchTablesAndViewsFn: vi.fn().mockResolvedValue(navResults),
  };
}

function renderInCommand(ui: React.ReactNode) {
  return render(
    <IntlWrapper>
      <Command>
        <CommandList>{ui}</CommandList>
      </Command>
    </IntlWrapper>,
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandBarSearchResults', () => {
  it('renders nothing for empty query', () => {
    renderInCommand(
      <CommandBarSearchResults
        query=""
        workspaceId="ws-1"
        tenantId="tenant-1"
        userId="user-1"
        searchRecordsFn={vi.fn().mockResolvedValue([])}
        searchTablesAndViewsFn={vi.fn().mockResolvedValue([])}
      />,
    );
    expect(screen.queryByTestId('search-records-group')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-no-results')).not.toBeInTheDocument();
  });

  it('debounces search — does not call immediately', async () => {
    const fns = createMockSearchFns();
    renderInCommand(
      <CommandBarSearchResults
        query="alpha"
        workspaceId="ws-1"
        tenantId="tenant-1"
        userId="user-1"
        searchRecordsFn={fns.searchRecordsFn}
        searchTablesAndViewsFn={fns.searchTablesAndViewsFn}
      />,
    );
    // Check immediately — should not have been called yet (debounce = 200ms)
    expect(fns.searchRecordsFn).not.toHaveBeenCalled();
  });

  it('calls search functions after debounce', async () => {
    const fns = createMockSearchFns();
    renderInCommand(
      <CommandBarSearchResults
        query="alpha"
        workspaceId="ws-1"
        tenantId="tenant-1"
        userId="user-1"
        searchRecordsFn={fns.searchRecordsFn}
        searchTablesAndViewsFn={fns.searchTablesAndViewsFn}
      />,
    );

    await waitFor(() => {
      expect(fns.searchRecordsFn).toHaveBeenCalledWith(
        'tenant-1',
        'ws-1',
        'alpha',
        { tableId: undefined, userId: 'user-1' },
      );
    });

    expect(fns.searchTablesAndViewsFn).toHaveBeenCalledWith(
      'tenant-1',
      'ws-1',
      'alpha',
      'user-1',
    );
  });

  it('renders grouped results — records and navigation', async () => {
    const fns = createMockSearchFns();
    renderInCommand(
      <CommandBarSearchResults
        query="alpha"
        workspaceId="ws-1"
        tenantId="tenant-1"
        userId="user-1"
        searchRecordsFn={fns.searchRecordsFn}
        searchTablesAndViewsFn={fns.searchTablesAndViewsFn}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('search-records-group')).toBeInTheDocument();
    });

    expect(screen.getByTestId('search-record-rec-1')).toBeInTheDocument();
    expect(screen.getByTestId('search-record-rec-2')).toBeInTheDocument();
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();

    expect(screen.getByTestId('search-tables-group')).toBeInTheDocument();
    expect(screen.getByTestId('search-views-group')).toBeInTheDocument();
    expect(screen.getByText('Active Projects')).toBeInTheDocument();
  });

  it('shows no results message when search returns empty', async () => {
    const fns = {
      searchRecordsFn: vi.fn().mockResolvedValue([]),
      searchTablesAndViewsFn: vi.fn().mockResolvedValue([]),
    };

    renderInCommand(
      <CommandBarSearchResults
        query="zzzznonexistent"
        workspaceId="ws-1"
        tenantId="tenant-1"
        userId="user-1"
        searchRecordsFn={fns.searchRecordsFn}
        searchTablesAndViewsFn={fns.searchTablesAndViewsFn}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('search-no-results')).toBeInTheDocument();
    });
  });

  it('passes scopedTableId to searchRecords when provided', async () => {
    const fns = createMockSearchFns();
    renderInCommand(
      <CommandBarSearchResults
        query="alpha"
        scopedTableId="tbl-scoped"
        workspaceId="ws-1"
        tenantId="tenant-1"
        userId="user-1"
        searchRecordsFn={fns.searchRecordsFn}
        searchTablesAndViewsFn={fns.searchTablesAndViewsFn}
      />,
    );

    await waitFor(() => {
      expect(fns.searchRecordsFn).toHaveBeenCalledWith(
        'tenant-1',
        'ws-1',
        'alpha',
        { tableId: 'tbl-scoped', userId: 'user-1' },
      );
    });
  });

  it('debounce prevents excessive queries on rapid input changes', async () => {
    const fns = createMockSearchFns();

    const { rerender } = render(
      <IntlWrapper>
        <Command>
          <CommandList>
            <CommandBarSearchResults
              query="a"
              workspaceId="ws-1"
              tenantId="tenant-1"
              userId="user-1"
              searchRecordsFn={fns.searchRecordsFn}
              searchTablesAndViewsFn={fns.searchTablesAndViewsFn}
            />
          </CommandList>
        </Command>
      </IntlWrapper>,
    );

    // Rapid re-renders within debounce window
    await act(async () => { await delay(50); });
    rerender(
      <IntlWrapper>
        <Command>
          <CommandList>
            <CommandBarSearchResults
              query="al"
              workspaceId="ws-1"
              tenantId="tenant-1"
              userId="user-1"
              searchRecordsFn={fns.searchRecordsFn}
              searchTablesAndViewsFn={fns.searchTablesAndViewsFn}
            />
          </CommandList>
        </Command>
      </IntlWrapper>,
    );

    await act(async () => { await delay(50); });
    rerender(
      <IntlWrapper>
        <Command>
          <CommandList>
            <CommandBarSearchResults
              query="alpha"
              workspaceId="ws-1"
              tenantId="tenant-1"
              userId="user-1"
              searchRecordsFn={fns.searchRecordsFn}
              searchTablesAndViewsFn={fns.searchTablesAndViewsFn}
            />
          </CommandList>
        </Command>
      </IntlWrapper>,
    );

    // Wait for debounce to fire (200ms from last change)
    await waitFor(() => {
      expect(fns.searchRecordsFn).toHaveBeenCalled();
    });

    // Should only fire once for final query "alpha"
    expect(fns.searchRecordsFn).toHaveBeenCalledTimes(1);
    expect(fns.searchRecordsFn).toHaveBeenCalledWith(
      'tenant-1',
      'ws-1',
      'alpha',
      expect.any(Object),
    );
  });

  it('navigates to record view on record selection', async () => {
    const fns = createMockSearchFns();
    renderInCommand(
      <CommandBarSearchResults
        query="alpha"
        workspaceId="ws-1"
        tenantId="tenant-1"
        userId="user-1"
        searchRecordsFn={fns.searchRecordsFn}
        searchTablesAndViewsFn={fns.searchTablesAndViewsFn}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('search-record-rec-1')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('search-record-rec-1').click();
    });

    expect(mockPush).toHaveBeenCalledWith(
      '/workspace/ws-1/table/tbl-1/record/rec-1',
    );
  });
});
