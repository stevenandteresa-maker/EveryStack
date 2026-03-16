// @vitest-environment jsdom
/**
 * Tests for Prompt 16 components: DMConversation, GroupDMHeader,
 * ThreadNavDropdown, RecordView thread integration, error states,
 * chat icon unread badge.
 *
 * @see docs/reference/communications.md
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
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

vi.mock('@/actions/threads', () => ({
  sendMessage: vi.fn().mockResolvedValue({
    id: 'msg-1',
    threadId: 'thread-1',
    authorId: 'user-1',
    content: { type: 'doc', content: [] },
    messageType: 'user',
    createdAt: new Date(),
  }),
  editMessageAction: vi.fn().mockResolvedValue(null),
  deleteMessageAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/chat/MessageItem', () => ({
  MessageItem: ({ message }: { message: { id: string; author_name: string } }) => (
    <div data-testid="message-item" data-message-id={message.id}>
      {message.author_name}
    </div>
  ),
}));

vi.mock('@/components/chat/ChatEditor', () => ({
  ChatEditor: ({ placeholder, onSend }: { placeholder?: string; onSend?: (content: unknown) => void }) => (
    <div data-testid="chat-editor">
      <span>{placeholder}</span>
      <button
        data-testid="mock-send-button"
        onClick={() => onSend?.({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] })}
      >
        Send
      </button>
    </div>
  ),
}));

vi.mock('@/components/chat/EmojiReactions', () => ({
  EmojiReactions: () => null,
}));

vi.mock('@everystack/shared/realtime', () => ({
  REALTIME_EVENTS: {
    MESSAGE_NEW: 'message:new',
    MESSAGE_EDIT: 'message:edit',
    MESSAGE_DELETE: 'message:delete',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',
  },
}));

vi.mock('@/lib/hooks/use-optimistic-record', () => ({
  useOptimisticRecord: () => ({ updateCell: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-media-query', () => ({
  useMediaQuery: () => false,
}));

vi.mock('@everystack/shared/db', () => ({
  generateUUIDv7: () => 'mock-uuid-v7',
}));

// Mock Tooltip to avoid TooltipProvider requirement
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Radix DropdownMenu to render content directly (JSDOM doesn't support portals)
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid={props['data-testid']}>{children}</div>
  ),
  DropdownMenuTrigger: ({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean; [key: string]: unknown }) => {
    if (asChild) return children;
    return <button {...props}>{children}</button>;
  },
}));

vi.mock('./RecordViewCanvas', () => ({
  RecordViewCanvas: () => <div data-testid="record-view-canvas" />,
}));

vi.mock('./RecordViewTabs', () => ({
  RecordViewTabs: () => <div data-testid="record-view-tabs" />,
  DEFAULT_TAB_ID: '__default__',
}));

vi.mock('./RecordViewConfigPicker', () => ({
  RecordViewConfigPicker: () => <div data-testid="config-picker" />,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { DMConversation } from '@/components/chat/DMConversation';
import { GroupDMHeader, type GroupParticipant } from '@/components/chat/GroupDMHeader';
import { MessageErrorHandler, type FailedMessage, RETRY_DELAYS, RATE_LIMIT_COOLDOWN_MS } from '@/components/chat/MessageErrorHandler';
import { ThreadNavDropdown, type ThreadNavNode } from '@/components/thread/ThreadNavDropdown';
import { RecordViewHeader } from '@/components/record-view/RecordViewHeader';
import { RecordView } from '@/components/record-view/RecordView';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSocket(): Socket {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  } as unknown as Socket;
}

import type { GridField, GridRecord } from '@/lib/types/grid';

const mockRecord = {
  id: 'rec-1',
  canonicalData: { 'field-1': 'Test Record' },
} as unknown as GridRecord;

const mockFields = [
  { id: 'field-1', name: 'Name', isPrimary: true, fieldType: 'text' },
] as unknown as GridField[];

// ---------------------------------------------------------------------------
// DMConversation
// ---------------------------------------------------------------------------

describe('DMConversation', () => {
  it('renders with empty state', () => {
    render(
      <IntlWrapper>
        <DMConversation
          threadId="thread-1"
          tenantId="tenant-1"
          socket={null}
          currentUserId="user-1"
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('dm-conversation')).toBeInTheDocument();
    expect(screen.getByTestId('chat-editor')).toBeInTheDocument();
  });

  it('renders with custom header', () => {
    render(
      <IntlWrapper>
        <DMConversation
          threadId="thread-1"
          tenantId="tenant-1"
          socket={null}
          currentUserId="user-1"
          header={<div data-testid="custom-header">DM Header</div>}
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('custom-header')).toBeInTheDocument();
  });

  it('connects to socket when provided', () => {
    const socket = createMockSocket();
    render(
      <IntlWrapper>
        <DMConversation
          threadId="thread-1"
          tenantId="tenant-1"
          socket={socket}
          currentUserId="user-1"
        />
      </IntlWrapper>,
    );
    expect(socket.emit).toHaveBeenCalledWith('join', 'thread:thread-1');
  });
});

// ---------------------------------------------------------------------------
// GroupDMHeader
// ---------------------------------------------------------------------------

describe('GroupDMHeader', () => {
  const participants: GroupParticipant[] = [
    { id: 'u1', name: 'Alice' },
    { id: 'u2', name: 'Bob' },
    { id: 'u3', name: 'Charlie' },
  ];

  it('renders group name and participant avatars', () => {
    render(
      <IntlWrapper>
        <GroupDMHeader
          groupName="Design Team"
          participants={participants}
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('group-name-display')).toHaveTextContent('Design Team');
    expect(screen.getAllByTestId('participant-avatar')).toHaveLength(3);
  });

  it('enables name editing on click', async () => {
    const onNameChange = vi.fn();
    render(
      <IntlWrapper>
        <GroupDMHeader
          groupName="Design Team"
          participants={participants}
          onNameChange={onNameChange}
        />
      </IntlWrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('group-name-display'));
    });

    const input = screen.getByTestId('group-name-input');
    expect(input).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onNameChange).toHaveBeenCalledWith('New Name');
  });

  it('shows add participant button when under cap', () => {
    const onAddParticipant = vi.fn();
    render(
      <IntlWrapper>
        <GroupDMHeader
          groupName="Team"
          participants={participants}
          onAddParticipant={onAddParticipant}
        />
      </IntlWrapper>,
    );
    const btn = screen.getByTestId('add-participant-button');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAddParticipant).toHaveBeenCalled();
  });

  it('hides add participant when at max cap (8)', () => {
    const fullParticipants = Array.from({ length: 8 }, (_, i) => ({
      id: `u${i}`,
      name: `User ${i}`,
    }));
    render(
      <IntlWrapper>
        <GroupDMHeader
          groupName="Full Team"
          participants={fullParticipants}
          onAddParticipant={vi.fn()}
        />
      </IntlWrapper>,
    );
    expect(screen.queryByTestId('add-participant-button')).not.toBeInTheDocument();
  });

  it('renders settings button when handler provided', () => {
    const onOpenSettings = vi.fn();
    render(
      <IntlWrapper>
        <GroupDMHeader
          groupName="Team"
          participants={participants}
          onOpenSettings={onOpenSettings}
        />
      </IntlWrapper>,
    );
    const btn = screen.getByTestId('group-settings-button');
    fireEvent.click(btn);
    expect(onOpenSettings).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ThreadNavDropdown
// ---------------------------------------------------------------------------

describe('ThreadNavDropdown', () => {
  const current: ThreadNavNode = {
    recordId: 'rec-2',
    title: 'Task B',
    unreadCount: 3,
    children: [
      { recordId: 'rec-4', title: 'Subtask 1', unreadCount: 0 },
      { recordId: 'rec-5', title: 'Subtask 2', unreadCount: 1 },
    ],
  };

  const parent: ThreadNavNode = {
    recordId: 'rec-1',
    title: 'Project A',
    unreadCount: 0,
  };

  const siblings: ThreadNavNode[] = [
    current,
    { recordId: 'rec-3', title: 'Task C', unreadCount: 0 },
  ];

  it('returns null when hasHierarchy is false', () => {
    const { container } = render(
      <IntlWrapper>
        <ThreadNavDropdown
          current={current}
          siblings={siblings}
          hasHierarchy={false}
          onNavigate={vi.fn()}
        />
      </IntlWrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders trigger button with current title', () => {
    render(
      <IntlWrapper>
        <ThreadNavDropdown
          parent={parent}
          current={current}
          siblings={siblings}
          hasHierarchy={true}
          onNavigate={vi.fn()}
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('thread-nav-trigger')).toHaveTextContent('Task B');
  });

  it('renders tree with parent, siblings, and children', () => {
    const onNavigate = vi.fn();
    render(
      <IntlWrapper>
        <ThreadNavDropdown
          parent={parent}
          current={current}
          siblings={siblings}
          hasHierarchy={true}
          onNavigate={onNavigate}
        />
      </IntlWrapper>,
    );

    // With mocked DropdownMenu, content is always rendered
    const items = screen.getAllByTestId('thread-nav-item');
    // parent + 2 siblings + 2 children = 5
    expect(items.length).toBe(5);

    // Current should be highlighted
    const currentItem = items.find(
      (el) => el.getAttribute('data-record-id') === 'rec-2',
    );
    expect(currentItem).toHaveAttribute('aria-current', 'true');
  });

  it('shows unread indicators (teal dot + count)', () => {
    render(
      <IntlWrapper>
        <ThreadNavDropdown
          parent={parent}
          current={current}
          siblings={siblings}
          hasHierarchy={true}
          onNavigate={vi.fn()}
        />
      </IntlWrapper>,
    );

    const unreadIndicators = screen.getAllByTestId('unread-indicator');
    // current (3) + Subtask 2 (1) = 2 unread indicators
    expect(unreadIndicators.length).toBe(2);
  });

  it('calls onNavigate when clicking a nav item', () => {
    const onNavigate = vi.fn();
    render(
      <IntlWrapper>
        <ThreadNavDropdown
          parent={parent}
          current={current}
          siblings={siblings}
          hasHierarchy={true}
          onNavigate={onNavigate}
        />
      </IntlWrapper>,
    );

    const parentItem = screen
      .getAllByTestId('thread-nav-item')
      .find((el) => el.getAttribute('data-record-id') === 'rec-1');

    fireEvent.click(parentItem!);
    expect(onNavigate).toHaveBeenCalledWith('rec-1');
  });
});

// ---------------------------------------------------------------------------
// MessageErrorHandler
// ---------------------------------------------------------------------------

describe('MessageErrorHandler', () => {
  it('renders nothing when no failed messages', () => {
    const { container } = render(
      <IntlWrapper>
        <MessageErrorHandler
          failedMessages={[]}
          onRetry={vi.fn()}
          onDismiss={vi.fn()}
        />
      </IntlWrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders failed message with retry button', () => {
    const failedMsg: FailedMessage = {
      id: 'f1',
      content: { type: 'doc', content: [] },
      threadId: 'thread-1',
      retryCount: 0,
      maxRetries: 3,
      status: 'failed',
    };
    const onRetry = vi.fn();

    render(
      <IntlWrapper>
        <MessageErrorHandler
          failedMessages={[failedMsg]}
          onRetry={onRetry}
          onDismiss={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('failed-message')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('retry-message'));
    expect(onRetry).toHaveBeenCalledWith(failedMsg);
  });

  it('shows manual retry text after max retries', () => {
    const failedMsg: FailedMessage = {
      id: 'f1',
      content: { type: 'doc', content: [] },
      threadId: 'thread-1',
      retryCount: 3,
      maxRetries: 3,
      status: 'failed',
    };

    render(
      <IntlWrapper>
        <MessageErrorHandler
          failedMessages={[failedMsg]}
          onRetry={vi.fn()}
          onDismiss={vi.fn()}
        />
      </IntlWrapper>,
    );

    // Should show "Message could not be sent. Tap to retry."
    expect(screen.getByTestId('failed-message')).toBeInTheDocument();
  });

  it('disables retry button when status is retrying', () => {
    const failedMsg: FailedMessage = {
      id: 'f1',
      content: { type: 'doc', content: [] },
      threadId: 'thread-1',
      retryCount: 1,
      maxRetries: 3,
      status: 'retrying',
    };

    render(
      <IntlWrapper>
        <MessageErrorHandler
          failedMessages={[failedMsg]}
          onRetry={vi.fn()}
          onDismiss={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('retry-message')).toBeDisabled();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const failedMsg: FailedMessage = {
      id: 'f1',
      content: { type: 'doc', content: [] },
      threadId: 'thread-1',
      retryCount: 0,
      maxRetries: 3,
      status: 'failed',
    };
    const onDismiss = vi.fn();

    render(
      <IntlWrapper>
        <MessageErrorHandler
          failedMessages={[failedMsg]}
          onRetry={vi.fn()}
          onDismiss={onDismiss}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('dismiss-failed-message'));
    expect(onDismiss).toHaveBeenCalledWith('f1');
  });

  it('exports retry delay constants', () => {
    expect(RETRY_DELAYS).toEqual([1000, 3000, 10000]);
    expect(RATE_LIMIT_COOLDOWN_MS).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// RecordViewHeader — unread badge
// ---------------------------------------------------------------------------

describe('RecordViewHeader — chat icon + unread badge', () => {
  const headerProps = {
    record: mockRecord,
    fields: mockFields,
    tableName: 'Tasks',
    viewName: 'Grid',
    hasPrev: false,
    hasNext: false,
    onNavigate: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders chat icon button', () => {
    render(
      <IntlWrapper>
        <RecordViewHeader {...headerProps} onToggleThread={vi.fn()} />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('record-view-chat-icon')).toBeInTheDocument();
  });

  it('shows unread badge when threadUnreadCount > 0 and thread closed', () => {
    render(
      <IntlWrapper>
        <RecordViewHeader
          {...headerProps}
          threadUnreadCount={5}
          isThreadOpen={false}
          onToggleThread={vi.fn()}
        />
      </IntlWrapper>,
    );
    const badge = screen.getByTestId('chat-unread-badge');
    expect(badge).toHaveTextContent('5');
  });

  it('caps badge at 99+', () => {
    render(
      <IntlWrapper>
        <RecordViewHeader
          {...headerProps}
          threadUnreadCount={150}
          isThreadOpen={false}
          onToggleThread={vi.fn()}
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('chat-unread-badge')).toHaveTextContent('99+');
  });

  it('hides badge when thread is open', () => {
    render(
      <IntlWrapper>
        <RecordViewHeader
          {...headerProps}
          threadUnreadCount={5}
          isThreadOpen={true}
          onToggleThread={vi.fn()}
        />
      </IntlWrapper>,
    );
    expect(screen.queryByTestId('chat-unread-badge')).not.toBeInTheDocument();
  });

  it('calls onToggleThread when chat icon clicked', () => {
    const onToggleThread = vi.fn();
    render(
      <IntlWrapper>
        <RecordViewHeader
          {...headerProps}
          onToggleThread={onToggleThread}
        />
      </IntlWrapper>,
    );
    fireEvent.click(screen.getByTestId('record-view-chat-icon'));
    expect(onToggleThread).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RecordView — thread panel layout
// ---------------------------------------------------------------------------

describe('RecordView — thread panel integration', () => {
  const baseProps = {
    isOpen: true,
    record: mockRecord,
    fields: mockFields,
    layout: { tabs: [], fields: [], columns: 2 },
    tableName: 'Tasks',
    viewName: 'Grid',
    tableId: 'table-1',
    viewId: 'view-1',
    recordIds: ['rec-1'],
    currentRecordId: 'rec-1',
    onNavigate: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders without thread panel by default', () => {
    render(
      <IntlWrapper>
        <RecordView {...baseProps} />
      </IntlWrapper>,
    );
    expect(screen.queryByTestId('record-view-thread-slot')).not.toBeInTheDocument();
  });

  it('renders thread panel slot when isThreadOpen=true and threadPanel provided', () => {
    render(
      <IntlWrapper>
        <RecordView
          {...baseProps}
          isThreadOpen={true}
          threadPanel={<div data-testid="mock-thread-panel">Thread</div>}
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('record-view-thread-slot')).toBeInTheDocument();
    expect(screen.getByTestId('mock-thread-panel')).toBeInTheDocument();
  });

  it('content area takes 75% width when thread open', () => {
    render(
      <IntlWrapper>
        <RecordView
          {...baseProps}
          isThreadOpen={true}
          threadPanel={<div>Thread</div>}
        />
      </IntlWrapper>,
    );
    const contentArea = screen.getByTestId('record-view-content');
    expect(contentArea.style.width).toBe('75%');
  });

  it('content area takes 100% width when thread closed', () => {
    render(
      <IntlWrapper>
        <RecordView {...baseProps} isThreadOpen={false} />
      </IntlWrapper>,
    );
    const contentArea = screen.getByTestId('record-view-content');
    expect(contentArea.style.width).toBe('100%');
  });
});

// ---------------------------------------------------------------------------
// Contract exports
// ---------------------------------------------------------------------------

describe('Contract exports', () => {
  it('DMConversation is exported from chat/', async () => {
    const mod = await import('@/components/chat/DMConversation');
    expect(mod.DMConversation).toBeDefined();
  });

  it('GroupDMHeader is exported from chat/', async () => {
    const mod = await import('@/components/chat/GroupDMHeader');
    expect(mod.GroupDMHeader).toBeDefined();
  });

  it('MessageErrorHandler is exported from chat/', async () => {
    const mod = await import('@/components/chat/MessageErrorHandler');
    expect(mod.MessageErrorHandler).toBeDefined();
  });

  it('ThreadNavDropdown is exported from thread/', async () => {
    const mod = await import('@/components/thread/ThreadNavDropdown');
    expect(mod.ThreadNavDropdown).toBeDefined();
  });

  it('useThread is exported from thread/', async () => {
    const mod = await import('@/components/thread/use-thread');
    expect(mod.useThread).toBeDefined();
  });

  it('useThreadSearch is exported from thread/', async () => {
    const mod = await import('@/components/thread/use-thread-search');
    expect(mod.useThreadSearch).toBeDefined();
  });

  it('useTypingIndicator is exported from thread/', async () => {
    const mod = await import('@/components/thread/use-typing-indicator');
    expect(mod.useTypingIndicator).toBeDefined();
  });
});
