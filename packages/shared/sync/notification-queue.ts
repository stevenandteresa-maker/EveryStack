// ---------------------------------------------------------------------------
// Notification Queue — abstraction for enqueuing email notification jobs
//
// Used by sync-notifications.ts to enqueue email jobs without depending
// on BullMQ directly (BullMQ is a worker dependency, not a shared one).
//
// The worker registers its queue implementation at startup via setEnqueueEmail().
// ---------------------------------------------------------------------------

/**
 * Shape of an email notification job to be enqueued.
 */
export interface NotificationEmailJob {
  tenantId: string;
  traceId: string;
  triggeredBy: string;
  to: string;
  templateId: string;
  subject: string;
  payload: Record<string, unknown>;
}

/**
 * Function type for enqueuing email notifications.
 * Implementations should add the job to BullMQ's email queue.
 */
export type EnqueueEmailFn = (job: NotificationEmailJob) => Promise<void>;

let enqueueEmail: EnqueueEmailFn | null = null;

/**
 * Register the email enqueue implementation.
 * Called by the worker at startup to wire the BullMQ queue.
 */
export function setEnqueueEmail(fn: EnqueueEmailFn): void {
  enqueueEmail = fn;
}

/**
 * Returns the registered email enqueue function.
 * Throws if not yet registered (worker hasn't started).
 */
export function getEnqueueEmail(): EnqueueEmailFn {
  if (!enqueueEmail) {
    throw new Error(
      'Email enqueue function not registered. Call setEnqueueEmail() at worker startup.',
    );
  }
  return enqueueEmail;
}
