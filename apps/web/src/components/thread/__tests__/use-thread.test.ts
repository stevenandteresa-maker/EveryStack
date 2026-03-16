// @vitest-environment jsdom
/**
 * Tests for useThread hook — message loading, pagination, and real-time subscriptions.
 *
 * @see docs/reference/communications.md § Record Thread
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import { useThread } from '../use-thread';
import type { ThreadMessage } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the server action imports to prevent 'use server' module loading
vi.mock('@/actions/threads', () => ({
  sendMessage: vi.fn().mockResolvedValue({
    id: 'msg-new',
    threadId: 'thread-1',
    authorId: 'user-1',
    content: 'hello',
    createdAt: new Date(),
  }),
  editMessageAction: vi.fn().mockResolvedValue({
    id: 'msg-1',
    threadId: 'thread-1',
    authorId: 'user-1',
    content: 'edited',
    editedAt: new Date(),
    createdAt: new Date(),
  }),
  deleteMessageAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/actions/thread-queries', () => ({
  getMessagesAction: vi.fn(),
  markThreadReadAction: vi.fn(),
  getUnreadCountAction: vi.fn().mockResolvedValue(0),
}));

function createMockMessage(overrides: Partial<ThreadMessage> = {}): ThreadMessage {
  return {
    id: 'msg-1',
    tenantId: 'tenant-1',
    threadId: 'thread-1',
    authorId: 'user-2',
    authorType: 'user',
    messageType: 'message',
    content: 'Test message',
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

function createMockSocket() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(handler);
    }),
    emit: vi.fn(),
    // Test helper: fire an event
    __fire(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((h) => h(...args));
    },
  };
}

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

let queryClient: QueryClient;

function TestWrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function createWrapper() {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return TestWrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useThread', () => {
  const mockFetchMessages = vi.fn();
  const mockMarkRead = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMessages.mockResolvedValue({ items: [], nextCursor: null });
    mockMarkRead.mockResolvedValue(undefined);
  });

  it('loads messages on mount', async () => {
    const messages = [createMockMessage()];
    mockFetchMessages.mockResolvedValueOnce({ items: messages, nextCursor: null });

    const { result } = renderHook(
      () =>
        useThread({
          threadId: 'thread-1',
          socket: null,
          currentUserId: 'user-1',
          fetchMessages: mockFetchMessages,
          markRead: mockMarkRead,
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.id).toBe('msg-1');
    expect(mockFetchMessages).toHaveBeenCalledWith('thread-1', {
      cursor: undefined,
      lensFilter: undefined,
    });
  });

  it('does not fetch when threadId is null', async () => {
    const { result } = renderHook(
      () =>
        useThread({
          threadId: null,
          socket: null,
          currentUserId: 'user-1',
          fetchMessages: mockFetchMessages,
          markRead: mockMarkRead,
        }),
      { wrapper: createWrapper() },
    );

    // Should not be loading (query is disabled)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchMessages).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it('passes lensFilter to fetchMessages', async () => {
    mockFetchMessages.mockResolvedValueOnce({ items: [], nextCursor: null });

    renderHook(
      () =>
        useThread({
          threadId: 'thread-1',
          socket: null,
          currentUserId: 'user-1',
          lensFilter: 'notes',
          fetchMessages: mockFetchMessages,
          markRead: mockMarkRead,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockFetchMessages).toHaveBeenCalledWith('thread-1', {
        cursor: undefined,
        lensFilter: 'notes',
      });
    });
  });

  it('marks thread as read on mount', async () => {
    mockFetchMessages.mockResolvedValueOnce({ items: [], nextCursor: null });

    renderHook(
      () =>
        useThread({
          threadId: 'thread-1',
          socket: null,
          currentUserId: 'user-1',
          fetchMessages: mockFetchMessages,
          markRead: mockMarkRead,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalledWith('thread-1');
    });
  });

  it('subscribes to socket events and joins thread room', async () => {
    const socket = createMockSocket();
    mockFetchMessages.mockResolvedValueOnce({ items: [], nextCursor: null });

    renderHook(
      () =>
        useThread({
          threadId: 'thread-1',
          socket: socket as unknown as Parameters<typeof useThread>[0]['socket'],
          currentUserId: 'user-1',
          fetchMessages: mockFetchMessages,
          markRead: mockMarkRead,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith('join', 'thread:thread-1');
    });

    expect(socket.on).toHaveBeenCalledWith(
      REALTIME_EVENTS.MESSAGE_NEW,
      expect.any(Function),
    );
    expect(socket.on).toHaveBeenCalledWith(
      REALTIME_EVENTS.MESSAGE_EDIT,
      expect.any(Function),
    );
    expect(socket.on).toHaveBeenCalledWith(
      REALTIME_EVENTS.MESSAGE_DELETE,
      expect.any(Function),
    );
  });

  it('appends new messages from socket events (other users)', async () => {
    const socket = createMockSocket();
    const initialMessages = [createMockMessage({ id: 'msg-1' })];
    mockFetchMessages.mockResolvedValueOnce({
      items: initialMessages,
      nextCursor: null,
    });

    const { result } = renderHook(
      () =>
        useThread({
          threadId: 'thread-1',
          socket: socket as unknown as Parameters<typeof useThread>[0]['socket'],
          currentUserId: 'user-1',
          fetchMessages: mockFetchMessages,
          markRead: mockMarkRead,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Simulate incoming message from another user
    act(() => {
      socket.__fire(
        REALTIME_EVENTS.MESSAGE_NEW,
        createMockMessage({ id: 'msg-2', authorId: 'user-2', threadId: 'thread-1' }),
      );
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
  });

  it('ignores own messages from socket events', async () => {
    const socket = createMockSocket();
    mockFetchMessages.mockResolvedValueOnce({
      items: [createMockMessage({ id: 'msg-1' })],
      nextCursor: null,
    });

    const { result } = renderHook(
      () =>
        useThread({
          threadId: 'thread-1',
          socket: socket as unknown as Parameters<typeof useThread>[0]['socket'],
          currentUserId: 'user-1',
          fetchMessages: mockFetchMessages,
          markRead: mockMarkRead,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Own message should be ignored
    act(() => {
      socket.__fire(
        REALTIME_EVENTS.MESSAGE_NEW,
        createMockMessage({ id: 'msg-self', authorId: 'user-1', threadId: 'thread-1' }),
      );
    });

    // Wait a tick to ensure no update
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.messages).toHaveLength(1);
  });

  it('reports hasMore when nextCursor is returned', async () => {
    mockFetchMessages.mockResolvedValueOnce({
      items: [createMockMessage()],
      nextCursor: 'cursor-123',
    });

    const { result } = renderHook(
      () =>
        useThread({
          threadId: 'thread-1',
          socket: null,
          currentUserId: 'user-1',
          fetchMessages: mockFetchMessages,
          markRead: mockMarkRead,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });
  });
});
