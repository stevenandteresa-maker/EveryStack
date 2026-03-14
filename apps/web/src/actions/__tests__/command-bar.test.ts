import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDescribeWorkspace = vi.fn();
const mockExecute = vi.fn();
const mockResolveEffectiveRole = vi.fn();
const mockGetCommandRegistry = vi.fn();

// Mock the entire @everystack/shared/ai module
vi.mock('@everystack/shared/ai', () => {
  // Use a proper class-like constructor function
  function MockSDS() {
    return { describeWorkspace: mockDescribeWorkspace };
  }
  function MockCache() {
    return {};
  }
  return {
    SchemaDescriptorService: MockSDS,
    SchemaDescriptorCache: MockCache,
    condenseDescriptor: (desc: unknown) => desc,
    estimateTokens: () => 500,
    AIService: {
      getInstance: () => ({
        execute: mockExecute,
      }),
    },
  };
});

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => ({})),
}));

vi.mock('@everystack/shared/auth', () => ({
  resolveEffectiveRole: (...args: unknown[]) => mockResolveEffectiveRole(...args),
  roleAtLeast: vi.fn((role: string, required: string) => {
    const hierarchy = ['viewer', 'team_member', 'manager', 'admin', 'owner'];
    return hierarchy.indexOf(role) >= hierarchy.indexOf(required);
  }),
}));

vi.mock('@/data/command-registry', () => ({
  getCommandRegistry: (...args: unknown[]) => mockGetCommandRegistry(...args),
}));

vi.mock('@everystack/shared/logging', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getTraceId: vi.fn(() => 'test-trace-id'),
}));

// Import AFTER mocks
import { aiSearchQuery, executeSlashCommand } from '../command-bar';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TENANT_ID = 'a1b2c3d4-e5f6-4a90-ab12-ef1234567890';
const WORKSPACE_ID = 'b2c3d4e5-f6a7-4b01-9cde-f12345678901';
const USER_ID = 'c3d4e5f6-a7b8-4c12-8def-123456789012';

const MOCK_WORKSPACE_DESCRIPTOR = {
  workspace_id: WORKSPACE_ID,
  bases: [
    {
      base_id: 'base-1',
      name: 'CRM',
      platform: 'airtable',
      tables: [
        {
          table_id: 'table-1',
          name: 'Contacts',
          record_count_approx: 100,
          fields: [
            { field_id: 'f1', name: 'Name', type: 'text', searchable: true, aggregatable: false },
          ],
        },
      ],
    },
  ],
  link_graph: [],
};

// ---------------------------------------------------------------------------
// Tests — aiSearchQuery
// ---------------------------------------------------------------------------

describe('aiSearchQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDescribeWorkspace.mockResolvedValue(MOCK_WORKSPACE_DESCRIPTOR);
  });

  it('uses SDS to get permission-filtered workspace descriptor', async () => {
    mockExecute.mockResolvedValue({
      success: true,
      content: 'You have 1 table: Contacts',
      creditsCharged: 1,
      creditsRemaining: 99,
    });

    const result = await aiSearchQuery(TENANT_ID, WORKSPACE_ID, USER_ID, 'what tables do I have?');

    expect(mockDescribeWorkspace).toHaveBeenCalledWith(WORKSPACE_ID, USER_ID, TENANT_ID);
    expect(result.success).toBe(true);
    expect(result.type).toBe('read');
    expect(result.content).toBe('You have 1 table: Contacts');
  });

  it('calls AIService with command_bar feature (fast tier)', async () => {
    mockExecute.mockResolvedValue({
      success: true,
      content: 'Result',
      creditsCharged: 1,
      creditsRemaining: 99,
    });

    await aiSearchQuery(TENANT_ID, WORKSPACE_ID, USER_ID, 'show me contacts');

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'command_bar',
        prompt: 'show me contacts',
        tenantId: TENANT_ID,
        userId: USER_ID,
        context: expect.objectContaining({
          tableSchemas: expect.any(Array),
        }),
      }),
    );
  });

  it('classifies action intents correctly', async () => {
    mockExecute.mockResolvedValue({
      success: true,
      content: 'Creating a new record',
      creditsCharged: 1,
      creditsRemaining: 99,
    });

    const result = await aiSearchQuery(TENANT_ID, WORKSPACE_ID, USER_ID, 'create a new contact');

    expect(result.type).toBe('action');
    expect(result.actionSuggestion).toBeDefined();
  });

  it('returns error result when AI service fails', async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: 'Budget exhausted',
      creditsCharged: 0,
      creditsRemaining: 0,
    });

    const result = await aiSearchQuery(TENANT_ID, WORKSPACE_ID, USER_ID, 'what tables?');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Budget exhausted');
  });

  it('handles unexpected errors gracefully', async () => {
    mockExecute.mockRejectedValue(new Error('Connection failed'));

    const result = await aiSearchQuery(TENANT_ID, WORKSPACE_ID, USER_ID, 'test query');

    expect(result.success).toBe(false);
    expect(result.content).toBe('AI is unavailable');
  });

  it('validates input and rejects invalid tenant ID', async () => {
    const result = await aiSearchQuery('not-a-uuid', WORKSPACE_ID, USER_ID, 'test');

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — executeSlashCommand
// ---------------------------------------------------------------------------

describe('executeSlashCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveEffectiveRole.mockResolvedValue('admin');
  });

  it('validates permissions before executing', async () => {
    mockResolveEffectiveRole.mockResolvedValue(null);

    const result = await executeSlashCommand(TENANT_ID, USER_ID, 'settings');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied');
  });

  it('returns navigation target for navigation commands', async () => {
    mockGetCommandRegistry.mockResolvedValue([
      {
        id: 'sys-goto',
        command_key: 'goto',
        label: 'Go To',
        description: 'Navigate',
        category: 'Navigation',
        source: 'system',
        context_scopes: ['global'],
        permission_required: 'viewer',
        sort_order: 100,
      },
    ]);

    const result = await executeSlashCommand(TENANT_ID, USER_ID, 'goto');

    expect(result.success).toBe(true);
    expect(result.navigationTarget).toBe('/workspace');
  });

  it('returns error when command not found', async () => {
    mockGetCommandRegistry.mockResolvedValue([]);

    const result = await executeSlashCommand(TENANT_ID, USER_ID, 'nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('routes settings command correctly', async () => {
    mockGetCommandRegistry.mockResolvedValue([
      {
        id: 'sys-settings',
        command_key: 'settings',
        label: 'Settings',
        description: 'Open settings',
        category: 'Settings',
        source: 'system',
        context_scopes: ['global'],
        permission_required: 'admin',
        sort_order: 700,
      },
    ]);

    const result = await executeSlashCommand(TENANT_ID, USER_ID, 'settings');

    expect(result.success).toBe(true);
    expect(result.navigationTarget).toBe('/settings');
  });

  it('returns success message for non-navigation commands', async () => {
    mockGetCommandRegistry.mockResolvedValue([
      {
        id: 'sys-timer',
        command_key: 'timer',
        label: 'Timer',
        description: 'Start a timer',
        category: 'Utility',
        source: 'system',
        context_scopes: ['global'],
        permission_required: 'viewer',
        sort_order: 800,
      },
    ]);

    const result = await executeSlashCommand(TENANT_ID, USER_ID, 'timer');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Timer');
  });

  it('validates input and rejects invalid tenant ID', async () => {
    const result = await executeSlashCommand('not-a-uuid', USER_ID, 'goto');

    expect(result.success).toBe(false);
  });
});
