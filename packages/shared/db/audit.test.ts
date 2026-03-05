import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateUUIDv7 } from './uuid';
import {
  writeAuditLog,
  writeAuditLogBatch,
  auditEntrySchema,
  AUDIT_RETENTION_DAYS,
  AUDIT_ACTOR_TYPES,
} from './audit';
import type { AuditEntry, AuditBatchEntry, DrizzleTransaction } from './audit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../logging/logger', () => {
  const errorFn = vi.fn();
  return {
    createLogger: () => ({
      error: errorFn,
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
    __errorFn: errorFn,
  };
});

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

function createMockTx() {
  const insertValues = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  const insertFn = vi.fn().mockReturnValue({ values: insertValues });

  return {
    tx: { insert: insertFn } as unknown as DrizzleTransaction,
    insertFn,
    insertValues,
  };
}

function validEntry(overrides?: Partial<AuditEntry>): AuditEntry {
  return {
    tenantId: generateUUIDv7(),
    actorType: 'user',
    actorId: generateUUIDv7(),
    action: 'record.updated',
    entityType: 'record',
    entityId: generateUUIDv7(),
    details: { tableId: generateUUIDv7() },
    traceId: generateUUIDv7(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// auditEntrySchema validation
// ---------------------------------------------------------------------------

describe('auditEntrySchema', () => {
  it('accepts all 7 valid actor types', () => {
    for (const actorType of AUDIT_ACTOR_TYPES) {
      const entry = validEntry({
        actorType,
        actorId: actorType === 'system' ? null : generateUUIDv7(),
        actorLabel: actorType === 'api_key' ? 'ExternalApp' : undefined,
      });
      expect(() => auditEntrySchema.parse(entry)).not.toThrow();
    }
  });

  it('rejects unknown actorType', () => {
    const entry = validEntry({ actorType: 'hacker' as AuditEntry['actorType'] });
    const result = auditEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('rejects missing actorId when actorType is not system', () => {
    const entry = validEntry({ actorType: 'user', actorId: null });
    const result = auditEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('actorId is required when actorType is not system');
    }
  });

  it('allows null actorId when actorType is system', () => {
    const entry = validEntry({ actorType: 'system', actorId: null });
    expect(() => auditEntrySchema.parse(entry)).not.toThrow();
  });

  it('rejects actorLabel when actorType is not api_key', () => {
    const entry = validEntry({
      actorType: 'user',
      actorId: generateUUIDv7(),
      actorLabel: 'SomeLabel',
    });
    const result = auditEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('actorLabel is only allowed when actorType is api_key');
    }
  });

  it('allows actorLabel when actorType is api_key', () => {
    const entry = validEntry({
      actorType: 'api_key',
      actorId: generateUUIDv7(),
      actorLabel: 'JobStack: plumber@acme.com',
    });
    expect(() => auditEntrySchema.parse(entry)).not.toThrow();
  });

  it('rejects empty action string', () => {
    const entry = validEntry({ action: '' });
    const result = auditEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for tenantId', () => {
    const entry = validEntry({ tenantId: 'not-a-uuid' });
    const result = auditEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// writeAuditLog
// ---------------------------------------------------------------------------

describe('writeAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a valid audit entry within a transaction', async () => {
    const { tx, insertFn, insertValues } = createMockTx();
    const entry = validEntry();

    await writeAuditLog(tx, entry);

    expect(insertFn).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);

    const insertedValues = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues).toMatchObject({
      tenantId: entry.tenantId,
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details,
      traceId: entry.traceId,
    });
    expect(insertedValues.id).toBeDefined();
    expect(insertedValues.createdAt).toBeInstanceOf(Date);
  });

  it('inserts a system actor entry with null actorId', async () => {
    const { tx, insertValues } = createMockTx();
    const entry = validEntry({ actorType: 'system', actorId: null });

    await writeAuditLog(tx, entry);

    const insertedValues = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues.actorId).toBeNull();
    expect(insertedValues.actorType).toBe('system');
  });

  it('does not throw when the insert fails', async () => {
    const insertFn = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB insert failed')),
    });
    const tx = { insert: insertFn } as unknown as DrizzleTransaction;
    const entry = validEntry();

    // Should not throw
    await expect(writeAuditLog(tx, entry)).resolves.toBeUndefined();
  });

  it('logs to Pino when insert fails', async () => {
    const { __errorFn: errorFn } = await import('../logging/logger') as unknown as { __errorFn: ReturnType<typeof vi.fn> };
    const insertFn = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB insert failed')),
    });
    const tx = { insert: insertFn } as unknown as DrizzleTransaction;
    const entry = validEntry();

    await writeAuditLog(tx, entry);

    expect(errorFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Audit write failed',
    );
  });

  it('reports to Sentry when insert fails', async () => {
    const Sentry = await import('@sentry/node');
    const insertFn = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB insert failed')),
    });
    const tx = { insert: insertFn } as unknown as DrizzleTransaction;
    const entry = validEntry();

    await writeAuditLog(tx, entry);

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not throw when validation fails', async () => {
    const { tx } = createMockTx();
    const badEntry = { ...validEntry(), actorType: 'invalid' } as unknown as AuditEntry;

    await expect(writeAuditLog(tx, badEntry)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// writeAuditLogBatch
// ---------------------------------------------------------------------------

describe('writeAuditLogBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a batch audit entry with sync.batch_complete action', async () => {
    const { tx, insertValues } = createMockTx();
    const batchEntry: AuditBatchEntry = {
      tenantId: generateUUIDv7(),
      actorType: 'sync',
      actorId: generateUUIDv7(),
      action: 'sync.batch_complete',
      entityType: 'table',
      entityId: generateUUIDv7(),
      details: { platform: 'airtable' },
      traceId: generateUUIDv7(),
      batchDetails: {
        recordsCreated: 5,
        recordsUpdated: 10,
        recordsDeleted: 2,
        recordIdsCreated: Array.from({ length: 5 }, () => generateUUIDv7()),
        recordIdsUpdated: Array.from({ length: 10 }, () => generateUUIDv7()),
        recordIdsDeleted: Array.from({ length: 2 }, () => generateUUIDv7()),
      },
    };

    await writeAuditLogBatch(tx, batchEntry);

    expect(insertValues).toHaveBeenCalledTimes(1);
    const inserted = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.action).toBe('sync.batch_complete');
    expect(inserted.details).toMatchObject({
      records_created: 5,
      records_updated: 10,
      records_deleted: 2,
      platform: 'airtable',
    });
  });

  it('caps record ID arrays at 1,000 and sets truncated: true', async () => {
    const { tx, insertValues } = createMockTx();
    const largeArray = Array.from({ length: 1_500 }, () => generateUUIDv7());

    const batchEntry: AuditBatchEntry = {
      tenantId: generateUUIDv7(),
      actorType: 'sync',
      actorId: generateUUIDv7(),
      action: 'sync.batch_complete',
      entityType: 'table',
      entityId: generateUUIDv7(),
      details: {},
      traceId: generateUUIDv7(),
      batchDetails: {
        recordsCreated: 1_500,
        recordsUpdated: 0,
        recordsDeleted: 0,
        recordIdsCreated: largeArray,
        recordIdsUpdated: [],
        recordIdsDeleted: [],
      },
    };

    await writeAuditLogBatch(tx, batchEntry);

    expect(insertValues).toHaveBeenCalledTimes(1);
    const inserted = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    const details = inserted.details as Record<string, unknown>;
    expect((details.record_ids_created as string[]).length).toBe(1_000);
    expect(details.truncated).toBe(true);
  });

  it('does not set truncated when arrays are under cap', async () => {
    const { tx, insertValues } = createMockTx();

    const batchEntry: AuditBatchEntry = {
      tenantId: generateUUIDv7(),
      actorType: 'sync',
      actorId: generateUUIDv7(),
      action: 'sync.batch_complete',
      entityType: 'table',
      entityId: generateUUIDv7(),
      details: {},
      traceId: generateUUIDv7(),
      batchDetails: {
        recordsCreated: 3,
        recordsUpdated: 0,
        recordsDeleted: 0,
        recordIdsCreated: Array.from({ length: 3 }, () => generateUUIDv7()),
        recordIdsUpdated: [],
        recordIdsDeleted: [],
      },
    };

    await writeAuditLogBatch(tx, batchEntry);

    const inserted = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    const details = inserted.details as Record<string, unknown>;
    expect(details.truncated).toBeUndefined();
  });

  it('does not throw when insert fails', async () => {
    const insertFn = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB insert failed')),
    });
    const tx = { insert: insertFn } as unknown as DrizzleTransaction;

    const batchEntry: AuditBatchEntry = {
      tenantId: generateUUIDv7(),
      actorType: 'sync',
      actorId: generateUUIDv7(),
      action: 'sync.batch_complete',
      entityType: 'table',
      entityId: generateUUIDv7(),
      details: {},
      traceId: generateUUIDv7(),
      batchDetails: {
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsDeleted: 0,
        recordIdsCreated: [],
        recordIdsUpdated: [],
        recordIdsDeleted: [],
      },
    };

    await expect(writeAuditLogBatch(tx, batchEntry)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AUDIT_RETENTION_DAYS
// ---------------------------------------------------------------------------

describe('AUDIT_RETENTION_DAYS', () => {
  it('defines retention for all 5 plan tiers', () => {
    expect(AUDIT_RETENTION_DAYS.freelancer).toBe(30);
    expect(AUDIT_RETENTION_DAYS.starter).toBe(90);
    expect(AUDIT_RETENTION_DAYS.professional).toBe(365);
    expect(AUDIT_RETENTION_DAYS.business).toBe(730);
    expect(AUDIT_RETENTION_DAYS.enterprise).toBe(Infinity);
  });

  it('has exactly 5 plan tiers', () => {
    expect(Object.keys(AUDIT_RETENTION_DAYS)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// AUDIT_ACTOR_TYPES
// ---------------------------------------------------------------------------

describe('AUDIT_ACTOR_TYPES', () => {
  it('contains exactly 7 actor types', () => {
    expect(AUDIT_ACTOR_TYPES).toHaveLength(7);
    expect(AUDIT_ACTOR_TYPES).toEqual([
      'user',
      'sync',
      'automation',
      'portal_client',
      'system',
      'agent',
      'api_key',
    ]);
  });
});
