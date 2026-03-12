import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Context carried through every async operation within a request or job.
 * Bound to AsyncLocalStorage so getTraceId() works anywhere in the call stack.
 */
export interface TraceContext {
  traceId: string;
  tenantId?: string;
}

/**
 * Singleton AsyncLocalStorage instance for trace propagation.
 * On the client (where async_hooks is stubbed out), falls back to a no-op
 * implementation so modules that transitively import trace-context don't crash.
 */
const traceStore: AsyncLocalStorage<TraceContext> =
  typeof AsyncLocalStorage === 'function'
    ? new AsyncLocalStorage<TraceContext>()
    : ({ getStore: () => undefined, run: (_ctx: TraceContext, fn: () => unknown) => fn() } as AsyncLocalStorage<TraceContext>);

/** Sentinel value returned when no trace context is active. */
const NO_TRACE = 'no-trace';

/**
 * Reads the current traceId from async context.
 * Returns 'no-trace' if called outside any trace context (e.g. module init).
 */
export function getTraceId(): string {
  return traceStore.getStore()?.traceId ?? NO_TRACE;
}

/**
 * Reads the tenantId from the current trace context, if present.
 * Returns undefined when no context is active or tenantId was not set.
 */
export function getTenantIdFromTrace(): string | undefined {
  return traceStore.getStore()?.tenantId;
}

/**
 * Runs `fn` inside a new AsyncLocalStorage context with the given trace values.
 * All code executing within `fn` (including nested async calls) will see the
 * provided traceId and tenantId via getTraceId() / getTenantIdFromTrace().
 */
export function runWithTraceContext<T>(
  context: TraceContext,
  fn: () => T,
): T {
  return traceStore.run(context, fn);
}

/**
 * Generates a new trace ID using crypto.randomUUID().
 * Falls back to globalThis.crypto (browser) when node:crypto is stubbed out.
 * UUIDv4 format — sufficient for log correlation.
 */
export function generateTraceId(): string {
  return typeof randomUUID === 'function'
    ? randomUUID()
    : globalThis.crypto.randomUUID();
}
