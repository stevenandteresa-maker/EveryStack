// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { Notification } from '@everystack/shared/db';
import { groupNotifications } from '../notification-grouping';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeNotification(
  overrides: Partial<Notification> & { id: string; createdAt: Date },
): Notification {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    type: 'thread_reply',
    title: 'Someone replied',
    body: null,
    sourceType: 'thread_message',
    sourceThreadId: null,
    sourceMessageId: null,
    sourceRecordId: null,
    actorId: null,
    groupKey: null,
    read: false,
    readAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('groupNotifications', () => {
  it('returns empty array for empty input', () => {
    expect(groupNotifications([])).toEqual([]);
  });

  it('returns single items when no group_key present', () => {
    const notifications = [
      makeNotification({ id: 'a', createdAt: new Date('2026-01-01T12:00:00Z') }),
      makeNotification({ id: 'b', createdAt: new Date('2026-01-01T11:00:00Z') }),
    ];

    const result = groupNotifications(notifications);
    expect(result).toHaveLength(2);
    expect(result[0]!.kind).toBe('single');
    expect(result[1]!.kind).toBe('single');
  });

  it('groups notifications with same group_key within 5 minutes', () => {
    const base = new Date('2026-01-01T12:00:00Z');
    const notifications = [
      makeNotification({
        id: 'a',
        createdAt: base,
        groupKey: 'thread:123',
        title: 'Sarah replied',
      }),
      makeNotification({
        id: 'b',
        createdAt: new Date(base.getTime() - 2 * 60_000), // 2 min earlier
        groupKey: 'thread:123',
        title: 'James replied',
      }),
      makeNotification({
        id: 'c',
        createdAt: new Date(base.getTime() - 4 * 60_000), // 4 min earlier
        groupKey: 'thread:123',
        title: 'Alice replied',
      }),
    ];

    const result = groupNotifications(notifications);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('group');
    if (result[0]!.kind === 'group') {
      expect(result[0]!.notifications).toHaveLength(3);
    }
  });

  it('does NOT group notifications with same group_key more than 5 minutes apart', () => {
    const base = new Date('2026-01-01T12:00:00Z');
    const notifications = [
      makeNotification({
        id: 'a',
        createdAt: base,
        groupKey: 'thread:123',
      }),
      makeNotification({
        id: 'b',
        createdAt: new Date(base.getTime() - 6 * 60_000), // 6 min earlier
        groupKey: 'thread:123',
      }),
    ];

    const result = groupNotifications(notifications);
    // Should be 2 separate singles (each group has only 1 item)
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.kind === 'single')).toBe(true);
  });

  it('keeps different group_keys separate', () => {
    const base = new Date('2026-01-01T12:00:00Z');
    const notifications = [
      makeNotification({
        id: 'a',
        createdAt: base,
        groupKey: 'thread:123',
      }),
      makeNotification({
        id: 'b',
        createdAt: new Date(base.getTime() - 1 * 60_000),
        groupKey: 'thread:456',
      }),
      makeNotification({
        id: 'c',
        createdAt: new Date(base.getTime() - 2 * 60_000),
        groupKey: 'thread:123',
      }),
    ];

    const result = groupNotifications(notifications);
    // thread:123 groups (2 items), thread:456 is single
    const groups = result.filter((e) => e.kind === 'group');
    const singles = result.filter((e) => e.kind === 'single');
    expect(groups).toHaveLength(1);
    expect(singles).toHaveLength(1);
  });

  it('mixes grouped and ungrouped notifications', () => {
    const base = new Date('2026-01-01T12:00:00Z');
    const notifications = [
      makeNotification({
        id: 'a',
        createdAt: base,
        groupKey: 'thread:123',
      }),
      makeNotification({
        id: 'b',
        createdAt: new Date(base.getTime() - 1 * 60_000),
        // no group_key
      }),
      makeNotification({
        id: 'c',
        createdAt: new Date(base.getTime() - 2 * 60_000),
        groupKey: 'thread:123',
      }),
    ];

    const result = groupNotifications(notifications);
    expect(result).toHaveLength(2); // 1 group + 1 single
  });

  it('sorts results by newest first', () => {
    const base = new Date('2026-01-01T12:00:00Z');
    const notifications = [
      makeNotification({
        id: 'old',
        createdAt: new Date(base.getTime() - 10 * 60_000),
      }),
      makeNotification({
        id: 'new',
        createdAt: base,
      }),
    ];

    const result = groupNotifications(notifications);
    expect(result).toHaveLength(2);
    if (result[0]!.kind === 'single' && result[1]!.kind === 'single') {
      expect(result[0]!.notification.id).toBe('new');
      expect(result[1]!.notification.id).toBe('old');
    }
  });
});
