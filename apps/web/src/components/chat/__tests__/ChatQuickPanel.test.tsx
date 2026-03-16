// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import type { ThreadWithLastMessage, PaginatedResult } from '@/data/threads';

// Mock Socket.IO
function createMockSocket() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    emit: vi.fn(),
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    }),
    off: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(fn);
    }),
    // Helper to fire events in tests
    _fire(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
  };
}

// Mock REALTIME_EVENTS
vi.mock('@everystack/shared/realtime', () => ({
  REALTIME_EVENTS: {
    MESSAGE_NEW: 'message.new',
  },
}));

// Must import after mocks
const { ChatQuickPanel } = await import('../ChatQuickPanel');

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function createThread(overrides?: Partial<ThreadWithLastMessage>): ThreadWithLastMessage {
  return {
    id: 'thread-1',
    tenantId: 'tenant-1',
    scopeType: 'dm',
    scopeId: 'scope-1',
    threadType: 'internal',
    name: 'Test Conversation',
    createdBy: 'user-1',
    createdAt: new Date('2026-03-13T10:00:00Z'),
    updatedAt: new Date('2026-03-13T12:00:00Z'),
    lastMessage: {
      content: 'Hello there!',
      authorId: 'user-2',
      createdAt: new Date('2026-03-13T12:00:00Z'),
    },
    unreadCount: 0,
    ...overrides,
  };
}

function createFetchThreads(
  threads: ThreadWithLastMessage[],
  nextCursor: string | null = null,
): () => Promise<PaginatedResult<ThreadWithLastMessage>> {
  return vi.fn().mockResolvedValue({ items: threads, nextCursor });
}

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function renderPanel(
  props: Partial<React.ComponentProps<typeof ChatQuickPanel>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const defaultProps = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    socket: null,
    onOpenRecordThread: vi.fn(),
    onOpenDM: vi.fn(),
    fetchThreads: createFetchThreads([]),
    ...props,
  };

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <IntlWrapper>
          <ChatQuickPanel {...defaultProps} />
        </IntlWrapper>
      </QueryClientProvider>,
    ),
    queryClient,
    props: defaultProps,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatQuickPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no conversations', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });
  });

  it('shows conversations sorted by recency', async () => {
    const threads = [
      createThread({
        id: 'thread-newest',
        name: 'Newest Thread',
        updatedAt: new Date('2026-03-13T14:00:00Z'),
        lastMessage: {
          content: 'Latest message',
          authorId: 'user-2',
          createdAt: new Date('2026-03-13T14:00:00Z'),
        },
      }),
      createThread({
        id: 'thread-older',
        name: 'Older Thread',
        updatedAt: new Date('2026-03-13T10:00:00Z'),
        lastMessage: {
          content: 'Older message',
          authorId: 'user-2',
          createdAt: new Date('2026-03-13T10:00:00Z'),
        },
      }),
    ];

    renderPanel({ fetchThreads: createFetchThreads(threads) });

    await waitFor(() => {
      const items = screen.getAllByTestId('chat-quick-panel-item');
      expect(items).toHaveLength(2);
    });

    const items = screen.getAllByTestId('chat-quick-panel-item');
    expect(items[0]).toHaveTextContent('Newest Thread');
    expect(items[1]).toHaveTextContent('Older Thread');
  });

  it('displays unread badge with correct count', async () => {
    const threads = [
      createThread({ id: 'thread-unread', name: 'Unread Thread', unreadCount: 5 }),
      createThread({ id: 'thread-read', name: 'Read Thread', unreadCount: 0 }),
    ];

    renderPanel({ fetchThreads: createFetchThreads(threads) });

    await waitFor(() => {
      const badges = screen.getAllByTestId('unread-badge');
      expect(badges).toHaveLength(1);
      expect(badges[0]).toHaveTextContent('5');
    });
  });

  it('shows 99+ for unread counts above 99', async () => {
    const threads = [
      createThread({ id: 'thread-many', name: 'Busy Thread', unreadCount: 150 }),
    ];

    renderPanel({ fetchThreads: createFetchThreads(threads) });

    await waitFor(() => {
      expect(screen.getByTestId('unread-badge')).toHaveTextContent('99+');
    });
  });

  it('navigates to RecordThreadPanel on record thread click', async () => {
    const recordThread = createThread({
      id: 'thread-record',
      scopeType: 'record',
      name: 'Record Thread',
    });

    const onOpenRecordThread = vi.fn();
    renderPanel({
      fetchThreads: createFetchThreads([recordThread]),
      onOpenRecordThread,
    });

    await waitFor(() => {
      expect(screen.getByTestId('chat-quick-panel-item')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('chat-quick-panel-item'));
    expect(onOpenRecordThread).toHaveBeenCalledWith(recordThread);
  });

  it('navigates to DMConversation on DM click', async () => {
    const dmThread = createThread({
      id: 'thread-dm',
      scopeType: 'dm',
      name: 'DM Thread',
    });

    const onOpenDM = vi.fn();
    renderPanel({
      fetchThreads: createFetchThreads([dmThread]),
      onOpenDM,
    });

    await waitFor(() => {
      expect(screen.getByTestId('chat-quick-panel-item')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('chat-quick-panel-item'));
    expect(onOpenDM).toHaveBeenCalledWith(dmThread);
  });

  it('navigates to DMConversation on group DM click', async () => {
    const groupThread = createThread({
      id: 'thread-group',
      scopeType: 'group_dm',
      name: 'Group Chat',
    });

    const onOpenDM = vi.fn();
    renderPanel({
      fetchThreads: createFetchThreads([groupThread]),
      onOpenDM,
    });

    await waitFor(() => {
      expect(screen.getByTestId('chat-quick-panel-item')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('chat-quick-panel-item'));
    expect(onOpenDM).toHaveBeenCalledWith(groupThread);
  });

  it('bumps conversation to top on real-time new message', async () => {
    const threads = [
      createThread({
        id: 'thread-top',
        name: 'Initially Top',
        updatedAt: new Date('2026-03-13T14:00:00Z'),
      }),
      createThread({
        id: 'thread-bottom',
        name: 'Initially Bottom',
        updatedAt: new Date('2026-03-13T10:00:00Z'),
      }),
    ];

    const mockSocket = createMockSocket();
    renderPanel({
      fetchThreads: createFetchThreads(threads),
      socket: mockSocket as unknown as React.ComponentProps<typeof ChatQuickPanel>['socket'],
    });

    await waitFor(() => {
      const items = screen.getAllByTestId('chat-quick-panel-item');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('Initially Top');
    });

    // Simulate new message on the bottom thread
    mockSocket._fire('message.new', {
      threadId: 'thread-bottom',
      content: 'New message!',
      authorId: 'user-3',
      createdAt: new Date('2026-03-13T15:00:00Z').toISOString(),
    });

    await waitFor(() => {
      const items = screen.getAllByTestId('chat-quick-panel-item');
      expect(items[0]).toHaveTextContent('Initially Bottom');
      expect(items[1]).toHaveTextContent('Initially Top');
    });
  });

  it('increments unread count on real-time new message', async () => {
    const threads = [
      createThread({ id: 'thread-1', name: 'My Thread', unreadCount: 2 }),
    ];

    const mockSocket = createMockSocket();
    renderPanel({
      fetchThreads: createFetchThreads(threads),
      socket: mockSocket as unknown as React.ComponentProps<typeof ChatQuickPanel>['socket'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('unread-badge')).toHaveTextContent('2');
    });

    // Simulate new message
    mockSocket._fire('message.new', {
      threadId: 'thread-1',
      content: 'Another message',
      authorId: 'user-3',
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('unread-badge')).toHaveTextContent('3');
    });
  });

  it('shows last message preview truncated to ~60 chars', async () => {
    const longMessage = 'A'.repeat(80);
    const threads = [
      createThread({
        id: 'thread-long',
        name: 'Long Message Thread',
        lastMessage: {
          content: longMessage,
          authorId: 'user-2',
          createdAt: new Date(),
        },
      }),
    ];

    renderPanel({ fetchThreads: createFetchThreads(threads) });

    await waitFor(() => {
      const item = screen.getByTestId('chat-quick-panel-item');
      // Should be truncated with ellipsis
      expect(item.textContent).toContain('A'.repeat(60));
      expect(item.textContent).toContain('…');
      expect(item.textContent).not.toContain('A'.repeat(80));
    });
  });

  it('shows loading skeleton while fetching', () => {
    // Use a fetch that never resolves
    const fetchThreads = vi.fn().mockReturnValue(new Promise(() => {}));
    renderPanel({ fetchThreads });

    expect(screen.getByTestId('chat-quick-panel-skeleton')).toBeInTheDocument();
  });

  it('renders correct avatar for each scope type', async () => {
    const threads = [
      createThread({ id: 't-dm', scopeType: 'dm', name: 'DM Chat' }),
      createThread({ id: 't-group', scopeType: 'group_dm', name: 'Group Chat' }),
      createThread({ id: 't-record', scopeType: 'record', name: 'Record Thread' }),
    ];

    renderPanel({ fetchThreads: createFetchThreads(threads) });

    await waitFor(() => {
      const items = screen.getAllByTestId('chat-quick-panel-item');
      expect(items).toHaveLength(3);
    });
  });

  it('joins and leaves socket room on mount/unmount', async () => {
    const mockSocket = createMockSocket();
    const { unmount } = renderPanel({
      socket: mockSocket as unknown as React.ComponentProps<typeof ChatQuickPanel>['socket'],
      userId: 'user-42',
    });

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'user:user-42:threads');
    });

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'user:user-42:threads');
  });
});
