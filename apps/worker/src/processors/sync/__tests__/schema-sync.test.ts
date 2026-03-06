import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncConfig } from '@everystack/shared/sync';
import type { EventPublisher } from '@everystack/shared/realtime';
import type { Logger } from '@everystack/shared/logging';
import type { AirtableApiClient } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});
const mockDb = {
  insert: mockInsert,
  update: mockUpdate,
};

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => mockDb),
  tables: { id: 'id', workspaceId: 'workspace_id', tenantId: 'tenant_id', name: 'name' },
  fields: { id: 'id', tableId: 'table_id', tenantId: 'tenant_id', name: 'name', fieldType: 'field_type' },
  syncedFieldMappings: { id: 'id', tenantId: 'tenant_id' },
  baseConnections: { id: 'id', tenantId: 'tenant_id' },
  generateUUIDv7: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 8)}`),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@everystack/shared/sync', () => ({
  fieldTypeRegistry: {
    has: vi.fn((platform: string, fieldType: string) => {
      const supported = ['singleLineText', 'email', 'number', 'singleSelect', 'checkbox', 'date'];
      return platform === 'airtable' && supported.includes(fieldType);
    }),
    get: vi.fn(),
    getAllForPlatform: vi.fn(),
  },
}));

vi.mock('@everystack/shared/realtime', () => ({
  REALTIME_EVENTS: {
    SYNC_SCHEMA_READY: 'sync.schema_ready',
  },
}));

import { syncSchema } from '../schema-sync';
import { generateUUIDv7 } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockApiClient(
  fieldsPerTable: Record<string, Array<{ id: string; name: string; type: string; options?: Record<string, unknown> }>>,
): AirtableApiClient {
  return {
    listFields: vi.fn((tableId: string) => {
      return Promise.resolve(fieldsPerTable[tableId] ?? []);
    }),
    listRecords: vi.fn(),
    getRecord: vi.fn(),
  } as unknown as AirtableApiClient;
}

function createMockPublisher(): EventPublisher {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
  } as unknown as EventPublisher;
}

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  } as unknown as Logger;
}

function createSyncConfig(overrides?: Partial<SyncConfig>): SyncConfig {
  return {
    polling_interval_seconds: 300,
    tables: [
      {
        external_table_id: 'tbl001',
        external_table_name: 'Contacts',
        enabled: true,
        sync_filter: null,
        estimated_record_count: 100,
        synced_record_count: 0,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncSchema', () => {
  let publisher: EventPublisher;
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    publisher = createMockPublisher();
    logger = createMockLogger();

    // Reset mock insert to properly chain .values()
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it('creates ES tables and fields from Airtable metadata', async () => {
    const apiClient = createMockApiClient({
      tbl001: [
        { id: 'fldName', name: 'Name', type: 'singleLineText' },
        { id: 'fldEmail', name: 'Email', type: 'email' },
      ],
    });

    const result = await syncSchema({
      tenantId: 'tenant-1',
      connectionId: 'conn-1',
      baseId: 'appBase1',
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      syncConfig: createSyncConfig(),
      apiClient,
      eventPublisher: publisher,
      logger,
    });

    // Should have created 1 table
    expect(result.tableMap.size).toBe(1);
    expect(result.tableMap.has('tbl001')).toBe(true);

    // Should have called insert for: 1 table + 2 fields + 2 mappings = 5 inserts
    expect(mockInsert).toHaveBeenCalledTimes(5);

    // API client should have been called
    expect(apiClient.listFields).toHaveBeenCalledWith('tbl001');
  });

  it('creates synced_field_mappings rows', async () => {
    const apiClient = createMockApiClient({
      tbl001: [
        { id: 'fldName', name: 'Name', type: 'singleLineText' },
      ],
    });

    await syncSchema({
      tenantId: 'tenant-1',
      connectionId: 'conn-1',
      baseId: 'appBase1',
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      syncConfig: createSyncConfig(),
      apiClient,
      eventPublisher: publisher,
      logger,
    });

    // Third insert should be the synced_field_mapping (1 table + 1 field + 1 mapping)
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });

  it('skips unregistered field types with warning', async () => {
    const apiClient = createMockApiClient({
      tbl001: [
        { id: 'fldName', name: 'Name', type: 'singleLineText' },
        { id: 'fldUnknown', name: 'Unknown', type: 'externalSyncSource' },
      ],
    });

    await syncSchema({
      tenantId: 'tenant-1',
      connectionId: 'conn-1',
      baseId: 'appBase1',
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      syncConfig: createSyncConfig(),
      apiClient,
      eventPublisher: publisher,
      logger,
    });

    // Should warn about unregistered type
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ fieldType: 'externalSyncSource' }),
      expect.stringContaining('Skipping unregistered'),
    );

    // Should only create 1 field (not 2) + 1 table + 1 mapping = 3 inserts
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });

  it('remaps filter field IDs from platform to ES', async () => {
    // Set up deterministic UUIDs
    let uuidCounter = 0;
    vi.mocked(generateUUIDv7).mockImplementation(() => {
      uuidCounter++;
      return `uuid-${uuidCounter}`;
    });

    const apiClient = createMockApiClient({
      tbl001: [
        { id: 'fldStatus', name: 'Status', type: 'singleSelect' },
        { id: 'fldName', name: 'Name', type: 'singleLineText' },
      ],
    });

    const syncConfig = createSyncConfig({
      tables: [
        {
          external_table_id: 'tbl001',
          external_table_name: 'Contacts',
          enabled: true,
          sync_filter: [
            { fieldId: 'fldStatus', operator: 'equals', value: 'Active', conjunction: 'and' },
          ],
          estimated_record_count: 100,
          synced_record_count: 0,
        },
      ],
    });

    const result = await syncSchema({
      tenantId: 'tenant-1',
      connectionId: 'conn-1',
      baseId: 'appBase1',
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      syncConfig,
      apiClient,
      eventPublisher: publisher,
      logger,
    });

    // Filter should now use ES field UUID instead of fldStatus
    const tableConfig = result.updatedSyncConfig.tables[0]!;
    expect(tableConfig.sync_filter).not.toBeNull();
    expect(tableConfig.sync_filter![0]!.fieldId).not.toBe('fldStatus');
    // It should be one of the generated UUIDs
    expect(tableConfig.sync_filter![0]!.fieldId).toMatch(/^uuid-/);
  });

  it('emits SYNC_SCHEMA_READY event per table', async () => {
    const apiClient = createMockApiClient({
      tbl001: [
        { id: 'fldName', name: 'Name', type: 'singleLineText' },
      ],
    });

    await syncSchema({
      tenantId: 'tenant-1',
      connectionId: 'conn-1',
      baseId: 'appBase1',
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      syncConfig: createSyncConfig(),
      apiClient,
      eventPublisher: publisher,
      logger,
    });

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        channel: 'workspace:ws-1',
        event: 'sync.schema_ready',
        payload: expect.objectContaining({
          externalTableId: 'tbl001',
          tableName: 'Contacts',
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'Name', fieldType: 'text' }),
          ]),
        }),
      }),
    );
  });

  it('skips disabled tables', async () => {
    const apiClient = createMockApiClient({});

    const syncConfig = createSyncConfig({
      tables: [
        {
          external_table_id: 'tbl001',
          external_table_name: 'Contacts',
          enabled: false,
          sync_filter: null,
          estimated_record_count: 100,
          synced_record_count: 0,
        },
      ],
    });

    const result = await syncSchema({
      tenantId: 'tenant-1',
      connectionId: 'conn-1',
      baseId: 'appBase1',
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      syncConfig,
      apiClient,
      eventPublisher: publisher,
      logger,
    });

    expect(result.tableMap.size).toBe(0);
    expect(apiClient.listFields).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
