import { describe, expect, it } from 'vitest';

import type { SkillDocument } from '../types';
import { createSkillRegistry } from '../registry';
import { SkillLoader } from '../loader';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestSkill(overrides: Partial<SkillDocument> = {}): SkillDocument {
  return {
    id: 'test-skill',
    version: 1,
    domain: ['conversation'],
    skillTier: 'platform',
    description: 'A test skill',
    tokenEstimates: { full: 1000, standard: 500, minimal: 200 },
    content: {
      full: 'Full content',
      standard: 'Standard content',
      minimal: 'Minimal content',
    },
    ...overrides,
  };
}

function createLoaderWithSkills(skills: SkillDocument[]) {
  const registry = createSkillRegistry();
  for (const skill of skills) {
    registry.register(skill);
  }
  return new SkillLoader(registry);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillLoader', () => {
  it('loads a single skill within budget at the preferred level', () => {
    const loader = createLoaderWithSkills([createTestSkill()]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 2000,
      preferredLevel: 'full',
    });

    expect(result.skills).toHaveLength(1);
    const skill = result.skills[0]!;
    expect(skill.id).toBe('test-skill');
    expect(skill.level).toBe('full');
    expect(skill.tokenEstimate).toBe(1000);
    expect(result.totalTokensUsed).toBe(1000);
    expect(result.totalTokensBudget).toBe(2000);
  });

  it('falls back from full to standard when budget is tight', () => {
    const loader = createLoaderWithSkills([createTestSkill()]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 800,
      preferredLevel: 'full',
    });

    expect(result.skills).toHaveLength(1);
    const skill = result.skills[0]!;
    expect(skill.level).toBe('standard');
    expect(skill.tokenEstimate).toBe(500);
  });

  it('falls back to minimal when standard does not fit', () => {
    const loader = createLoaderWithSkills([createTestSkill()]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 300,
      preferredLevel: 'full',
    });

    expect(result.skills).toHaveLength(1);
    const skill = result.skills[0]!;
    expect(skill.level).toBe('minimal');
    expect(skill.tokenEstimate).toBe(200);
  });

  it('loads multiple skills greedily within budget', () => {
    const loader = createLoaderWithSkills([
      createTestSkill({ id: 'skill-a', tokenEstimates: { full: 400, standard: 200, minimal: 100 } }),
      createTestSkill({ id: 'skill-b', tokenEstimates: { full: 400, standard: 200, minimal: 100 } }),
      createTestSkill({ id: 'skill-c', tokenEstimates: { full: 400, standard: 200, minimal: 100 } }),
    ]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 500,
      preferredLevel: 'standard',
    });

    // 2 skills fit at standard (200 each = 400), 3rd falls back to minimal (100) = 500 total
    expect(result.skills).toHaveLength(3);
    expect(result.totalTokensUsed).toBe(500);
  });

  it('returns empty result when budget is zero', () => {
    const loader = createLoaderWithSkills([createTestSkill()]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 0,
    });

    expect(result.skills).toHaveLength(0);
    expect(result.totalTokensUsed).toBe(0);
  });

  it('uses explicit skillIds and ignores task type matching', () => {
    const loader = createLoaderWithSkills([
      createTestSkill({ id: 'skill-a', domain: ['conversation'] }),
      createTestSkill({ id: 'skill-b', domain: ['smart_fill'] }),
    ]);

    const result = loader.load({
      taskType: 'conversation',
      skillIds: ['skill-b'],
      totalTokenBudget: 2000,
    });

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]!.id).toBe('skill-b');
  });

  it('selects full level when complexityEstimate is complex', () => {
    const loader = createLoaderWithSkills([createTestSkill()]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 2000,
      complexityEstimate: 'complex',
    });

    expect(result.skills[0]!.level).toBe('full');
  });

  it('selects minimal level when complexityEstimate is simple', () => {
    const loader = createLoaderWithSkills([createTestSkill()]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 2000,
      complexityEstimate: 'simple',
    });

    expect(result.skills[0]!.level).toBe('minimal');
  });

  it('preferredLevel overrides complexityEstimate', () => {
    const loader = createLoaderWithSkills([createTestSkill()]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 2000,
      preferredLevel: 'standard',
      complexityEstimate: 'complex',
    });

    expect(result.skills[0]!.level).toBe('standard');
  });

  it('loaded skills include tier from source document', () => {
    const loader = createLoaderWithSkills([
      createTestSkill({ id: 'platform-skill', skillTier: 'platform' }),
      createTestSkill({
        id: 'integration-skill',
        skillTier: 'integration',
        mcpServerUrl: 'https://mcp.example.com/test',
      }),
    ]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 5000,
    });

    expect(result.skills).toHaveLength(2);
    const platformSkill = result.skills.find((s) => s.id === 'platform-skill');
    const integrationSkill = result.skills.find((s) => s.id === 'integration-skill');
    expect(platformSkill?.tier).toBe('platform');
    expect(integrationSkill?.tier).toBe('integration');
  });

  it('skips skills that do not fit even at minimal', () => {
    const loader = createLoaderWithSkills([
      createTestSkill({ id: 'big-skill', tokenEstimates: { full: 5000, standard: 3000, minimal: 1000 } }),
    ]);

    const result = loader.load({
      taskType: 'conversation',
      totalTokenBudget: 500,
    });

    expect(result.skills).toHaveLength(0);
  });
});
