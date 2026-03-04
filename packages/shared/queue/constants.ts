/**
 * Canonical queue names for all BullMQ queues.
 * Each queue maps to a specific domain of background work.
 */
export const QUEUE_NAMES = {
  sync: 'sync',
  'file-processing': 'file-processing',
  email: 'email',
  automation: 'automation',
  'document-gen': 'document-gen',
  cleanup: 'cleanup',
} as const;

/** Union type of all valid queue names. */
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
