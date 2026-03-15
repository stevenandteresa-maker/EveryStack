import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockBroadcastMessageToThread } = vi.hoisted(() => ({
  mockBroadcastMessageToThread: vi.fn(),
}));

vi.mock('../../handlers/chat-handler', () => ({
  broadcastMessageToThread: mockBroadcastMessageToThread,
}));

vi.mock('@everystack/shared/logging', () => ({
  realtimeLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  parseThreadRoom,
  isChatEvent,
  handleChatEvent,
  startChatEventSubscriber,
} from '../chat-event-subscriber';

// ---------------------------------------------------------------------------
// parseThreadRoom
// ---------------------------------------------------------------------------

describe('parseThreadRoom', () => {
  it('parses valid thread room names', () => {
    expect(parseThreadRoom('t:tenant-1:thread:thread-1')).toEqual({
      tenantId: 'tenant-1',
      threadId: 'thread-1',
    });
  });

  it('parses thread IDs with UUIDs', () => {
    const result = parseThreadRoom('t:abc-def:thread:550e8400-e29b-41d4-a716-446655440000');
    expect(result).toEqual({
      tenantId: 'abc-def',
      threadId: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('returns null for non-thread room names', () => {
    expect(parseThreadRoom('t:tenant-1:table:table-1')).toBeNull();
    expect(parseThreadRoom('t:tenant-1:workspace:ws-1')).toBeNull();
    expect(parseThreadRoom('random-string')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseThreadRoom('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isChatEvent
// ---------------------------------------------------------------------------

describe('isChatEvent', () => {
  it('returns true for message.new', () => {
    expect(isChatEvent('message.new')).toBe(true);
  });

  it('returns true for message.edit', () => {
    expect(isChatEvent('message.edit')).toBe(true);
  });

  it('returns true for message.delete', () => {
    expect(isChatEvent('message.delete')).toBe(true);
  });

  it('returns false for non-chat events', () => {
    expect(isChatEvent('record.updated')).toBe(false);
    expect(isChatEvent('sync.completed')).toBe(false);
    expect(isChatEvent('typing.start')).toBe(false);
    expect(isChatEvent('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleChatEvent
// ---------------------------------------------------------------------------

describe('handleChatEvent', () => {
  const mockIo = {} as Parameters<typeof handleChatEvent>[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards message.new to broadcastMessageToThread', () => {
    const payload = { id: 'msg-1', content: 'Hello' };

    handleChatEvent(mockIo, 'tenant-1', 'thread-1', 'message.new', payload);

    expect(mockBroadcastMessageToThread).toHaveBeenCalledWith(
      mockIo,
      'tenant-1',
      'thread-1',
      { type: 'message.new', threadId: 'thread-1', payload },
      undefined,
    );
  });

  it('passes excludeUserId to broadcastMessageToThread', () => {
    handleChatEvent(mockIo, 'tenant-1', 'thread-1', 'message.edit', {}, 'user-sender');

    expect(mockBroadcastMessageToThread).toHaveBeenCalledWith(
      mockIo,
      'tenant-1',
      'thread-1',
      expect.objectContaining({ type: 'message.edit' }),
      'user-sender',
    );
  });

  it('constructs ChatEvent with correct shape', () => {
    const payload = { messageId: 'msg-1' };
    handleChatEvent(mockIo, 'tenant-1', 'thread-1', 'message.delete', payload);

    const chatEvent = mockBroadcastMessageToThread.mock.calls[0]![3];
    expect(chatEvent).toEqual({
      type: 'message.delete',
      threadId: 'thread-1',
      payload,
    });
  });
});

// ---------------------------------------------------------------------------
// startChatEventSubscriber
// ---------------------------------------------------------------------------

describe('startChatEventSubscriber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to thread channel pattern', async () => {
    const mockPsubscribe = vi.fn().mockResolvedValue(undefined);
    const mockOn = vi.fn();
    const mockRedis = {
      psubscribe: mockPsubscribe,
      on: mockOn,
    } as unknown as Parameters<typeof startChatEventSubscriber>[0];

    const mockIo = {} as Parameters<typeof startChatEventSubscriber>[1];

    await startChatEventSubscriber(mockRedis, mockIo);

    expect(mockPsubscribe).toHaveBeenCalledWith('realtime:t:*:thread:*');
    expect(mockOn).toHaveBeenCalledWith('pmessage', expect.any(Function));
  });

  it('forwards valid chat messages to broadcastMessageToThread', async () => {
    const mockOn = vi.fn();
    const mockRedis = {
      psubscribe: vi.fn().mockResolvedValue(undefined),
      on: mockOn,
    } as unknown as Parameters<typeof startChatEventSubscriber>[0];

    const mockIo = {} as Parameters<typeof startChatEventSubscriber>[1];

    await startChatEventSubscriber(mockRedis, mockIo);

    // Get the pmessage handler
    const handler = mockOn.mock.calls[0]![1] as (
      pattern: string,
      channel: string,
      message: string,
    ) => void;

    // Simulate receiving a message
    const payload = JSON.stringify({
      event: 'message.new',
      payload: { id: 'msg-1', content: 'Hello' },
      excludeUserId: 'user-sender',
      timestamp: Date.now(),
    });

    handler('realtime:t:*:thread:*', 'realtime:t:tenant-1:thread:thread-1', payload);

    expect(mockBroadcastMessageToThread).toHaveBeenCalledWith(
      mockIo,
      'tenant-1',
      'thread-1',
      expect.objectContaining({ type: 'message.new' }),
      'user-sender',
    );
  });

  it('skips malformed JSON messages', async () => {
    const mockOn = vi.fn();
    const mockRedis = {
      psubscribe: vi.fn().mockResolvedValue(undefined),
      on: mockOn,
    } as unknown as Parameters<typeof startChatEventSubscriber>[0];

    const mockIo = {} as Parameters<typeof startChatEventSubscriber>[1];

    await startChatEventSubscriber(mockRedis, mockIo);

    const handler = mockOn.mock.calls[0]![1] as (
      pattern: string,
      channel: string,
      message: string,
    ) => void;

    // Should not throw
    handler('realtime:t:*:thread:*', 'realtime:t:tenant-1:thread:thread-1', 'not-json');

    expect(mockBroadcastMessageToThread).not.toHaveBeenCalled();
  });

  it('skips messages without event name', async () => {
    const mockOn = vi.fn();
    const mockRedis = {
      psubscribe: vi.fn().mockResolvedValue(undefined),
      on: mockOn,
    } as unknown as Parameters<typeof startChatEventSubscriber>[0];

    const mockIo = {} as Parameters<typeof startChatEventSubscriber>[1];

    await startChatEventSubscriber(mockRedis, mockIo);

    const handler = mockOn.mock.calls[0]![1] as (
      pattern: string,
      channel: string,
      message: string,
    ) => void;

    handler(
      'realtime:t:*:thread:*',
      'realtime:t:tenant-1:thread:thread-1',
      JSON.stringify({ payload: {} }),
    );

    expect(mockBroadcastMessageToThread).not.toHaveBeenCalled();
  });

  it('skips non-chat events (e.g. record.updated)', async () => {
    const mockOn = vi.fn();
    const mockRedis = {
      psubscribe: vi.fn().mockResolvedValue(undefined),
      on: mockOn,
    } as unknown as Parameters<typeof startChatEventSubscriber>[0];

    const mockIo = {} as Parameters<typeof startChatEventSubscriber>[1];

    await startChatEventSubscriber(mockRedis, mockIo);

    const handler = mockOn.mock.calls[0]![1] as (
      pattern: string,
      channel: string,
      message: string,
    ) => void;

    handler(
      'realtime:t:*:thread:*',
      'realtime:t:tenant-1:thread:thread-1',
      JSON.stringify({ event: 'record.updated', payload: {} }),
    );

    expect(mockBroadcastMessageToThread).not.toHaveBeenCalled();
  });

  it('skips messages on non-thread channels', async () => {
    const mockOn = vi.fn();
    const mockRedis = {
      psubscribe: vi.fn().mockResolvedValue(undefined),
      on: mockOn,
    } as unknown as Parameters<typeof startChatEventSubscriber>[0];

    const mockIo = {} as Parameters<typeof startChatEventSubscriber>[1];

    await startChatEventSubscriber(mockRedis, mockIo);

    const handler = mockOn.mock.calls[0]![1] as (
      pattern: string,
      channel: string,
      message: string,
    ) => void;

    handler(
      'realtime:t:*:thread:*',
      'realtime:t:tenant-1:table:table-1',
      JSON.stringify({ event: 'message.new', payload: {} }),
    );

    expect(mockBroadcastMessageToThread).not.toHaveBeenCalled();
  });
});
