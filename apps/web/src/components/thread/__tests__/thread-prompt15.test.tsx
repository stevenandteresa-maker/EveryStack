// @vitest-environment jsdom
/**
 * Tests for Prompt 15 components: ThreadMessageList, ThreadReplyPanel,
 * ThreadSearchBar, PinnedMessagesPanel, useTypingIndicator, useThreadSearch.
 *
 * @see docs/reference/communications.md
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import type { ThreadMessage } from '@everystack/shared/db';
import type { Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => {
    const items = Array.from({ length: count }, (_, i) => ({
      index: i,
      key: `virtual-${i}`,
      start: i * 72,
      size: 72,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * 72,
      measureElement: vi.fn(),
      scrollToIndex: vi.fn(),
    };
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ enabled }: { queryFn: () => Promise<unknown>; enabled?: boolean }) => {
    if (enabled === false) return { data: [], isLoading: false };
    return { data: [], isLoading: false, isFetching: false };
  },
  useQueryClient: () => ({
    setQueryData: vi.fn(),
  }),
  useInfiniteQuery: () => ({
    data: undefined,
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  }),
}));

vi.mock('@/actions/thread-queries', () => ({
  getMessagesAction: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  markThreadReadAction: vi.fn().mockResolvedValue(undefined),
  getUnreadCountAction: vi.fn().mockResolvedValue(0),
  searchThreadMessagesAction: vi.fn().mockResolvedValue([]),
  getPinnedMessagesAction: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/components/chat/MessageItem', () => ({
  MessageItem: ({ message }: { message: { id: string; author_name: string } }) => (
    <div data-testid="message-item" data-message-id={message.id}>
      {message.author_name}
    </div>
  ),
}));

vi.mock('@/components/chat/ChatEditor', () => ({
  ChatEditor: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="chat-editor">{placeholder}</div>
  ),
}));

vi.mock('@/components/chat/EmojiReactions', () => ({
  EmojiReactions: () => null,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ThreadMessageList } from '../ThreadMessageList';
import { ThreadSearchBar } from '../ThreadSearchBar';
import { PinnedMessagesPanel } from '../PinnedMessagesPanel';
import { ThreadReplyPanel, ReplyChip } from '../ThreadReplyPanel';
import { useTypingIndicator } from '../use-typing-indicator';
import { useThreadSearch } from '../use-thread-search';
import type { UseThreadSearchResult } from '../use-thread-search';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function createTestMessage(overrides: Partial<ThreadMessage> = {}): ThreadMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: 'tenant-1',
    threadId: 'thread-1',
    authorId: 'user-1',
    authorType: 'user',
    messageType: 'message',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] },
    parentMessageId: null,
    mentions: [],
    attachments: [],
    reactions: {},
    pinnedAt: null,
    pinnedBy: null,
    sourceNoteId: null,
    editedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ThreadMessageList
// ---------------------------------------------------------------------------

describe('ThreadMessageList', () => {
  it('renders messages via virtualized list', () => {
    const messages = Array.from({ length: 5 }, (_, i) =>
      createTestMessage({ id: `msg-${i}`, authorId: `user-${i}` }),
    );

    render(
      <IntlWrapper>
        <ThreadMessageList
          messages={messages}
          currentUserId="user-0"
          isLoading={false}
          hasMore={false}
          onLoadMore={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-message-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('message-item')).toHaveLength(5);
  });

  it('renders load more button when hasMore is true', () => {
    render(
      <IntlWrapper>
        <ThreadMessageList
          messages={[createTestMessage()]}
          currentUserId="user-0"
          isLoading={false}
          hasMore={true}
          onLoadMore={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-load-more')).toBeInTheDocument();
  });

  it('calls onLoadMore when load more button clicked', () => {
    const onLoadMore = vi.fn();
    render(
      <IntlWrapper>
        <ThreadMessageList
          messages={[createTestMessage()]}
          currentUserId="user-0"
          isLoading={false}
          hasMore={true}
          onLoadMore={onLoadMore}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('thread-load-more'));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('displays typing indicator when users are typing', () => {
    render(
      <IntlWrapper>
        <ThreadMessageList
          messages={[createTestMessage()]}
          currentUserId="user-0"
          isLoading={false}
          hasMore={false}
          onLoadMore={vi.fn()}
          typingUsers={['Alice']}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('typing-indicator')).toHaveTextContent('Alice is typing');
  });

  it('does not display typing indicator when no one is typing', () => {
    render(
      <IntlWrapper>
        <ThreadMessageList
          messages={[createTestMessage()]}
          currentUserId="user-0"
          isLoading={false}
          hasMore={false}
          onLoadMore={vi.fn()}
          typingUsers={[]}
        />
      </IntlWrapper>,
    );

    expect(screen.queryByTestId('typing-indicator')).toBeNull();
  });

  it('highlights messages that match search', () => {
    const msg = createTestMessage({ id: 'msg-search' });
    render(
      <IntlWrapper>
        <ThreadMessageList
          messages={[msg]}
          currentUserId="user-0"
          isLoading={false}
          hasMore={false}
          onLoadMore={vi.fn()}
          highlightMessageIds={new Set(['msg-search'])}
        />
      </IntlWrapper>,
    );

    const highlighted = screen.getByTestId('message-item').parentElement;
    expect(highlighted?.className).toContain('bg-yellow');
  });

  it('renders >100 messages efficiently via virtualization', () => {
    const messages = Array.from({ length: 150 }, (_, i) =>
      createTestMessage({ id: `msg-${i}` }),
    );

    render(
      <IntlWrapper>
        <ThreadMessageList
          messages={messages}
          currentUserId="user-0"
          isLoading={false}
          hasMore={false}
          onLoadMore={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-message-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('message-item')).toHaveLength(150);
  });

  it('wraps source note messages in SharedNoteMessage', () => {
    const msg = createTestMessage({ sourceNoteId: 'note-1' });
    render(
      <IntlWrapper>
        <ThreadMessageList
          messages={[msg]}
          currentUserId="user-0"
          isLoading={false}
          hasMore={false}
          onLoadMore={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('shared-note-message')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ThreadSearchBar
// ---------------------------------------------------------------------------

describe('ThreadSearchBar', () => {
  const mockSearch: UseThreadSearchResult = {
    query: '',
    setQuery: vi.fn(),
    results: [],
    highlightPositions: [],
    activeMatchIndex: 0,
    totalMatches: 0,
    scrollToMatch: vi.fn(),
    nextMatch: vi.fn(),
    prevMatch: vi.fn(),
    isSearching: false,
  };

  it('renders when open', () => {
    render(
      <IntlWrapper>
        <ThreadSearchBar search={mockSearch} isOpen={true} onClose={vi.fn()} />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-search-bar')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <IntlWrapper>
        <ThreadSearchBar search={mockSearch} isOpen={false} onClose={vi.fn()} />
      </IntlWrapper>,
    );

    expect(screen.queryByTestId('thread-search-bar')).toBeNull();
  });

  it('calls setQuery on input change', () => {
    render(
      <IntlWrapper>
        <ThreadSearchBar search={mockSearch} isOpen={true} onClose={vi.fn()} />
      </IntlWrapper>,
    );

    fireEvent.change(screen.getByTestId('thread-search-input'), {
      target: { value: 'hello' },
    });

    expect(mockSearch.setQuery).toHaveBeenCalledWith('hello');
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <IntlWrapper>
        <ThreadSearchBar search={mockSearch} isOpen={true} onClose={onClose} />
      </IntlWrapper>,
    );

    fireEvent.keyDown(screen.getByTestId('thread-search-input'), {
      key: 'Escape',
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('shows match count when query has results', () => {
    const searchWithResults: UseThreadSearchResult = {
      ...mockSearch,
      query: 'hello',
      totalMatches: 3,
      activeMatchIndex: 0,
    };

    render(
      <IntlWrapper>
        <ThreadSearchBar
          search={searchWithResults}
          isOpen={true}
          onClose={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-search-count')).toHaveTextContent('1 of 3');
  });

  it('shows no results when query has zero matches', () => {
    const searchNoMatch: UseThreadSearchResult = {
      ...mockSearch,
      query: 'hello',
      totalMatches: 0,
    };

    render(
      <IntlWrapper>
        <ThreadSearchBar
          search={searchNoMatch}
          isOpen={true}
          onClose={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-search-count')).toHaveTextContent('No results');
  });

  it('navigates between matches via buttons', () => {
    const searchWithResults: UseThreadSearchResult = {
      ...mockSearch,
      query: 'hello',
      totalMatches: 3,
    };

    render(
      <IntlWrapper>
        <ThreadSearchBar
          search={searchWithResults}
          isOpen={true}
          onClose={vi.fn()}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('thread-search-next'));
    expect(searchWithResults.nextMatch).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('thread-search-prev'));
    expect(searchWithResults.prevMatch).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PinnedMessagesPanel
// ---------------------------------------------------------------------------

describe('PinnedMessagesPanel', () => {
  it('renders when open', () => {
    render(
      <IntlWrapper>
        <PinnedMessagesPanel
          threadId="thread-1"
          isOpen={true}
          onClose={vi.fn()}
          onScrollToMessage={vi.fn()}
          fetchPinned={() => Promise.resolve([])}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('pinned-messages-panel')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <IntlWrapper>
        <PinnedMessagesPanel
          threadId="thread-1"
          isOpen={false}
          onClose={vi.fn()}
          onScrollToMessage={vi.fn()}
          fetchPinned={() => Promise.resolve([])}
        />
      </IntlWrapper>,
    );

    expect(screen.queryByTestId('pinned-messages-panel')).toBeNull();
  });

  it('shows empty state when no pinned messages', () => {
    render(
      <IntlWrapper>
        <PinnedMessagesPanel
          threadId="thread-1"
          isOpen={true}
          onClose={vi.fn()}
          onScrollToMessage={vi.fn()}
          fetchPinned={() => Promise.resolve([])}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('No pinned messages.')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <IntlWrapper>
        <PinnedMessagesPanel
          threadId="thread-1"
          isOpen={true}
          onClose={onClose}
          onScrollToMessage={vi.fn()}
          fetchPinned={() => Promise.resolve([])}
        />
      </IntlWrapper>,
    );

    const closeBtn = screen.getByLabelText('Close thread panel');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useTypingIndicator
// ---------------------------------------------------------------------------

describe('useTypingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function TestComponent({
    socket,
    threadId,
  }: {
    socket: unknown;
    threadId: string;
  }) {
    const { typingUsers, startTyping } = useTypingIndicator({
      threadId,
      socket: socket as Socket,
      currentUserId: 'me',
      currentUserName: 'Me',
    });
    return (
      <div>
        <button data-testid="start-typing" onClick={startTyping} />
        <span data-testid="typing-users">{typingUsers.join(', ')}</span>
      </div>
    );
  }

  it('emits typing:start after debounce', () => {
    const emit = vi.fn();
    const on = vi.fn();
    const off = vi.fn();
    const socket = { emit, on, off };

    render(
      <IntlWrapper>
        <TestComponent socket={socket} threadId="thread-1" />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('start-typing'));

    // Before debounce: no emit
    expect(emit).not.toHaveBeenCalled();

    // After 500ms debounce
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(emit).toHaveBeenCalledWith('typing.start', expect.objectContaining({
      threadId: 'thread-1',
      userId: 'me',
    }));
  });

  it('emits typing:stop after 3s timeout', () => {
    const emit = vi.fn();
    const on = vi.fn();
    const off = vi.fn();
    const socket = { emit, on, off };

    render(
      <IntlWrapper>
        <TestComponent socket={socket} threadId="thread-1" />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('start-typing'));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(emit).toHaveBeenCalledWith('typing.stop', expect.objectContaining({
      threadId: 'thread-1',
      userId: 'me',
    }));
  });

  it('tracks other users typing via socket events', () => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    const socket = {
      emit: vi.fn(),
      on: (event: string, handler: (...args: unknown[]) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      },
      off: vi.fn(),
    };

    render(
      <IntlWrapper>
        <TestComponent socket={socket} threadId="thread-1" />
      </IntlWrapper>,
    );

    act(() => {
      listeners['typing.start']?.forEach((fn) =>
        fn({ threadId: 'thread-1', userId: 'other-user', userName: 'Alice' }),
      );
    });

    expect(screen.getByTestId('typing-users')).toHaveTextContent('Alice');
  });
});

// ---------------------------------------------------------------------------
// useThreadSearch
// ---------------------------------------------------------------------------

describe('useThreadSearch', () => {
  function TestSearchComponent({
    messages,
    allLoaded,
  }: {
    messages: ThreadMessage[];
    allLoaded: boolean;
  }) {
    const search = useThreadSearch({
      threadId: 'thread-1',
      messages,
      allLoaded,
      searchAction: vi.fn().mockResolvedValue([]),
    });

    return (
      <div>
        <input
          data-testid="search-input"
          value={search.query}
          onChange={(e) => search.setQuery(e.target.value)}
        />
        <span data-testid="result-count">{search.results.length}</span>
        <span data-testid="total-matches">{search.totalMatches}</span>
      </div>
    );
  }

  it('filters messages client-side when all loaded', () => {
    const messages = [
      createTestMessage({
        id: 'msg-1',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello Alice' }] }] },
      }),
      createTestMessage({
        id: 'msg-2',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi Bob' }] }] },
      }),
    ];

    render(
      <IntlWrapper>
        <TestSearchComponent messages={messages} allLoaded={true} />
      </IntlWrapper>,
    );

    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'Alice' },
    });

    expect(screen.getByTestId('result-count')).toHaveTextContent('1');
  });

  it('returns empty results when query is empty', () => {
    const messages = [createTestMessage()];

    render(
      <IntlWrapper>
        <TestSearchComponent messages={messages} allLoaded={true} />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('result-count')).toHaveTextContent('0');
  });
});

// ---------------------------------------------------------------------------
// ThreadReplyPanel
// ---------------------------------------------------------------------------

describe('ThreadReplyPanel', () => {
  it('renders with parent message and reply input', () => {
    const parentMessage = createTestMessage({ id: 'parent-1' });

    render(
      <IntlWrapper>
        <ThreadReplyPanel
          parentMessage={parentMessage}
          threadId="thread-1"
          socket={null}
          currentUserId="user-1"
          onClose={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-reply-panel')).toBeInTheDocument();
    expect(screen.getByTestId('chat-editor')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    const parentMessage = createTestMessage({ id: 'parent-1' });

    render(
      <IntlWrapper>
        <ThreadReplyPanel
          parentMessage={parentMessage}
          threadId="thread-1"
          socket={null}
          currentUserId="user-1"
          onClose={onClose}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByLabelText('Close thread panel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('has 360px width', () => {
    const parentMessage = createTestMessage({ id: 'parent-1' });

    render(
      <IntlWrapper>
        <ThreadReplyPanel
          parentMessage={parentMessage}
          threadId="thread-1"
          socket={null}
          currentUserId="user-1"
          onClose={vi.fn()}
        />
      </IntlWrapper>,
    );

    const panel = screen.getByTestId('thread-reply-panel');
    expect(panel.style.width).toBe('360px');
  });
});

// ---------------------------------------------------------------------------
// ReplyChip
// ---------------------------------------------------------------------------

describe('ReplyChip', () => {
  it('renders reply count and time ago', () => {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60_000).toISOString();

    render(
      <IntlWrapper>
        <ReplyChip replyCount={3} lastReplyAt={thirtyMinAgo} onClick={vi.fn()} />
      </IntlWrapper>,
    );

    const chip = screen.getByTestId('reply-chip');
    expect(chip).toHaveTextContent('3 replies');
    expect(chip).toHaveTextContent('30m ago');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();

    render(
      <IntlWrapper>
        <ReplyChip
          replyCount={1}
          lastReplyAt={new Date().toISOString()}
          onClick={onClick}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('reply-chip'));
    expect(onClick).toHaveBeenCalled();
  });
});
