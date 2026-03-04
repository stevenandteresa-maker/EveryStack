/**
 * Lightweight BullMQ queue client for the web app.
 *
 * The web app only enqueues jobs — processing happens in the worker app.
 * Queue instances are lazy-created and cached per queue name.
 */
import { Queue } from 'bullmq';
import { getRedisConfig } from '@everystack/shared/redis';
import type { QueueName, QueueJobDataMap } from '@everystack/shared/queue';

const queues = new Map<string, Queue>();

/**
 * Get a BullMQ Queue instance for enqueuing jobs from the web app.
 * Lazy-creates and caches the instance on first call.
 */
export function getQueue<N extends QueueName>(
  name: N,
): Queue<QueueJobDataMap[N]> {
  const existing = queues.get(name);
  if (existing) {
    return existing as Queue<QueueJobDataMap[N]>;
  }

  const connection = getRedisConfig(`web:queue:${name}`);
  const queue = new Queue(name, { connection });
  queues.set(name, queue);
  return queue as Queue<QueueJobDataMap[N]>;
}
