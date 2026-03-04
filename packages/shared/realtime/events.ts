/**
 * All real-time event names used across the system.
 * Workers and Server Actions publish these; the realtime server fans out to clients.
 */
export const REALTIME_EVENTS = {
  // Record events
  RECORD_CREATED: 'record.created',
  RECORD_UPDATED: 'record.updated',
  RECORD_DELETED: 'record.deleted',
  RECORD_CREATED_BATCH: 'record.created.batch',
  RECORD_UPDATED_BATCH: 'record.updated.batch',
  RECORD_DELETED_BATCH: 'record.deleted.batch',

  // Sync events
  SYNC_STARTED: 'sync.started',
  SYNC_BATCH_COMPLETE: 'sync.batch_complete',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_FAILED: 'sync.failed',

  // Schema events
  FIELD_CREATED: 'schema.field.created',
  FIELD_UPDATED: 'schema.field.updated',
  FIELD_DELETED: 'schema.field.deleted',
  VIEW_UPDATED: 'schema.view.updated',

  // File events
  FILE_UPLOADED: 'file.uploaded',
  FILE_SCAN_COMPLETE: 'file.scan_complete',
  FILE_THUMBNAIL_READY: 'file.thumbnail_ready',

  // Notification events
  NOTIFICATION_CREATED: 'notification.created',
} as const;

/** Union type of all valid real-time event name values. */
export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
