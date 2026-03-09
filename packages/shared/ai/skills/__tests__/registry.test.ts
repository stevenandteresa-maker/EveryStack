import { describe, expect, it } from 'vitest';

import type { SkillDocument } from '../types';
import { createSkillRegistry, SkillRegistry } from '../registry';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestSkill(overrides: Partial<SkillDocument> = {}): SkillDocument {
  return {
    id: 'test-skill',
    version: 1,
    domain: ['conversation'],
    skillTier: 'platform',
    description: 'A test skill for unit testing',
    tokenEstimates: { full: 1000, standard: 500, minimal: 200 },
    content: {
      full: 'Full content for test skill',
      standard: 'Standard content for test skill',
      minimal: 'Minimal content for test skill',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillRegistry', () => {
  it('registers a valid platform skill and retrieves it by ID', () => {
    const registry = createSkillRegistry();
    const skill = createTestSkill();

    registry.register(skill);

    expect(registry.get('test-skill')).toEqual(skill);
    expect(registry.has('test-skill')).toBe(true);
    expect(registry.size).toBe(1);
  });

  it('registers a valid skill and finds it by task type', () => {
    const registry = createSkillRegistry();
    const skill = createTestSkill({ domain: ['generate_automation'] });

    registry.register(skill);

    const results = registry.findByTaskType('generate_automation');
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('test-skill');
  });

  it('registers an integration skill with optional fields and retrieves by tier', () => {
    const registry = createSkillRegistry();
    const skill = createTestSkill({
      id: 'hubspot-integration',
      skillTier: 'integration',
      domain: ['smart_fill'],
      mcpServerUrl: 'https://mcp.example.com/hubspot',
      lastVerified: '2026-03-01T00:00:00Z',
      externalApiVersion: 'v3',
      suppressMcpSchema: true,
    });

    registry.register(skill);

    const results = registry.findByTier('integration');
    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result.id).toBe('hubspot-integration');
    expect(result.mcpServerUrl).toBe('https://mcp.example.com/hubspot');
    expect(result.lastVerified).toBe('2026-03-01T00:00:00Z');
    expect(result.suppressMcpSchema).toBe(true);
  });

  it('rejects a skill with invalid metadata', () => {
    const registry = createSkillRegistry();

    // Missing id
    expect(() =>
      registry.register(createTestSkill({ id: '' })),
    ).toThrow();

    // Negative version
    expect(() =>
      registry.register(createTestSkill({ version: -1 })),
    ).toThrow();

    // Empty domain
    expect(() =>
      registry.register(createTestSkill({ domain: [] })),
    ).toThrow();

    // Missing skillTier
    expect(() =>
      registry.register(createTestSkill({ skillTier: '' })),
    ).toThrow();
  });

  it('listMetadata returns metadata without content', () => {
    const registry = createSkillRegistry();
    registry.register(createTestSkill());

    const metadata = registry.listMetadata();
    expect(metadata).toHaveLength(1);
    const entry = metadata[0]!;
    expect(entry.id).toBe('test-skill');
    // Verify content is not present
    expect('content' in entry).toBe(false);
  });

  it('findByTaskType returns only matching skills', () => {
    const registry = createSkillRegistry();
    registry.register(createTestSkill({ id: 'skill-a', domain: ['conversation'] }));
    registry.register(createTestSkill({ id: 'skill-b', domain: ['smart_fill'] }));
    registry.register(createTestSkill({ id: 'skill-c', domain: ['conversation', 'summarize'] }));

    const results = registry.findByTaskType('conversation');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id).sort()).toEqual(['skill-a', 'skill-c']);
  });

  it('findByTier returns only matching skills', () => {
    const registry = createSkillRegistry();
    registry.register(createTestSkill({ id: 'platform-a', skillTier: 'platform' }));
    registry.register(
      createTestSkill({
        id: 'integration-a',
        skillTier: 'integration',
        mcpServerUrl: 'https://mcp.example.com/test',
      }),
    );
    registry.register(createTestSkill({ id: 'platform-b', skillTier: 'platform' }));

    const platforms = registry.findByTier('platform');
    expect(platforms).toHaveLength(2);

    const integrations = registry.findByTier('integration');
    expect(integrations).toHaveLength(1);
    expect(integrations[0]!.id).toBe('integration-a');
  });

  it('findByTier returns empty when no integration skills registered', () => {
    const registry = createSkillRegistry();
    registry.register(createTestSkill({ skillTier: 'platform' }));

    const results = registry.findByTier('integration');
    expect(results).toHaveLength(0);
  });

  it('get returns undefined for non-existent skill', () => {
    const registry = createSkillRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('createSkillRegistry returns a new SkillRegistry instance', () => {
    const registry = createSkillRegistry();
    expect(registry).toBeInstanceOf(SkillRegistry);
    expect(registry.size).toBe(0);
  });
});
