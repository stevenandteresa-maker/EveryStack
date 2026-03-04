import { describe, it, expect } from 'vitest';
import type { ToolDefinition, AgentScope } from '../../types';
import { ToolRegistry, createDefaultToolRegistry, TOOL_NAMES } from '../registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: overrides.name ?? 'test_tool',
    description: overrides.description ?? 'A test tool',
    parameters: overrides.parameters ?? {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    },
    handler: overrides.handler ?? (async () => ({ success: true, data: 'ok' })),
    requiredPermissions: overrides.requiredPermissions ?? ['test:read'],
  };
}

// ---------------------------------------------------------------------------
// ToolRegistry — core operations
// ---------------------------------------------------------------------------

describe('ToolRegistry', () => {
  describe('register + get', () => {
    it('registers a tool and retrieves it by name', () => {
      const registry = new ToolRegistry();
      const tool = createTestTool({ name: 'my_tool' });

      registry.register(tool);

      const retrieved = registry.get('my_tool');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('my_tool');
      expect(retrieved?.description).toBe('A test tool');
      expect(retrieved?.parameters).toEqual(tool.parameters);
      expect(retrieved?.requiredPermissions).toEqual(['test:read']);
    });

    it('returns undefined for an unregistered tool name', () => {
      const registry = new ToolRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('throws on duplicate tool name', () => {
      const registry = new ToolRegistry();
      const tool = createTestTool({ name: 'dup_tool' });

      registry.register(tool);

      expect(() => registry.register(tool)).toThrow(
        'Tool "dup_tool" is already registered',
      );
    });
  });

  describe('listTools', () => {
    it('returns all registered tools', () => {
      const registry = new ToolRegistry();
      registry.register(createTestTool({ name: 'tool_a' }));
      registry.register(createTestTool({ name: 'tool_b' }));
      registry.register(createTestTool({ name: 'tool_c' }));

      const tools = registry.listTools();
      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name)).toEqual(['tool_a', 'tool_b', 'tool_c']);
    });

    it('returns empty array when no tools registered', () => {
      const registry = new ToolRegistry();
      expect(registry.listTools()).toEqual([]);
    });
  });

  describe('getForScope', () => {
    it('returns all tools when scope is undefined (MVP behavior)', () => {
      const registry = new ToolRegistry();
      registry.register(createTestTool({ name: 'tool_x' }));
      registry.register(createTestTool({ name: 'tool_y' }));

      const tools = registry.getForScope(undefined);
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toEqual(['tool_x', 'tool_y']);
    });

    it('filters tools by AgentScope.allowedTools when scope is provided', () => {
      const registry = new ToolRegistry();
      registry.register(createTestTool({ name: 'allowed_tool' }));
      registry.register(createTestTool({ name: 'blocked_tool' }));
      registry.register(createTestTool({ name: 'another_allowed' }));

      const scope: AgentScope = {
        allowedTools: new Set(['allowed_tool', 'another_allowed']),
        permissionConstraints: {
          maxRoleLevel: 30,
          workspaceIds: [],
          canWrite: true,
        },
      };

      const tools = registry.getForScope(scope);
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toEqual([
        'allowed_tool',
        'another_allowed',
      ]);
    });

    it('returns empty array when scope allows no registered tools', () => {
      const registry = new ToolRegistry();
      registry.register(createTestTool({ name: 'some_tool' }));

      const scope: AgentScope = {
        allowedTools: new Set(['nonexistent']),
        permissionConstraints: {
          maxRoleLevel: 10,
          workspaceIds: [],
          canWrite: false,
        },
      };

      expect(registry.getForScope(scope)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // compileForProvider
  // -------------------------------------------------------------------------

  describe('compileForProvider', () => {
    const tool = createTestTool({
      name: 'compile_test',
      description: 'For compilation testing',
      parameters: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q'],
      },
    });

    it('compiles to Anthropic format with input_schema', () => {
      const registry = new ToolRegistry();
      const compiled = registry.compileForProvider([tool], 'anthropic');

      expect(compiled).toHaveLength(1);
      expect(compiled[0]).toEqual({
        name: 'compile_test',
        description: 'For compilation testing',
        input_schema: {
          type: 'object',
          properties: { q: { type: 'string' } },
          required: ['q'],
        },
      });
    });

    it('compiles to self-hosted format with parameters', () => {
      const registry = new ToolRegistry();
      const compiled = registry.compileForProvider([tool], 'self-hosted');

      expect(compiled).toHaveLength(1);
      expect(compiled[0]).toEqual({
        name: 'compile_test',
        description: 'For compilation testing',
        parameters: {
          type: 'object',
          properties: { q: { type: 'string' } },
          required: ['q'],
        },
      });
    });

    it('compiles to OpenAI function format', () => {
      const registry = new ToolRegistry();
      const compiled = registry.compileForProvider([tool], 'openai');

      expect(compiled).toHaveLength(1);
      expect(compiled[0]).toEqual({
        type: 'function',
        function: {
          name: 'compile_test',
          description: 'For compilation testing',
          parameters: {
            type: 'object',
            properties: { q: { type: 'string' } },
            required: ['q'],
          },
        },
      });
    });

    it('compiles multiple tools at once', () => {
      const registry = new ToolRegistry();
      const tools = [
        createTestTool({ name: 'tool_1' }),
        createTestTool({ name: 'tool_2' }),
      ];

      const compiled = registry.compileForProvider(tools, 'anthropic');
      expect(compiled).toHaveLength(2);
      expect((compiled[0] as Record<string, unknown>)['name']).toBe('tool_1');
      expect((compiled[1] as Record<string, unknown>)['name']).toBe('tool_2');
    });

    it('returns empty array for empty tools list', () => {
      const registry = new ToolRegistry();
      expect(registry.compileForProvider([], 'anthropic')).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Default registry with 8 MVP stubs
// ---------------------------------------------------------------------------

describe('createDefaultToolRegistry', () => {
  it('creates a registry with all 8 MVP tool stubs', () => {
    const registry = createDefaultToolRegistry();
    const tools = registry.listTools();

    expect(tools).toHaveLength(8);
  });

  it('registers all expected tool names', () => {
    const registry = createDefaultToolRegistry();
    const expectedNames = [
      'search_records',
      'query_tables',
      'resolve_cross_links',
      'trigger_commands',
      'create_record',
      'generate_document',
      'get_field_definitions',
      'list_tables',
    ];

    for (const name of expectedNames) {
      const tool = registry.get(name);
      expect(tool, `Expected tool "${name}" to be registered`).toBeDefined();
    }
  });

  it('exports TOOL_NAMES matching the 8 stubs', () => {
    expect(TOOL_NAMES).toHaveLength(8);
    expect(TOOL_NAMES).toContain('search_records');
    expect(TOOL_NAMES).toContain('list_tables');
  });

  it('each stub tool has a description and parameter schema', () => {
    const registry = createDefaultToolRegistry();
    const tools = registry.listTools();

    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.parameters).toBeDefined();
      expect((tool.parameters as Record<string, unknown>)['type']).toBe('object');
    }
  });

  it('each stub tool has requiredPermissions', () => {
    const registry = createDefaultToolRegistry();
    const tools = registry.listTools();

    for (const tool of tools) {
      expect(tool.requiredPermissions.length).toBeGreaterThan(0);
    }
  });

  it('stub handlers throw "not implemented"', async () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.get('search_records');

    await expect(tool?.handler({})).rejects.toThrow(
      'Tool "search_records" handler is not implemented',
    );
  });

  it('Anthropic compilation of all stubs produces correct format', () => {
    const registry = createDefaultToolRegistry();
    const tools = registry.listTools();
    const compiled = registry.compileForProvider(tools, 'anthropic');

    expect(compiled).toHaveLength(8);

    for (const entry of compiled) {
      const item = entry as Record<string, unknown>;
      expect(item['name']).toBeDefined();
      expect(item['description']).toBeDefined();
      expect(item['input_schema']).toBeDefined();
      // Should NOT have 'parameters' key in Anthropic format
      expect(item['parameters']).toBeUndefined();
    }
  });
});
