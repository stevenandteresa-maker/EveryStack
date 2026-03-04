import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@everystack/shared/queue';
import type { QueueName, QueueJobDataMap } from '@everystack/shared/queue';
import { getRedisConfig } from '@everystack/shared/redis';
import { workerLogger } from '@everystack/shared/logging';

const queues = new Map<string, Queue>();

/**
 * Returns a BullMQ Queue instance for the given queue name.
 * Lazy-creates and caches the instance on first call.
 */
export function getQueue<N extends QueueName>(
  name: N,
): Queue<QueueJobDataMap[N]> {
  const existing = queues.get(name);
  if (existing) {
    return existing as Queue<QueueJobDataMap[N]>;
  }

  const connection = getRedisConfig(`queue:${name}`);
  const queue = new Queue(name, { connection });
  queues.set(name, queue);
  return queue as Queue<QueueJobDataMap[N]>;
}

/**
 * Creates all 6 queues eagerly. Call at worker startup to ensure
 * Redis connections are established before any job is enqueued.
 */
export function initializeQueues(): void {
  const names = Object.values(QUEUE_NAMES);
  for (const name of names) {
    getQueue(name);
  }
  workerLogger.info(
    { queues: names },
    `Initialized ${names.length} queues`,
  );
}

/**
 * Closes all cached Queue instances and their Redis connections.
 * Call during graceful shutdown.
 */
export async function closeAllQueues(): Promise<void> {
  const entries = [...queues.entries()];
  await Promise.all(
    entries.map(async ([name, queue]) => {
      await queue.close();
      workerLogger.debug({ queue: name }, 'Queue closed');
    }),
  );
  queues.clear();
  workerLogger.info('All queues closed');
}
