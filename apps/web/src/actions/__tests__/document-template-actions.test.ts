/**
 * Tests for document-template server actions.
 *
 * Covers:
 * - createDocumentTemplate: Zod validate, auth, insert
 * - updateDocumentTemplate: validate, verify ownership, increment version
 * - duplicateDocumentTemplate: copy content/settings, append "(Copy)"
 * - deleteDocumentTemplate: verify ownership, block if generated docs exist
 * - Zod schema validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  TENANT_ID,
  USER_ID,
  TEMPLATE_ID,
  TABLE_ID,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockTransaction,
  mockDb,
  mockGetAuthContext,
  mockWriteAuditLog,
} = vi.hoisted(() => {
  const _TENANT_ID = crypto.randomUUID();
  const _USER_ID = crypto.randomUUID();
  const _TEMPLATE_ID = crypto.randomUUID();
  const _TABLE_ID = crypto.randomUUID();

  // Chainable select mock
  const _mockLimit = vi.fn().mockResolvedValue([]);
  const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
  const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: _mockFrom });

  // Chainable insert mock
  const _mockInsertReturning = vi.fn().mockResolvedValue([]);
  const _mockInsertValues = vi.fn().mockReturnValue({ returning: _mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: _mockInsertValues });

  // Chainable update mock
  const _mockUpdateReturning = vi.fn().mockResolvedValue([]);
  const _mockUpdateWhere = vi.fn().mockReturnValue({ returning: _mockUpdateReturning });
  const _mockUpdateSet = vi.fn().mockReturnValue({ where: _mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: _mockUpdateSet });

  // Chainable delete mock
  const _mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: _mockDeleteWhere });

  // Transaction mock
  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });
  });

  const mockDb = { transaction: mockTransaction };

  return {
    TENANT_ID: _TENANT_ID,
    USER_ID: _USER_ID,
    TEMPLATE_ID: _TEMPLATE_ID,
    TABLE_ID: _TABLE_ID,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockTransaction,
    mockDb,
    mockGetAuthContext: vi.fn().mockResolvedValue({
      userId: _USER_ID,
      tenantId: _TENANT_ID,
      clerkUserId: 'clerk_test',
      agencyTenantId: null,
    }),
    mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: mockGetAuthContext,
}));

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => mockDb),
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => 'count_agg'),
  documentTemplates: {
    id: 'documentTemplates.id',
    tenantId: 'documentTemplates.tenantId',
    tableId: 'documentTemplates.tableId',
    name: 'documentTemplates.name',
    content: 'documentTemplates.content',
    settings: 'documentTemplates.settings',
    version: 'documentTemplates.version',
    environment: 'documentTemplates.environment',
    createdBy: 'documentTemplates.createdBy',
    createdAt: 'documentTemplates.createdAt',
    updatedAt: 'documentTemplates.updatedAt',
  },
  generatedDocuments: {
    id: 'generatedDocuments.id',
    tenantId: 'generatedDocuments.tenantId',
    templateId: 'generatedDocuments.templateId',
  },
  generateUUIDv7: vi.fn(() => crypto.randomUUID()),
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'test-trace-id'),
}));

vi.mock('@/lib/errors', () => {
  class AppError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  class NotFoundError extends AppError {
    constructor(message: string) { super('NOT_FOUND', message); }
  }
  class ConflictError extends AppError {
    constructor(message: string) { super('CONFLICT', message); }
  }
  return {
    AppError,
    NotFoundError,
    ConflictError,
    wrapUnknownError: (e: unknown) => e instanceof Error ? e : new Error(String(e)),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  createDocumentTemplate,
  updateDocumentTemplate,
  duplicateDocumentTemplate,
  deleteDocumentTemplate,
} from '../document-templates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date();

function makeTemplate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: TEMPLATE_ID,
    tenantId: TENANT_ID,
    tableId: TABLE_ID,
    name: 'Invoice Template',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    settings: { pageSize: 'A4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 } },
    version: 1,
    environment: 'live',
    createdBy: USER_ID,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Configure the mock chain for select queries.
 * Supports multiple sequential select calls within one transaction.
 * Each result set supports both `.where().limit()` and `.where()` (thenable) patterns.
 */
function setupSelectResults(...resultSets: unknown[][]) {
  let callIndex = 0;
  mockSelect.mockImplementation(() => {
    const idx = callIndex++;
    const rs = resultSets[idx] ?? [];
    // Create a result that is both thenable (for count queries without .limit())
    // and has a .limit() method (for queries with .limit())
    const limitFn = vi.fn().mockResolvedValue(rs);
    const whereResult = Object.assign(
      Promise.resolve(rs),
      { limit: limitFn },
    );
    const whereFn = vi.fn().mockReturnValue(whereResult);
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    return { from: fromFn };
  });
}

function setupInsertResults(rows: unknown[]) {
  const returningFn = vi.fn().mockResolvedValue(rows);
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  mockInsert.mockReturnValue({ values: valuesFn });
}

function setupUpdateResults(rows: unknown[]) {
  const returningFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  mockUpdate.mockReturnValue({ set: setFn });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('document-template-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // createDocumentTemplate
  // =========================================================================

  describe('createDocumentTemplate', () => {
    it('creates a template with defaults', async () => {
      const template = makeTemplate();
      setupInsertResults([template]);

      const result = await createDocumentTemplate({
        name: 'Invoice Template',
        tableId: TABLE_ID,
      });

      expect(result).toEqual(template);
      expect(mockTransaction).toHaveBeenCalledOnce();
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'document_template.created',
          entityType: 'document_template',
        }),
      );
    });

    it('passes custom content and settings', async () => {
      const customContent = { type: 'doc', content: [{ type: 'heading', level: 1 }] };
      const customSettings = {
        pageSize: 'Letter',
        orientation: 'landscape' as const,
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
      };
      const template = makeTemplate({ content: customContent, settings: customSettings });
      setupInsertResults([template]);

      const result = await createDocumentTemplate({
        name: 'Custom Template',
        tableId: TABLE_ID,
        content: customContent,
        settings: customSettings,
      });

      expect(result).toEqual(template);
    });

    it('rejects empty name', async () => {
      await expect(
        createDocumentTemplate({ name: '', tableId: TABLE_ID }),
      ).rejects.toThrow();
    });

    it('rejects name exceeding 255 characters', async () => {
      await expect(
        createDocumentTemplate({ name: 'x'.repeat(256), tableId: TABLE_ID }),
      ).rejects.toThrow();
    });

    it('rejects invalid tableId', async () => {
      await expect(
        createDocumentTemplate({ name: 'Test', tableId: 'not-a-uuid' }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // updateDocumentTemplate
  // =========================================================================

  describe('updateDocumentTemplate', () => {
    it('updates name and increments version', async () => {
      const existing = makeTemplate({ version: 3 });
      const updated = makeTemplate({ version: 4, name: 'Renamed' });

      setupSelectResults([existing]);
      setupUpdateResults([updated]);

      const result = await updateDocumentTemplate({
        templateId: TEMPLATE_ID,
        name: 'Renamed',
      });

      expect(result).toEqual(updated);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'document_template.updated',
          details: expect.objectContaining({ version: 4 }),
        }),
      );
    });

    it('throws NotFoundError for missing template', async () => {
      setupSelectResults([]);

      await expect(
        updateDocumentTemplate({ templateId: TEMPLATE_ID, name: 'New Name' }),
      ).rejects.toThrow('Document template not found');
    });

    it('rejects when no fields provided', async () => {
      await expect(
        updateDocumentTemplate({ templateId: TEMPLATE_ID }),
      ).rejects.toThrow('At least one of name, content, or settings must be provided');
    });
  });

  // =========================================================================
  // duplicateDocumentTemplate
  // =========================================================================

  describe('duplicateDocumentTemplate', () => {
    it('copies content/settings and appends (Copy) to name', async () => {
      const existing = makeTemplate({ name: 'Invoice' });
      const duplicated = makeTemplate({ name: 'Invoice (Copy)', id: crypto.randomUUID() });

      setupSelectResults([existing]);
      setupInsertResults([duplicated]);

      const result = await duplicateDocumentTemplate({
        templateId: TEMPLATE_ID,
      });

      expect(result).toEqual(duplicated);
      expect(result.name).toBe('Invoice (Copy)');
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'document_template.duplicated',
          details: expect.objectContaining({
            sourceTemplateId: TEMPLATE_ID,
            name: 'Invoice (Copy)',
          }),
        }),
      );
    });

    it('throws NotFoundError for missing template', async () => {
      setupSelectResults([]);

      await expect(
        duplicateDocumentTemplate({ templateId: TEMPLATE_ID }),
      ).rejects.toThrow('Document template not found');
    });
  });

  // =========================================================================
  // deleteDocumentTemplate
  // =========================================================================

  describe('deleteDocumentTemplate', () => {
    it('deletes template with no generated documents', async () => {
      // First select: template exists. Second select: count of generated docs = 0.
      setupSelectResults(
        [{ id: TEMPLATE_ID }],
        [{ value: 0 }],
      );

      await expect(
        deleteDocumentTemplate({ templateId: TEMPLATE_ID }),
      ).resolves.toBeUndefined();

      expect(mockDelete).toHaveBeenCalled();
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'document_template.deleted',
        }),
      );
    });

    it('blocks deletion when generated documents exist', async () => {
      setupSelectResults(
        [{ id: TEMPLATE_ID }],
        [{ value: 3 }],
      );

      await expect(
        deleteDocumentTemplate({ templateId: TEMPLATE_ID }),
      ).rejects.toThrow('Cannot delete template with existing generated documents');
    });

    it('throws NotFoundError for missing template', async () => {
      setupSelectResults([]);

      await expect(
        deleteDocumentTemplate({ templateId: TEMPLATE_ID }),
      ).rejects.toThrow('Document template not found');
    });
  });

  // =========================================================================
  // Zod schema validation
  // =========================================================================

  describe('Zod schema validation', () => {
    it('createDocumentTemplateSchema accepts minimal input', async () => {
      const template = makeTemplate();
      setupInsertResults([template]);

      // Should succeed — content and settings have defaults
      const result = await createDocumentTemplate({
        name: 'Minimal',
        tableId: TABLE_ID,
      });

      expect(result).toBeDefined();
    });

    it('updateDocumentTemplateSchema rejects invalid templateId', async () => {
      await expect(
        updateDocumentTemplate({ templateId: 'bad', name: 'Test' }),
      ).rejects.toThrow();
    });

    it('deleteDocumentTemplateSchema rejects invalid templateId', async () => {
      await expect(
        deleteDocumentTemplate({ templateId: 'bad' }),
      ).rejects.toThrow();
    });

    it('duplicateDocumentTemplateSchema rejects invalid templateId', async () => {
      await expect(
        duplicateDocumentTemplate({ templateId: 'bad' }),
      ).rejects.toThrow();
    });
  });
});
