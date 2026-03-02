import type { NextResponse, NextRequest } from 'next/server';
import type { Logger } from '@everystack/shared/logging';
import {
  webLogger,
  createChildLogger,
  generateTraceId,
  runWithTraceContext,
  getTraceId,
} from '@everystack/shared/logging';

const TRACE_HEADER = 'X-Trace-Id';

/**
 * Wraps a Server Action handler in a trace context.
 *
 * - Generates a unique traceId per invocation
 * - Optionally binds tenantId if provided
 * - Runs the handler inside AsyncLocalStorage so getTraceId() works
 *   anywhere in the call stack
 * - Returns a child logger with { traceId, tenantId } bound
 *
 * @example
 * ```ts
 * export async function updateRecord(formData: FormData) {
 *   const { tenantId } = await getAuthContext();
 *   const { result, logger } = await withTraceContext({ tenantId }, async (log) => {
 *     log.info({ recordId }, 'Updating record');
 *     return doUpdate(recordId);
 *   });
 * }
 * ```
 */
export async function withTraceContext<T>(
  opts: { tenantId?: string },
  handler: (logger: Logger) => Promise<T>,
): Promise<{ result: T; logger: Logger }> {
  const traceId = generateTraceId();

  return runWithTraceContext(
    { traceId, tenantId: opts.tenantId },
    async () => {
      const bindings: Record<string, string> = { traceId };
      if (opts.tenantId) {
        bindings.tenantId = opts.tenantId;
      }
      const logger = createChildLogger(webLogger, bindings);
      const result = await handler(logger);
      return { result, logger };
    },
  );
}

/**
 * Wraps a Next.js Route Handler in a trace context.
 *
 * - Generates a unique traceId per request
 * - Optionally binds tenantId if provided
 * - Adds X-Trace-Id response header
 * - Logs request completion with method, url, statusCode, responseTime
 *
 * @example
 * ```ts
 * export const GET = withTraceContextRoute(async (req, log) => {
 *   log.info('Processing request');
 *   return NextResponse.json({ data: 'ok' });
 * });
 * ```
 */
export function withTraceContextRoute(
  handler: (
    req: NextRequest,
    logger: Logger,
  ) => Promise<NextResponse>,
  opts?: { tenantId?: string },
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const traceId = generateTraceId();
    const start = Date.now();

    return runWithTraceContext(
      { traceId, tenantId: opts?.tenantId },
      async () => {
        const bindings: Record<string, string> = { traceId };
        if (opts?.tenantId) {
          bindings.tenantId = opts.tenantId;
        }
        const logger = createChildLogger(webLogger, bindings);

        let response: NextResponse;
        let statusCode: number;

        try {
          response = await handler(req, logger);
          statusCode = response.status;
        } catch (error) {
          const responseTime = Date.now() - start;
          logger.error(
            {
              method: req.method,
              url: req.nextUrl.pathname,
              statusCode: 500,
              responseTime,
              err: error instanceof Error ? error.message : String(error),
            },
            'Request failed',
          );
          throw error;
        }

        const responseTime = Date.now() - start;
        response.headers.set(TRACE_HEADER, getTraceId());

        logger.info(
          {
            method: req.method,
            url: req.nextUrl.pathname,
            statusCode,
            responseTime,
          },
          'Request completed',
        );

        return response;
      },
    );
  };
}
