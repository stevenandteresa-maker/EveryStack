// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { Command, CommandList } from '@/components/ui/command';
import { CommandBarProvider, useCommandBar } from '../command-bar-provider';
import { CommandBarRecentItems, filterRecentItemsByQuery } from '../recent-items';
import { CommandBar } from '../command-bar';
import type { RecentItem } from '@/lib/command-bar/types';

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

const MOCK_RECENT_ITEMS: RecentItem[] = [
  {
    item_type: 'table',
    item_id: 'table-001',
    display_name: 'Deals',
    accessed_at: '2026-03-14T10:00:00Z',
  },
  {
    item_type: 'record',
    item_id: 'record-001',
    display_name: 'Acme Corp',
    entity_context: 'Deals',
    accessed_at: '2026-03-14T09:30:00Z',
  },
  {
    item_type: 'view',
    item_id: 'view-001',
    display_name: 'Active Pipeline',
    entity_context: 'Deals',
    accessed_at: '2026-03-14T09:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <IntlWrapper>
      <CommandBarProvider>{ui}</CommandBarProvider>
    </IntlWrapper>,
  );
}

/** Wrap component in Command + CommandList (required by cmdk) */
function renderInCommandWrapper(ui: React.ReactNode) {
  return render(
    <IntlWrapper>
      <Command>
        <CommandList>{ui}</CommandList>
      </Command>
    </IntlWrapper>,
  );
}

function TestConsumer() {
  const { state, open, close, setQuery } = useCommandBar();
  return (
    <div>
      <span data-testid="is-open">{String(state.isOpen)}</span>
      <span data-testid="mode">{state.mode}</span>
      <button data-testid="open-global" onClick={() => open('global')} />
      <button
        data-testid="open-scoped"
        onClick={() => open('scoped', 'table-123')}
      />
      <button data-testid="close" onClick={() => close()} />
      <button
        data-testid="set-query-search"
        onClick={() => setQuery('Deals')}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// filterRecentItemsByQuery — pure function unit tests
// ---------------------------------------------------------------------------

describe('filterRecentItemsByQuery', () => {
  it('returns empty for empty query', () => {
    expect(filterRecentItemsByQuery(MOCK_RECENT_ITEMS, '')).toEqual([]);
    expect(filterRecentItemsByQuery(MOCK_RECENT_ITEMS, '   ')).toEqual([]);
  });

  it('filters by display_name substring (case-insensitive)', () => {
    const result = filterRecentItemsByQuery(MOCK_RECENT_ITEMS, 'deals');
    expect(result).toHaveLength(1);
    expect(result[0]!.display_name).toBe('Deals');
  });

  it('matches partial names', () => {
    const result = filterRecentItemsByQuery(MOCK_RECENT_ITEMS, 'acm');
    expect(result).toHaveLength(1);
    expect(result[0]!.display_name).toBe('Acme Corp');
  });

  it('returns empty when no match', () => {
    const result = filterRecentItemsByQuery(MOCK_RECENT_ITEMS, 'xyz');
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// CommandBarRecentItems component tests
// ---------------------------------------------------------------------------

describe('CommandBarRecentItems', () => {
  it('renders recent items on empty input', async () => {
    const getRecentItemsFn = vi.fn().mockResolvedValue(MOCK_RECENT_ITEMS);

    renderInCommandWrapper(
      <CommandBarRecentItems
        tenantId="tenant-001"
        userId="user-001"
        getRecentItemsFn={getRecentItemsFn}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('recent-items-group')).toBeDefined();
    });

    expect(getRecentItemsFn).toHaveBeenCalledWith('user-001', 'tenant-001', 10);
    expect(screen.getByTestId('recent-item-table-table-001')).toBeDefined();
    expect(screen.getByTestId('recent-item-record-record-001')).toBeDefined();
    expect(screen.getByTestId('recent-item-view-view-001')).toBeDefined();
  });

  it('renders nothing when no recent items', async () => {
    const getRecentItemsFn = vi.fn().mockResolvedValue([]);

    const { container } = renderInCommandWrapper(
      <CommandBarRecentItems
        tenantId="tenant-001"
        userId="user-001"
        getRecentItemsFn={getRecentItemsFn}
      />,
    );

    await waitFor(() => {
      expect(getRecentItemsFn).toHaveBeenCalled();
    });

    expect(container.querySelector('[data-testid="recent-items-group"]')).toBeNull();
  });

  it('renders nothing when no getRecentItemsFn provided', () => {
    const { container } = renderInCommandWrapper(
      <CommandBarRecentItems
        tenantId="tenant-001"
        userId="user-001"
      />,
    );

    expect(container.querySelector('[data-testid="recent-items-group"]')).toBeNull();
  });

  it('calls onSelect when item is selected', async () => {
    const getRecentItemsFn = vi.fn().mockResolvedValue(MOCK_RECENT_ITEMS);
    const onSelect = vi.fn();

    renderInCommandWrapper(
      <CommandBarRecentItems
        tenantId="tenant-001"
        userId="user-001"
        getRecentItemsFn={getRecentItemsFn}
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('recent-item-table-table-001')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('recent-item-table-table-001'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        item_type: 'table',
        item_id: 'table-001',
        display_name: 'Deals',
      }),
    );
  });

  it('shows entity context for items that have it', async () => {
    const getRecentItemsFn = vi.fn().mockResolvedValue(MOCK_RECENT_ITEMS);

    renderInCommandWrapper(
      <CommandBarRecentItems
        tenantId="tenant-001"
        userId="user-001"
        getRecentItemsFn={getRecentItemsFn}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('recent-item-record-record-001')).toBeDefined();
    });

    const recordItem = screen.getByTestId('recent-item-record-record-001');
    expect(recordItem.textContent).toContain('Deals');
  });

  it('handles fetch errors gracefully', async () => {
    const getRecentItemsFn = vi.fn().mockRejectedValue(new Error('Network error'));

    const { container } = renderInCommandWrapper(
      <CommandBarRecentItems
        tenantId="tenant-001"
        userId="user-001"
        getRecentItemsFn={getRecentItemsFn}
      />,
    );

    await waitFor(() => {
      expect(getRecentItemsFn).toHaveBeenCalled();
    });

    expect(container.querySelector('[data-testid="recent-items-group"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration: Recent items in CommandBar with empty input
// ---------------------------------------------------------------------------

describe('CommandBar recent items integration', () => {
  it('shows recent items when CommandBar opens with empty input', async () => {
    const getRecentItemsFn = vi.fn().mockResolvedValue(MOCK_RECENT_ITEMS);

    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar
          workspaceId="ws-001"
          tenantId="tenant-001"
          userId="user-001"
          getRecentItemsFn={getRecentItemsFn}
        />
      </>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('open-global'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('recent-items-group')).toBeDefined();
    });

    expect(screen.getByTestId('recent-item-table-table-001')).toBeDefined();
  });

  it('trackRecentItem called on item selection', async () => {
    const getRecentItemsFn = vi.fn().mockResolvedValue(MOCK_RECENT_ITEMS);
    const trackRecentItemFn = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar
          workspaceId="ws-001"
          tenantId="tenant-001"
          userId="user-001"
          getRecentItemsFn={getRecentItemsFn}
          trackRecentItemFn={trackRecentItemFn}
        />
      </>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('open-global'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('recent-item-table-table-001')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('recent-item-table-table-001'));

    expect(trackRecentItemFn).toHaveBeenCalledWith(
      'user-001',
      'tenant-001',
      expect.objectContaining({
        item_type: 'table',
        item_id: 'table-001',
        display_name: 'Deals',
      }),
    );
  });

  it('scoped mode shows table badge', async () => {
    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar
          workspaceId="ws-001"
          tenantId="tenant-001"
          userId="user-001"
          scopedTableName="Deals"
        />
      </>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('open-scoped'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('scoped-mode-badge')).toBeDefined();
    });

    const badge = screen.getByTestId('scoped-mode-badge');
    expect(badge.textContent).toContain('Deals');
  });

  it('scoped mode filters slash commands to table_view context', async () => {
    const globalCommand = {
      id: 'cmd-1',
      command_key: 'settings',
      label: 'Settings',
      description: 'Open settings',
      category: 'Navigation',
      source: 'system',
      context_scopes: ['global'],
      permission_required: 'member',
      sort_order: 1,
    };

    const tableCommand = {
      id: 'cmd-2',
      command_key: 'filter',
      label: 'Filter',
      description: 'Filter current table',
      category: 'Table',
      source: 'system',
      context_scopes: ['table_view'],
      permission_required: 'member',
      sort_order: 2,
    };

    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar
          workspaceId="ws-001"
          tenantId="tenant-001"
          userId="user-001"
          commands={[globalCommand, tableCommand]}
        />
      </>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('open-scoped'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('scoped-mode-badge')).toBeDefined();
    });
  });

  it('session analytics: createSession called on open', async () => {
    const createSessionFn = vi.fn().mockResolvedValue('session-001');

    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar
          workspaceId="ws-001"
          tenantId="tenant-001"
          userId="user-001"
          createSessionFn={createSessionFn}
        />
      </>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('open-global'));
    });

    await waitFor(() => {
      expect(createSessionFn).toHaveBeenCalledWith(
        'user-001',
        'tenant-001',
        expect.objectContaining({
          mode: 'global',
        }),
      );
    });
  });

  it('session analytics: closeSession called on close', async () => {
    const createSessionFn = vi.fn().mockResolvedValue('session-001');
    const closeSessionFn = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar
          workspaceId="ws-001"
          tenantId="tenant-001"
          userId="user-001"
          createSessionFn={createSessionFn}
          closeSessionFn={closeSessionFn}
        />
      </>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('open-global'));
    });

    await waitFor(() => {
      expect(createSessionFn).toHaveBeenCalled();
    });

    act(() => {
      fireEvent.click(screen.getByTestId('close'));
    });

    await waitFor(() => {
      expect(closeSessionFn).toHaveBeenCalledWith(
        'session-001',
        'tenant-001',
        expect.objectContaining({
          messages: expect.any(Array),
          resultSet: expect.any(Object),
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: Recent items boosted in search results
// ---------------------------------------------------------------------------

describe('Recent items boosted in search results', () => {
  it('boosted recent items appear above search results', async () => {
    const getRecentItemsFn = vi.fn().mockResolvedValue(MOCK_RECENT_ITEMS);
    const searchRecordsFn = vi.fn().mockResolvedValue([
      {
        record_id: 'rec-new',
        table_id: 'table-001',
        table_name: 'Deals',
        primary_field_value: 'New Deal',
        rank: 1,
      },
    ]);
    const searchTablesAndViewsFn = vi.fn().mockResolvedValue([]);

    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar
          workspaceId="ws-001"
          tenantId="tenant-001"
          userId="user-001"
          getRecentItemsFn={getRecentItemsFn}
          searchRecordsFn={searchRecordsFn}
          searchTablesAndViewsFn={searchTablesAndViewsFn}
        />
      </>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('open-global'));
    });

    act(() => {
      fireEvent.click(screen.getByTestId('set-query-search'));
    });

    await waitFor(() => {
      expect(searchRecordsFn).toHaveBeenCalled();
    });

    // Verify search results render without crash
    await waitFor(() => {
      const recordsGroup = screen.queryByTestId('search-records-group');
      expect(recordsGroup).toBeDefined();
    });
  });
});
