import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkspaceDescriptor, TableDescriptor, LinkEdge } from '../types';
import type { DrizzleClient } from '../../../db/client';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing modules that use them
// ---------------------------------------------------------------------------

// Mock SchemaDescriptorCache
const mockGetWorkspaceDescriptor = vi.fn();
const mockCacheInstance = {
  getWorkspaceDescriptor: mockGetWorkspaceDescriptor,
  invalidateWorkspace: vi.fn(),
  invalidateUser: vi.fn(),
};

vi.mock('../cache', () => ({
  SchemaDescriptorCache: vi.fn(() => mockCacheInstance),
}));

// Mock buildTableDescriptor
const mockBuildTableDescriptor = vi.fn();
vi.mock('../table-builder', () => ({
  buildTableDescriptor: (...args: unknown[]) => mockBuildTableDescriptor(...args),
}));

// Mock filterDescriptorByPermissions
const mockFilterDescriptorByPermissions = vi.fn();
vi.mock('../permission-filter', () => ({
  filterDescriptorByPermissions: (...args: unknown[]) =>
    mockFilterDescriptorByPermissions(...args),
}));

// Mock logger (transitive dependency)
vi.mock('../../../logging/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock redis (transitive dependency)
vi.mock('../../../redis', () => ({
  createRedisClient: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
  })),
}));

// Now import the module under test
import { SchemaDescriptorService } from '../service';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001';
const TENANT_ID_OTHER = 'tenant-002';
const WORKSPACE_ID = 'ws-001';
const USER_ID = 'user-001';
const TABLE_ID = 'tbl-001';
const TABLE_ID_INACCESSIBLE = 'tbl-999';

const mockDb = {} as unknown as DrizzleClient;

function createWorkspaceDescriptor(
  overrides?: Partial<WorkspaceDescriptor>,
): WorkspaceDescriptor {
  return {
    workspace_id: WORKSPACE_ID,
    bases: [
      {
        base_id: 'base-001',
        name: 'Sales Base',
        platform: 'airtable',
        tables: [
          {
            table_id: TABLE_ID,
            name: 'Deals',
            record_count_approx: 500,
            fields: [
              {
                field_id: 'fld-001',
                name: 'Deal Name',
                type: 'text',
                searchable: true,
                aggregatable: false,
              },
              {
                field_id: 'fld-002',
                name: 'Amount',
                type: 'number',
                searchable: true,
                aggregatable: true,
              },
            ],
          },
        ],
      },
    ],
    link_graph: [
      {
        from: 'base-001.tbl-001.fld-link-1',
        to: 'base-001.tbl-002.fld-link-2',
        cardinality: 'many_to_one' as const,
        label: 'Deals → Contacts via Primary Contact',
      },
    ],
    ...overrides,
  };
}

function createTableDescriptor(
  overrides?: Partial<TableDescriptor>,
): TableDescriptor {
  return {
    table_id: TABLE_ID,
    name: 'Deals',
    record_count_approx: 500,
    fields: [
      {
        field_id: 'fld-001',
        name: 'Deal Name',
        type: 'text',
        searchable: true,
        aggregatable: false,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SchemaDescriptorService', () => {
  let service: SchemaDescriptorService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SchemaDescriptorService(mockCacheInstance as never, mockDb as never);
  });

  // -----------------------------------------------------------------------
  // describeWorkspace
  // -----------------------------------------------------------------------

  describe('describeWorkspace()', () => {
    it('returns cached descriptor on cache hit', async () => {
      const descriptor = createWorkspaceDescriptor();
      mockGetWorkspaceDescriptor.mockResolvedValue(descriptor);

      const result = await service.describeWorkspace(WORKSPACE_ID, USER_ID, TENANT_ID);

      expect(result).toEqual(descriptor);
      expect(mockGetWorkspaceDescriptor).toHaveBeenCalledWith(
        WORKSPACE_ID,
        USER_ID,
        TENANT_ID,
        mockDb,
      );
    }, 10_000);

    it('delegates build→filter→cache to SchemaDescriptorCache', async () => {
      // First call — cache miss internally, returns built + filtered descriptor
      const descriptor = createWorkspaceDescriptor();
      mockGetWorkspaceDescriptor.mockResolvedValue(descriptor);

      const result1 = await service.describeWorkspace(WORKSPACE_ID, USER_ID, TENANT_ID);
      expect(result1).toEqual(descriptor);

      // Second call — cache hit (still same mock, but demonstrates idempotency)
      const result2 = await service.describeWorkspace(WORKSPACE_ID, USER_ID, TENANT_ID);
      expect(result2).toEqual(descriptor);
      expect(mockGetWorkspaceDescriptor).toHaveBeenCalledTimes(2);
    }, 10_000);

    it('returns empty descriptor when cache returns null (catastrophic failure)', async () => {
      mockGetWorkspaceDescriptor.mockResolvedValue(null);

      const result = await service.describeWorkspace(WORKSPACE_ID, USER_ID, TENANT_ID);

      expect(result).toEqual({
        workspace_id: WORKSPACE_ID,
        bases: [],
        link_graph: [],
      });
    }, 10_000);
  });

  // -----------------------------------------------------------------------
  // describeTable
  // -----------------------------------------------------------------------

  describe('describeTable()', () => {
    it('returns filtered table descriptor for accessible table', async () => {
      const rawTable = createTableDescriptor();
      mockBuildTableDescriptor.mockResolvedValue(rawTable);

      // Permission filter keeps the table
      mockFilterDescriptorByPermissions.mockImplementation(
        (descriptor: WorkspaceDescriptor) => {
          // Return the descriptor as-is (table is accessible)
          return Promise.resolve(structuredClone(descriptor));
        },
      );

      const result = await service.describeTable(TABLE_ID, USER_ID, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.table_id).toBe(TABLE_ID);
      expect(result!.name).toBe('Deals');
      expect(mockBuildTableDescriptor).toHaveBeenCalledWith(TABLE_ID, TENANT_ID, mockDb);
    }, 10_000);

    it('returns null for inaccessible table (filtered out by permissions)', async () => {
      const rawTable = createTableDescriptor({ table_id: TABLE_ID_INACCESSIBLE });
      mockBuildTableDescriptor.mockResolvedValue(rawTable);

      // Permission filter removes all tables (no access)
      mockFilterDescriptorByPermissions.mockResolvedValue({
        workspace_id: '',
        bases: [],
        link_graph: [],
      });

      const result = await service.describeTable(
        TABLE_ID_INACCESSIBLE,
        USER_ID,
        TENANT_ID,
      );

      expect(result).toBeNull();
    }, 10_000);

    it('returns null when table does not exist for tenant', async () => {
      mockBuildTableDescriptor.mockRejectedValue(
        new Error('Table not-exist not found for tenant tenant-001'),
      );

      const result = await service.describeTable('not-exist', USER_ID, TENANT_ID);

      expect(result).toBeNull();
    }, 10_000);
  });

  // -----------------------------------------------------------------------
  // describeLinks
  // -----------------------------------------------------------------------

  describe('describeLinks()', () => {
    it('returns filtered link graph from workspace descriptor', async () => {
      const linkGraph: LinkEdge[] = [
        {
          from: 'base-001.tbl-001.fld-link-1',
          to: 'base-001.tbl-002.fld-link-2',
          cardinality: 'many_to_one',
          label: 'Deals → Contacts via Primary Contact',
        },
      ];
      const descriptor = createWorkspaceDescriptor({ link_graph: linkGraph });
      mockGetWorkspaceDescriptor.mockResolvedValue(descriptor);

      const result = await service.describeLinks(WORKSPACE_ID, USER_ID, TENANT_ID);

      expect(result).toEqual(linkGraph);
      expect(result).toHaveLength(1);
      expect(result[0]!.from).toBe('base-001.tbl-001.fld-link-1');
    }, 10_000);

    it('returns empty array when no links exist', async () => {
      const descriptor = createWorkspaceDescriptor({ link_graph: [] });
      mockGetWorkspaceDescriptor.mockResolvedValue(descriptor);

      const result = await service.describeLinks(WORKSPACE_ID, USER_ID, TENANT_ID);

      expect(result).toEqual([]);
    }, 10_000);
  });

  // -----------------------------------------------------------------------
  // Tenant isolation
  // -----------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('passes tenantId through to cache for workspace descriptor', async () => {
      const descriptor = createWorkspaceDescriptor();
      mockGetWorkspaceDescriptor.mockResolvedValue(descriptor);

      await service.describeWorkspace(WORKSPACE_ID, USER_ID, TENANT_ID);

      expect(mockGetWorkspaceDescriptor).toHaveBeenCalledWith(
        WORKSPACE_ID,
        USER_ID,
        TENANT_ID,
        mockDb,
      );
    }, 10_000);

    it('passes tenantId through to buildTableDescriptor', async () => {
      const rawTable = createTableDescriptor();
      mockBuildTableDescriptor.mockResolvedValue(rawTable);
      mockFilterDescriptorByPermissions.mockResolvedValue({
        workspace_id: '',
        bases: [{ base_id: 'x', name: '', platform: '', tables: [rawTable] }],
        link_graph: [],
      });

      await service.describeTable(TABLE_ID, USER_ID, TENANT_ID);

      expect(mockBuildTableDescriptor).toHaveBeenCalledWith(TABLE_ID, TENANT_ID, mockDb);
    }, 10_000);

    it('passes tenantId through to filterDescriptorByPermissions', async () => {
      const rawTable = createTableDescriptor();
      mockBuildTableDescriptor.mockResolvedValue(rawTable);
      mockFilterDescriptorByPermissions.mockResolvedValue({
        workspace_id: '',
        bases: [],
        link_graph: [],
      });

      await service.describeTable(TABLE_ID, USER_ID, TENANT_ID);

      expect(mockFilterDescriptorByPermissions).toHaveBeenCalledWith(
        expect.objectContaining({ bases: expect.any(Array) }),
        USER_ID,
        TENANT_ID,
        mockDb,
      );
    }, 10_000);

    it('different tenants receive independent results', async () => {
      const descriptor1 = createWorkspaceDescriptor();
      const descriptor2 = createWorkspaceDescriptor({
        workspace_id: 'ws-other',
        bases: [],
        link_graph: [],
      });

      mockGetWorkspaceDescriptor
        .mockResolvedValueOnce(descriptor1)
        .mockResolvedValueOnce(descriptor2);

      const result1 = await service.describeWorkspace(WORKSPACE_ID, USER_ID, TENANT_ID);
      const result2 = await service.describeWorkspace(
        WORKSPACE_ID,
        USER_ID,
        TENANT_ID_OTHER,
      );

      expect(result1.bases).toHaveLength(1);
      expect(result2.bases).toHaveLength(0);

      // Verify different tenant IDs were passed
      expect(mockGetWorkspaceDescriptor).toHaveBeenCalledWith(
        WORKSPACE_ID,
        USER_ID,
        TENANT_ID,
        mockDb,
      );
      expect(mockGetWorkspaceDescriptor).toHaveBeenCalledWith(
        WORKSPACE_ID,
        USER_ID,
        TENANT_ID_OTHER,
        mockDb,
      );
    }, 10_000);
  });
});
