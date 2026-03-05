/**
 * Platform API Request Logger
 *
 * Fire-and-forget logging of API requests into the api_request_log table.
 * Never fails the API response — all insert errors are swallowed and
 * logged to Pino.
 *
 * @see docs/reference/platform-api.md § Authentication → Database Schema
 */

import { db, apiRequestLog } from '@everystack/shared/db';
import { generateUUIDv7 } from '@everystack/shared/db';
import { createLogger } from '@everystack/shared/logging';

const logger = createLogger({ service: 'api-request-log' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiRequestLogEntry {
  tenantId: string;
  apiKeyId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestSize: number | null;
  responseSize: number | null;
}

// ---------------------------------------------------------------------------
// logApiRequest
// ---------------------------------------------------------------------------

/**
 * Insert a row into api_request_log. Intended to be called fire-and-forget
 * after the response is sent — the caller should not await this.
 *
 * On failure, logs the error via Pino and returns silently.
 * This function NEVER throws.
 */
export async function logApiRequest(entry: ApiRequestLogEntry): Promise<void> {
  try {
    await db.insert(apiRequestLog).values({
      id: generateUUIDv7(),
      tenantId: entry.tenantId,
      apiKeyId: entry.apiKeyId,
      method: entry.method,
      path: entry.path,
      statusCode: entry.statusCode,
      durationMs: entry.durationMs,
      requestSize: entry.requestSize,
      responseSize: entry.responseSize,
      createdAt: new Date(),
    });
  } catch (err: unknown) {
    logger.error(
      { err, tenantId: entry.tenantId, apiKeyId: entry.apiKeyId },
      'Failed to insert API request log',
    );
  }
}
