/**
 * Tool Definition Registry for AI tool use.
 *
 * Registers EveryStack capabilities as tools that AI models can invoke.
 * Provider-specific compilation translates ToolDefinition to native formats.
 *
 * Feature code registers tools here; AIService + provider adapters consume them.
 */

import type {
  ToolDefinition,
  ToolResult,
  AgentScope,
  ProviderId,
} from '../types';

// ---------------------------------------------------------------------------
// ToolRegistry
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  /**
   * Register a tool definition. Throws if a tool with the same name
   * is already registered.
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(
        `Tool "${tool.name}" is already registered. Tool names must be unique.`,
      );
    }
    this.tools.set(tool.name, tool);
  }

  /** Retrieve a tool by name, or undefined if not found. */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** List all registered tools. */
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools filtered by an agent scope.
   *
   * MVP behavior: when scope is undefined, returns all registered tools.
   * Post-MVP: when scope is provided, returns only tools whose names
   * appear in `scope.allowedTools`.
   */
  getForScope(scope?: AgentScope): ToolDefinition[] {
    if (!scope) {
      return this.listTools();
    }

    return this.listTools().filter((tool) =>
      scope.allowedTools.has(tool.name),
    );
  }

  /**
   * Compile an array of ToolDefinitions into provider-native tool format.
   *
   * - anthropic: Anthropic tools array with `input_schema`
   * - self-hosted: Basic JSON description format (placeholder)
   */
  compileForProvider(
    tools: ToolDefinition[],
    providerId: ProviderId,
  ): unknown[] {
    switch (providerId) {
      case 'anthropic':
        return tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        }));

      case 'self-hosted':
        return tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        }));

      case 'openai':
        return tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }));

      default:
        return tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        }));
    }
  }
}

// ---------------------------------------------------------------------------
// Stub tool helpers
// ---------------------------------------------------------------------------

function createStubHandler(toolName: string): (params: unknown) => Promise<ToolResult> {
  return async (_params: unknown): Promise<ToolResult> => {
    throw new Error(`Tool "${toolName}" handler is not implemented`);
  };
}

// ---------------------------------------------------------------------------
// 8 MVP tool stubs
// ---------------------------------------------------------------------------

const TOOL_STUBS: ToolDefinition[] = [
  {
    name: 'search_records',
    description:
      'Search records across tables using natural language queries. Returns matching records with relevance scores.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        table_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of table IDs to search within',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
        },
      },
      required: ['query'],
    },
    handler: createStubHandler('search_records'),
    requiredPermissions: ['records:read'],
  },
  {
    name: 'query_tables',
    description:
      'Query table data with structured filters, sorting, and pagination.',
    parameters: {
      type: 'object',
      properties: {
        table_id: { type: 'string', description: 'ID of the table to query' },
        filters: {
          type: 'object',
          description: 'Filter conditions as field_id:value pairs',
        },
        sort_by: { type: 'string', description: 'Field ID to sort by' },
        sort_direction: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction',
        },
        limit: { type: 'number', description: 'Maximum results', default: 50 },
        offset: { type: 'number', description: 'Pagination offset', default: 0 },
      },
      required: ['table_id'],
    },
    handler: createStubHandler('query_tables'),
    requiredPermissions: ['records:read'],
  },
  {
    name: 'resolve_cross_links',
    description:
      'Resolve cross-link relationships between records across tables, workspaces, and platforms.',
    parameters: {
      type: 'object',
      properties: {
        record_id: {
          type: 'string',
          description: 'ID of the source record',
        },
        link_field_id: {
          type: 'string',
          description: 'ID of the cross-link field to resolve',
        },
        include_linked_data: {
          type: 'boolean',
          description: 'Whether to include full data of linked records',
          default: false,
        },
      },
      required: ['record_id'],
    },
    handler: createStubHandler('resolve_cross_links'),
    requiredPermissions: ['records:read', 'cross_links:read'],
  },
  {
    name: 'trigger_commands',
    description:
      'Trigger a predefined command or action in the workspace context.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Command identifier to trigger',
        },
        context: {
          type: 'object',
          description: 'Context data for the command execution',
        },
      },
      required: ['command'],
    },
    handler: createStubHandler('trigger_commands'),
    requiredPermissions: ['commands:execute'],
  },
  {
    name: 'create_record',
    description:
      'Create a new record in a specified table with field values.',
    parameters: {
      type: 'object',
      properties: {
        table_id: { type: 'string', description: 'ID of the target table' },
        field_values: {
          type: 'object',
          description: 'Field values as field_id:value pairs',
        },
      },
      required: ['table_id', 'field_values'],
    },
    handler: createStubHandler('create_record'),
    requiredPermissions: ['records:write'],
  },
  {
    name: 'generate_document',
    description:
      'Generate a document from a template with record data merged in.',
    parameters: {
      type: 'object',
      properties: {
        template_id: {
          type: 'string',
          description: 'ID of the document template',
        },
        record_id: {
          type: 'string',
          description: 'ID of the record to merge into the template',
        },
        output_format: {
          type: 'string',
          enum: ['pdf', 'html'],
          description: 'Output format',
          default: 'pdf',
        },
      },
      required: ['template_id', 'record_id'],
    },
    handler: createStubHandler('generate_document'),
    requiredPermissions: ['documents:write'],
  },
  {
    name: 'get_field_definitions',
    description:
      'Get field definitions for a table, including types, options, and configuration.',
    parameters: {
      type: 'object',
      properties: {
        table_id: { type: 'string', description: 'ID of the table' },
        include_hidden: {
          type: 'boolean',
          description: 'Include hidden fields',
          default: false,
        },
      },
      required: ['table_id'],
    },
    handler: createStubHandler('get_field_definitions'),
    requiredPermissions: ['fields:read'],
  },
  {
    name: 'list_tables',
    description:
      'List all tables accessible in the current workspace context.',
    parameters: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'Optional workspace ID to filter by',
        },
        include_synced: {
          type: 'boolean',
          description: 'Include synced tables',
          default: true,
        },
        include_native: {
          type: 'boolean',
          description: 'Include native tables',
          default: true,
        },
      },
      required: [],
    },
    handler: createStubHandler('list_tables'),
    requiredPermissions: ['tables:read'],
  },
];

// ---------------------------------------------------------------------------
// Default registry with all stubs pre-registered
// ---------------------------------------------------------------------------

/**
 * Create a new ToolRegistry pre-populated with the 8 MVP tool stubs.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const stub of TOOL_STUBS) {
    registry.register(stub);
  }
  return registry;
}

/** The 8 MVP tool stub names for reference */
export const TOOL_NAMES = TOOL_STUBS.map((t) => t.name);
