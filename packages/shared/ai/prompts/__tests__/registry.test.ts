import { describe, it, expect, beforeEach } from 'vitest';
import { PromptRegistry } from '../registry';
import type { PromptTemplate } from '../registry';
import {
  AnthropicPromptCompiler,
  BasicPromptCompiler,
  compilerForProvider,
} from '../compiler';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createTestTemplate(
  overrides: Partial<PromptTemplate> = {},
): PromptTemplate {
  return {
    id: 'test_template',
    version: 1,
    description: 'A test template for unit tests.',
    capabilityTier: 'fast',
    systemInstruction:
      'You are a helpful assistant for {{tableName}}. Respond in {{format}} format.',
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string' },
      },
      required: ['result'],
    },
    variables: [
      {
        name: 'tableName',
        type: 'string',
        required: true,
        description: 'The table name.',
      },
      {
        name: 'format',
        type: 'string',
        required: false,
        description: 'Output format preference.',
      },
    ],
    examples: [
      {
        input: 'Summarize this record.',
        expectedOutput: '{"result": "A concise summary."}',
      },
    ],
    testedWith: [
      {
        providerId: 'anthropic',
        modelId: 'claude-haiku-4-5-20251001',
        passRate: 0.95,
      },
    ],
    createdAt: '2026-03-04T00:00:00Z',
    changelog: 'Initial version for testing.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PromptRegistry Tests
// ---------------------------------------------------------------------------

describe('PromptRegistry', () => {
  let registry: PromptRegistry;

  beforeEach(() => {
    registry = new PromptRegistry();
  });

  describe('register()', () => {
    it('registers a template and retrieves it by ID', () => {
      const template = createTestTemplate();
      registry.register(template);

      const result = registry.get('test_template');
      expect(result).toBeDefined();
      expect(result?.id).toBe('test_template');
      expect(result?.version).toBe(1);
    });

    it('registers multiple versions of the same template', () => {
      registry.register(createTestTemplate({ version: 1 }));
      registry.register(
        createTestTemplate({ version: 2, changelog: 'Version 2 update.' }),
      );

      const v1 = registry.get('test_template', 1);
      const v2 = registry.get('test_template', 2);

      expect(v1?.version).toBe(1);
      expect(v2?.version).toBe(2);
      expect(v2?.changelog).toBe('Version 2 update.');
    });

    it('throws when registering a lower version than current', () => {
      registry.register(createTestTemplate({ version: 3 }));

      expect(() => {
        registry.register(createTestTemplate({ version: 2 }));
      }).toThrow(
        "Cannot register template 'test_template' v2: current latest is v3. Versions must be monotonically increasing.",
      );
    });

    it('throws when registering the same version number', () => {
      registry.register(createTestTemplate({ version: 1 }));

      expect(() => {
        registry.register(createTestTemplate({ version: 1 }));
      }).toThrow(
        "Cannot register template 'test_template' v1: current latest is v1. Versions must be monotonically increasing.",
      );
    });

    it('freezes registered templates to enforce immutability', () => {
      const template = createTestTemplate();
      registry.register(template);

      const result = registry.get('test_template');
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('get()', () => {
    it('returns a specific version when provided', () => {
      registry.register(createTestTemplate({ version: 1 }));
      registry.register(
        createTestTemplate({ version: 2, changelog: 'Updated.' }),
      );

      const v1 = registry.get('test_template', 1);
      expect(v1?.version).toBe(1);

      const v2 = registry.get('test_template', 2);
      expect(v2?.version).toBe(2);
    });

    it('returns latest version when no version specified', () => {
      registry.register(createTestTemplate({ version: 1 }));
      registry.register(
        createTestTemplate({ version: 5, changelog: 'Latest.' }),
      );

      const result = registry.get('test_template');
      expect(result?.version).toBe(5);
    });

    it('returns undefined for unknown template ID', () => {
      const result = registry.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('returns undefined for unknown version of existing template', () => {
      registry.register(createTestTemplate({ version: 1 }));

      const result = registry.get('test_template', 99);
      expect(result).toBeUndefined();
    });
  });

  describe('getLatest()', () => {
    it('returns the highest version', () => {
      registry.register(createTestTemplate({ version: 1 }));
      registry.register(createTestTemplate({ version: 3 }));
      registry.register(createTestTemplate({ version: 7 }));

      const result = registry.getLatest('test_template');
      expect(result?.version).toBe(7);
    });

    it('returns undefined for unknown template ID', () => {
      const result = registry.getLatest('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('listTemplates()', () => {
    it('returns empty array when no templates registered', () => {
      expect(registry.listTemplates()).toEqual([]);
    });

    it('lists all templates with latest versions', () => {
      registry.register(createTestTemplate({ id: 'alpha', version: 1 }));
      registry.register(createTestTemplate({ id: 'alpha', version: 3 }));
      registry.register(createTestTemplate({ id: 'beta', version: 2 }));

      const list = registry.listTemplates();
      expect(list).toHaveLength(2);
      expect(list).toContainEqual({ id: 'alpha', latestVersion: 3 });
      expect(list).toContainEqual({ id: 'beta', latestVersion: 2 });
    });
  });

  describe('compile()', () => {
    it('compiles a template with variable substitution', () => {
      registry.register(createTestTemplate());

      const result = registry.compile('test_template', {
        tableName: 'Contacts',
        format: 'JSON',
      });

      expect(result.systemInstruction).toContain('Contacts');
      expect(result.systemInstruction).toContain('JSON');
      expect(result.modelConfig.providerId).toBe('anthropic');
      expect(result.modelConfig.modelId).toBe('claude-haiku-4-5-20251001');
    });

    it('throws for unknown template ID', () => {
      expect(() => {
        registry.compile('nonexistent', {});
      }).toThrow("Template 'nonexistent' not found in registry.");
    });

    it('throws for missing required variables', () => {
      registry.register(createTestTemplate());

      expect(() => {
        registry.compile('test_template', { format: 'JSON' });
      }).toThrow(
        "Missing required variable 'tableName' for template 'test_template'.",
      );
    });

    it('allows missing optional variables', () => {
      registry.register(createTestTemplate());

      // 'format' is optional — should not throw
      const result = registry.compile('test_template', {
        tableName: 'Contacts',
      });

      expect(result.systemInstruction).toContain('Contacts');
      // The {{format}} placeholder is left as-is since no value provided
      expect(result.systemInstruction).toContain('{{format}}');
    });

    it('uses Anthropic compiler by default for fast tier', () => {
      registry.register(createTestTemplate({ capabilityTier: 'fast' }));

      const result = registry.compile('test_template', {
        tableName: 'Test',
      });

      // Anthropic compiler adds XML tags and cache_control
      expect(result.systemInstruction).toContain('<instructions>');
      expect(result.systemInstruction).toContain('</instructions>');
      expect(result.systemInstruction).toContain('cache_control');
    });

    it('uses basic compiler when self-hosted provider specified', () => {
      registry.register(createTestTemplate({ capabilityTier: 'fast' }));

      const result = registry.compile(
        'test_template',
        { tableName: 'Test' },
        'self-hosted',
      );

      // Basic compiler does NOT add XML tags or cache_control
      expect(result.systemInstruction).not.toContain('<instructions>');
      expect(result.systemInstruction).not.toContain('cache_control');
      expect(result.systemInstruction).toContain('Test');
    });

    it('includes output schema in compiled request', () => {
      registry.register(createTestTemplate());

      const result = registry.compile('test_template', {
        tableName: 'Test',
      });

      expect(result.outputSchema).toEqual({
        type: 'object',
        properties: { result: { type: 'string' } },
        required: ['result'],
      });
    });

    it('resolves standard tier to correct model', () => {
      registry.register(
        createTestTemplate({ capabilityTier: 'standard' }),
      );

      const result = registry.compile('test_template', {
        tableName: 'Test',
      });

      expect(result.modelConfig.modelId).toBe(
        'claude-sonnet-4-5-20250929',
      );
    });

    it('resolves advanced tier to correct model', () => {
      registry.register(
        createTestTemplate({ capabilityTier: 'advanced' }),
      );

      const result = registry.compile('test_template', {
        tableName: 'Test',
      });

      expect(result.modelConfig.modelId).toBe('claude-opus-4-6');
    });
  });
});

// ---------------------------------------------------------------------------
// Compiler Tests
// ---------------------------------------------------------------------------

describe('AnthropicPromptCompiler', () => {
  const compiler = new AnthropicPromptCompiler();

  it('has correct providerId', () => {
    expect(compiler.providerId).toBe('anthropic');
  });

  it('wraps system instruction in XML tags', () => {
    const template = createTestTemplate();
    const result = compiler.compile(
      template,
      { tableName: 'Projects' },
      { modelId: 'claude-haiku-4-5-20251001', providerId: 'anthropic' },
    );

    expect(result.systemInstruction).toContain('<instructions>');
    expect(result.systemInstruction).toContain('</instructions>');
    expect(result.systemInstruction).toContain('Projects');
  });

  it('injects cache_control marker', () => {
    const template = createTestTemplate();
    const result = compiler.compile(
      template,
      { tableName: 'Test' },
      { modelId: 'claude-haiku-4-5-20251001', providerId: 'anthropic' },
    );

    expect(result.systemInstruction).toContain(
      'cache_control: { "type": "ephemeral" }',
    );
  });

  it('includes output schema in XML tags', () => {
    const template = createTestTemplate();
    const result = compiler.compile(
      template,
      { tableName: 'Test' },
      { modelId: 'claude-haiku-4-5-20251001', providerId: 'anthropic' },
    );

    expect(result.systemInstruction).toContain('<output_schema>');
    expect(result.systemInstruction).toContain('</output_schema>');
  });

  it('includes examples in XML tags', () => {
    const template = createTestTemplate();
    const result = compiler.compile(
      template,
      { tableName: 'Test' },
      { modelId: 'claude-haiku-4-5-20251001', providerId: 'anthropic' },
    );

    expect(result.systemInstruction).toContain('<examples>');
    expect(result.systemInstruction).toContain('</examples>');
    expect(result.systemInstruction).toContain('Summarize this record.');
  });

  it('omits examples section when no examples provided', () => {
    const template = createTestTemplate({ examples: [] });
    const result = compiler.compile(
      template,
      { tableName: 'Test' },
      { modelId: 'claude-haiku-4-5-20251001', providerId: 'anthropic' },
    );

    expect(result.systemInstruction).not.toContain('<examples>');
  });

  it('omits output_schema section when schema is empty', () => {
    const template = createTestTemplate({ outputSchema: {} });
    const result = compiler.compile(
      template,
      { tableName: 'Test' },
      { modelId: 'claude-haiku-4-5-20251001', providerId: 'anthropic' },
    );

    expect(result.systemInstruction).not.toContain('<output_schema>');
  });

  it('substitutes non-string variables as JSON', () => {
    const template = createTestTemplate({
      systemInstruction: 'Process {{count}} items from {{data}}.',
      variables: [
        {
          name: 'count',
          type: 'number',
          required: true,
          description: 'Item count.',
        },
        {
          name: 'data',
          type: 'object',
          required: true,
          description: 'Data object.',
        },
      ],
    });

    const result = compiler.compile(
      template,
      { count: 42, data: { key: 'value' } },
      { modelId: 'claude-haiku-4-5-20251001', providerId: 'anthropic' },
    );

    expect(result.systemInstruction).toContain('42');
    expect(result.systemInstruction).toContain('{"key":"value"}');
  });

  it('sets Anthropic-appropriate defaults', () => {
    const template = createTestTemplate();
    const result = compiler.compile(
      template,
      { tableName: 'Test' },
      { modelId: 'claude-haiku-4-5-20251001', providerId: 'anthropic' },
    );

    expect(result.maxTokens).toBe(4096);
    expect(result.temperature).toBe(0.3);
    expect(result.messages).toEqual([]);
  });
});

describe('BasicPromptCompiler', () => {
  const compiler = new BasicPromptCompiler('self-hosted');

  it('has correct providerId', () => {
    expect(compiler.providerId).toBe('self-hosted');
  });

  it('does simple variable substitution without XML tags', () => {
    const template = createTestTemplate();
    const result = compiler.compile(
      template,
      { tableName: 'Tasks' },
      { modelId: 'local-llama', providerId: 'self-hosted' },
    );

    expect(result.systemInstruction).toContain('Tasks');
    expect(result.systemInstruction).not.toContain('<instructions>');
    expect(result.systemInstruction).not.toContain('cache_control');
  });

  it('appends output schema as plain text', () => {
    const template = createTestTemplate();
    const result = compiler.compile(
      template,
      { tableName: 'Test' },
      { modelId: 'local-llama', providerId: 'self-hosted' },
    );

    expect(result.systemInstruction).toContain('Expected output schema:');
    expect(result.systemInstruction).toContain('"type": "object"');
  });

  it('appends examples as plain text', () => {
    const template = createTestTemplate();
    const result = compiler.compile(
      template,
      { tableName: 'Test' },
      { modelId: 'local-llama', providerId: 'self-hosted' },
    );

    expect(result.systemInstruction).toContain('Examples:');
    expect(result.systemInstruction).toContain('Summarize this record.');
  });

  it('sets basic defaults', () => {
    const template = createTestTemplate();
    const result = compiler.compile(
      template,
      { tableName: 'Test' },
      { modelId: 'local-llama', providerId: 'self-hosted' },
    );

    expect(result.maxTokens).toBe(2048);
    expect(result.temperature).toBe(0.3);
    expect(result.modelConfig.providerId).toBe('self-hosted');
  });
});

describe('compilerForProvider()', () => {
  it('returns AnthropicPromptCompiler for anthropic', () => {
    const compiler = compilerForProvider('anthropic');
    expect(compiler).toBeInstanceOf(AnthropicPromptCompiler);
    expect(compiler.providerId).toBe('anthropic');
  });

  it('returns BasicPromptCompiler for self-hosted', () => {
    const compiler = compilerForProvider('self-hosted');
    expect(compiler).toBeInstanceOf(BasicPromptCompiler);
    expect(compiler.providerId).toBe('self-hosted');
  });

  it('returns BasicPromptCompiler for openai', () => {
    const compiler = compilerForProvider('openai');
    expect(compiler).toBeInstanceOf(BasicPromptCompiler);
    expect(compiler.providerId).toBe('openai');
  });

  it('returns cached instances on repeated calls', () => {
    const first = compilerForProvider('anthropic');
    const second = compilerForProvider('anthropic');
    expect(first).toBe(second);
  });
});
