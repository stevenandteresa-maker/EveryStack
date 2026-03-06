import { describe, it, expect } from 'vitest';
import { REALTIME_EVENTS } from '../events';
import type { RoomPattern, RealtimeEventName } from '../index';

describe('RoomPattern', () => {
  it('accepts valid workspace room pattern', () => {
    const room: RoomPattern = 'workspace:abc-123';
    expect(room).toBe('workspace:abc-123');
  });

  it('accepts valid table room pattern', () => {
    const room: RoomPattern = 'table:abc-123';
    expect(room).toBe('table:abc-123');
  });

  it('accepts valid record room pattern', () => {
    const room: RoomPattern = 'record:abc-123';
    expect(room).toBe('record:abc-123');
  });

  it('accepts valid thread room pattern', () => {
    const room: RoomPattern = 'thread:abc-123';
    expect(room).toBe('thread:abc-123');
  });

  it('accepts valid user room pattern', () => {
    const room: RoomPattern = 'user:abc-123';
    expect(room).toBe('user:abc-123');
  });
});

describe('REALTIME_EVENTS', () => {
  it('has exactly 20 event names', () => {
    const eventCount = Object.keys(REALTIME_EVENTS).length;
    expect(eventCount).toBe(20);
  });

  it('contains all record events', () => {
    expect(REALTIME_EVENTS.RECORD_CREATED).toBe('record.created');
    expect(REALTIME_EVENTS.RECORD_UPDATED).toBe('record.updated');
    expect(REALTIME_EVENTS.RECORD_DELETED).toBe('record.deleted');
    expect(REALTIME_EVENTS.RECORD_CREATED_BATCH).toBe('record.created.batch');
    expect(REALTIME_EVENTS.RECORD_UPDATED_BATCH).toBe('record.updated.batch');
    expect(REALTIME_EVENTS.RECORD_DELETED_BATCH).toBe('record.deleted.batch');
  });

  it('contains all sync events', () => {
    expect(REALTIME_EVENTS.SYNC_STARTED).toBe('sync.started');
    expect(REALTIME_EVENTS.SYNC_SCHEMA_READY).toBe('sync.schema_ready');
    expect(REALTIME_EVENTS.SYNC_PROGRESS).toBe('sync.progress');
    expect(REALTIME_EVENTS.SYNC_BATCH_COMPLETE).toBe('sync.batch_complete');
    expect(REALTIME_EVENTS.SYNC_COMPLETED).toBe('sync.completed');
    expect(REALTIME_EVENTS.SYNC_FAILED).toBe('sync.failed');
  });

  it('contains all schema events', () => {
    expect(REALTIME_EVENTS.FIELD_CREATED).toBe('schema.field.created');
    expect(REALTIME_EVENTS.FIELD_UPDATED).toBe('schema.field.updated');
    expect(REALTIME_EVENTS.FIELD_DELETED).toBe('schema.field.deleted');
    expect(REALTIME_EVENTS.VIEW_UPDATED).toBe('schema.view.updated');
  });

  it('contains all file events', () => {
    expect(REALTIME_EVENTS.FILE_UPLOADED).toBe('file.uploaded');
    expect(REALTIME_EVENTS.FILE_SCAN_COMPLETE).toBe('file.scan_complete');
    expect(REALTIME_EVENTS.FILE_THUMBNAIL_READY).toBe('file.thumbnail_ready');
  });

  it('contains notification event', () => {
    expect(REALTIME_EVENTS.NOTIFICATION_CREATED).toBe('notification.created');
  });

  it('all event values are unique', () => {
    const values = Object.values(REALTIME_EVENTS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('event values satisfy RealtimeEventName type', () => {
    // Type-level check: assigning each value to the union type
    const events: RealtimeEventName[] = Object.values(REALTIME_EVENTS);
    expect(events).toHaveLength(20);
  });
});
