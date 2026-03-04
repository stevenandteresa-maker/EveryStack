/**
 * AI Usage Logger — writes AI call records to ai_usage_log.
 *
 * Every AI API call is logged immediately after the provider response is received.
 * This is the single source of truth for all metering, billing, and admin reporting.
 *
 * Error calls (status !== 'success') are logged with credits_charged: 0
 * to prevent budget drain from API outages.
 */

import { getDbForTenant } from '../../db/client';
import { generateUUIDv7 } from '../../db/uuid';
import { aiUsageLog } from '../../db/schema/ai-usage-log';
import { createLogger } from '../../logging/logger';
import { getTraceId } from '../../logging/trace-context';
import type { AIFeature } from './features';

const logger = createLogger({ service: 'ai-metering' });

/** Input shape for logging an AI usage event */
export interface UsageLogEntry {
  tenantId: string;
  userId: string;
  feature: AIFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInput?: number;
  costUsd: number;
  creditsCharged: number;
  requestId?: string;
  durationMs?: number;
  status: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an AI API call to ai_usage_log.
 *
 * - Generates UUIDv7 for the row ID
 * - Error calls (status !== 'success') force credits_charged to 0
 * - Uses getDbForTenant() for tenant-scoped write access
 * - Logs at info level with traceId via Pino
 */
export async function logAIUsage(entry: UsageLogEntry): Promise<void> {
  const db = getDbForTenant(entry.tenantId, 'write');

  // Error calls never charge credits — prevents budget drain from API outages
  const creditsCharged = entry.status === 'success' ? entry.creditsCharged : 0;

  await db.insert(aiUsageLog).values({
    id: generateUUIDv7(),
    tenantId: entry.tenantId,
    userId: entry.userId,
    feature: entry.feature,
    model: entry.model,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    cachedInput: entry.cachedInput ?? 0,
    costUsd: String(entry.costUsd),
    creditsCharged: String(creditsCharged),
    status: entry.status,
    durationMs: entry.durationMs ?? null,
    metadata: entry.metadata ?? {},
  });

  logger.info(
    {
      traceId: getTraceId(),
      tenantId: entry.tenantId,
      userId: entry.userId,
      feature: entry.feature,
      model: entry.model,
      creditsCharged,
      status: entry.status,
    },
    'AI usage logged',
  );
}
