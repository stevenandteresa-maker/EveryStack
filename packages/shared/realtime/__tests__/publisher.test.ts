import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EventPublisher,
  createEventPublisher,
  buildChannel,
} from '../publisher';
import type { PublishEventOptions, RedisEventPayload } from '../publisher';
import { REALTIME_EVENTS } from '../events';

// ── Mock Redis ─────────────────────────────────────────────────────────────

function createMockRedis() {
  return {
    publish: vi.fn().mockResolvedValue(1),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('buildChannel', () => {
  it('builds correct channel format', () => {
    expect(buildChannel('tenant-1', 'table:abc')).toBe(
      'realtime:t:tenant-1:table:abc',
    );
  });

  it('works with workspace rooms', () => {
    expect(buildChannel('t-2', 'workspace:ws-1')).toBe(
      'realtime:t:t-2:workspace:ws-1',
    );
  });

  it('works with user rooms', () => {
    expect(buildChannel('t-3', 'user:u-1')).toBe('realtime:t:t-3:user:u-1');
  });
});

describe('EventPublisher', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
  });

  it('publishes event with correct Redis channel format', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publisher = new EventPublisher(mockRedis as any);

    const options: PublishEventOptions = {
      tenantId: 'tenant-abc',
      channel: 'table:table-xyz',
      event: REALTIME_EVENTS.RECORD_UPDATED,
      payload: { recordId: 'rec-1', fields: { name: 'test' } },
    };

    await publisher.publish(options);

    expect(mockRedis.publish).toHaveBeenCalledWith(
      'realtime:t:tenant-abc:table:table-xyz',
      expect.any(String),
    );

    const publishedMessage = JSON.parse(
      mockRedis.publish.mock.calls[0]![1] as string,
    ) as RedisEventPayload;

    expect(publishedMessage.event).toBe('record.updated');
    expect(publishedMessage.payload).toEqual({
      recordId: 'rec-1',
      fields: { name: 'test' },
    });
    expect(publishedMessage.timestamp).toBeTypeOf('number');
    expect(publishedMessage.excludeUserId).toBeUndefined();
  });

  it('includes excludeUserId when provided', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publisher = new EventPublisher(mockRedis as any);

    await publisher.publish({
      tenantId: 'tenant-1',
      channel: 'table:t-1',
      event: REALTIME_EVENTS.RECORD_CREATED,
      payload: { recordId: 'rec-2' },
      excludeUserId: 'user-who-edited',
    });

    const publishedMessage = JSON.parse(
      mockRedis.publish.mock.calls[0]![1] as string,
    ) as RedisEventPayload;

    expect(publishedMessage.excludeUserId).toBe('user-who-edited');
  });

  it('does not include excludeUserId when not provided', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publisher = new EventPublisher(mockRedis as any);

    await publisher.publish({
      tenantId: 'tenant-1',
      channel: 'workspace:ws-1',
      event: REALTIME_EVENTS.SYNC_COMPLETED,
      payload: { status: 'done' },
    });

    const publishedMessage = JSON.parse(
      mockRedis.publish.mock.calls[0]![1] as string,
    ) as RedisEventPayload;

    expect(publishedMessage).not.toHaveProperty('excludeUserId');
  });

  it('includes timestamp in payload', async () => {
    const before = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publisher = new EventPublisher(mockRedis as any);

    await publisher.publish({
      tenantId: 'tenant-1',
      channel: 'table:t-1',
      event: REALTIME_EVENTS.RECORD_DELETED,
      payload: null,
    });

    const after = Date.now();
    const publishedMessage = JSON.parse(
      mockRedis.publish.mock.calls[0]![1] as string,
    ) as RedisEventPayload;

    expect(publishedMessage.timestamp).toBeGreaterThanOrEqual(before);
    expect(publishedMessage.timestamp).toBeLessThanOrEqual(after);
  });
});

describe('createEventPublisher', () => {
  it('returns an EventPublisher instance', () => {
    const mockRedis = createMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publisher = createEventPublisher(mockRedis as any);
    expect(publisher).toBeInstanceOf(EventPublisher);
  });
});
