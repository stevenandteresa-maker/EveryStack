/**
 * Audit Log Write Helper — Seven-Source Attribution
 *
 * Provides `writeAuditLog()` and `writeAuditLogBatch()` for recording
 * immutable audit trail entries within the same database transaction as
 * the mutation they describe. Wrapped in try/catch — never fails the
 * parent transaction.
 *
 * @see docs/reference/audit-log.md
 */

import { z } from 'zod';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { auditLog } from './schema/audit-log';
import { generateUUIDv7 } from './uuid';
import { createLogger } from '../logging/logger';

const logger = createLogger({ service: 'audit' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const AUDIT_ACTOR_TYPES = [
  'user',
  'sync',
  'automation',
  'portal_client',
  'system',
  'agent',
  'api_key',
] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export interface AuditEntry {
  tenantId: string;
  actorType: AuditActorType;
  actorId: string | null;
  actorLabel?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  traceId: string;
  ipAddress?: string;
}

/**
 * Batch audit details for sync operations affecting >10 records.
 * Written as a single condensed entry instead of per-record entries.
 */
export interface AuditBatchDetails {
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  recordIdsCreated: string[];
  recordIdsUpdated: string[];
  recordIdsDeleted: string[];
  truncated?: boolean;
}

export type AuditBatchEntry = Omit<AuditEntry, 'entityType' | 'entityId'> & {
  entityType: string;
  entityId: string;
  batchDetails: AuditBatchDetails;
};

// ---------------------------------------------------------------------------
// Transaction type — compatible with db.transaction() callback parameter
// ---------------------------------------------------------------------------

export type DrizzleTransaction = PostgresJsDatabase;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const auditEntrySchema = z
  .object({
    tenantId: z.string().uuid(),
    actorType: z.enum(AUDIT_ACTOR_TYPES),
    actorId: z.string().uuid().nullable(),
    actorLabel: z.string().max(255).nullable().optional(),
    action: z.string().min(1).max(64),
    entityType: z.string().min(1).max(64),
    entityId: z.string().uuid(),
    details: z.record(z.string(), z.unknown()),
    traceId: z.string().min(1),
    ipAddress: z.string().max(45).optional(),
  })
  .superRefine((data, ctx) => {
    // actorId required when actorType !== 'system'
    if (data.actorType !== 'system' && !data.actorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'actorId is required when actorType is not system',
        path: ['actorId'],
      });
    }
    // actorLabel only allowed when actorType === 'api_key'
    if (data.actorType !== 'api_key' && data.actorLabel != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'actorLabel is only allowed when actorType is api_key',
        path: ['actorLabel'],
      });
    }
  });

// ---------------------------------------------------------------------------
// Retention config — plan name → retention days
// ---------------------------------------------------------------------------

export const AUDIT_RETENTION_DAYS = {
  freelancer: 30,
  starter: 90,
  professional: 365,
  business: 730,
  enterprise: Infinity,
} as const;

// ---------------------------------------------------------------------------
// Sentry helper — dynamic import to avoid hard dependency in shared package
// ---------------------------------------------------------------------------

async function captureException(error: unknown): Promise<void> {
  try {
    const Sentry = await import('@sentry/node');
    Sentry.captureException(error);
  } catch {
    // Sentry not available in this context — already logged via Pino
  }
}

// ---------------------------------------------------------------------------
// Write functions
// ---------------------------------------------------------------------------

const BATCH_ID_CAP = 1_000;

/**
 * Write a single audit log entry within an existing database transaction.
 *
 * MUST be called inside the same transaction as the mutation it describes.
 * Wrapped in try/catch — never fails the parent transaction. On failure,
 * logs to Pino at error level and reports to Sentry.
 */
export async function writeAuditLog(
  tx: DrizzleTransaction,
  entry: AuditEntry,
): Promise<void> {
  try {
    const validated = auditEntrySchema.parse(entry);

    await tx.insert(auditLog).values({
      id: generateUUIDv7(),
      tenantId: validated.tenantId,
      actorType: validated.actorType,
      actorId: validated.actorId,
      actorLabel: validated.actorLabel ?? null,
      action: validated.action,
      entityType: validated.entityType,
      entityId: validated.entityId,
      details: validated.details,
      traceId: validated.traceId,
      ipAddress: validated.ipAddress ?? null,
      createdAt: new Date(),
    });
  } catch (error) {
    logger.error({ error, auditEntry: entry }, 'Audit write failed');
    await captureException(error);
  }
}

/**
 * Write a condensed batch audit entry for sync operations affecting >10 records.
 *
 * Caps `recordIds*` arrays at 1,000 entries and sets `truncated: true` if overflow.
 * Uses action `sync.batch_complete`. Same try/catch pattern as writeAuditLog().
 */
export async function writeAuditLogBatch(
  tx: DrizzleTransaction,
  entry: AuditBatchEntry,
): Promise<void> {
  try {
    const { batchDetails, ...baseEntry } = entry;

    // Cap record ID arrays at 1,000
    const truncated =
      batchDetails.recordIdsCreated.length > BATCH_ID_CAP ||
      batchDetails.recordIdsUpdated.length > BATCH_ID_CAP ||
      batchDetails.recordIdsDeleted.length > BATCH_ID_CAP;

    const cappedDetails: Record<string, unknown> = {
      records_created: batchDetails.recordsCreated,
      records_updated: batchDetails.recordsUpdated,
      records_deleted: batchDetails.recordsDeleted,
      record_ids_created: batchDetails.recordIdsCreated.slice(0, BATCH_ID_CAP),
      record_ids_updated: batchDetails.recordIdsUpdated.slice(0, BATCH_ID_CAP),
      record_ids_deleted: batchDetails.recordIdsDeleted.slice(0, BATCH_ID_CAP),
      ...(truncated || batchDetails.truncated ? { truncated: true } : {}),
      ...baseEntry.details,
    };

    const auditEntry: AuditEntry = {
      ...baseEntry,
      action: 'sync.batch_complete',
      details: cappedDetails,
    };

    await writeAuditLog(tx, auditEntry);
  } catch (error) {
    logger.error({ error, batchEntry: entry }, 'Audit batch write failed');
    await captureException(error);
  }
}
