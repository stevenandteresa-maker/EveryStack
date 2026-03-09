import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { parseSkillDocument, parseSkillDirectory } from '../parser';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const VALID_SKILL_MD = `---
id: test-skill
version: 1
skillTier: platform
domain:
  - conversation
  - summarize
description: "A test skill document for parser testing."
tokenEstimates:
  full: 1000
  standard: 500
  minimal: 200
---

# Test Skill

> A placeholder skill for testing.

## Full

This is the full content of the test skill with detailed information.

## Standard

This is the standard content with moderate detail.

## Minimal

Brief test skill content.
`;

const INTEGRATION_SKILL_MD = `---
id: hubspot-integration
version: 2
skillTier: integration
domain:
  - smart_fill
description: "HubSpot CRM integration skill."
tokenEstimates:
  full: 800
  standard: 400
  minimal: 150
mcpServerUrl: https://mcp.example.com/hubspot
lastVerified: "2026-03-01T00:00:00Z"
externalApiVersion: v3
suppressMcpSchema: true
---

# HubSpot Integration Skill

## Full

Full HubSpot integration details.

## Standard

Standard HubSpot content.

## Minimal

Brief HubSpot content.
`;

const MISSING_FRONTMATTER_MD = `# No Frontmatter Skill

## Full

Some content.
`;

const MISSING_SKILL_TIER_MD = `---
id: broken-skill
version: 1
domain:
  - conversation
description: "Missing skillTier field."
tokenEstimates:
  full: 500
  standard: 250
  minimal: 100
---

# Broken Skill
`;

const MISSING_SECTIONS_MD = `---
id: partial-skill
version: 1
skillTier: platform
domain:
  - conversation
description: "A skill with missing content sections."
tokenEstimates:
  full: 500
  standard: 250
  minimal: 100
---

# Partial Skill

## Full

Only full content here.
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseSkillDocument', () => {
  it('parses a well-formed skill markdown into a valid SkillDocument', () => {
    const doc = parseSkillDocument(VALID_SKILL_MD);

    expect(doc.id).toBe('test-skill');
    expect(doc.version).toBe(1);
    expect(doc.skillTier).toBe('platform');
    expect(doc.domain).toEqual(['conversation', 'summarize']);
    expect(doc.description).toBe('A test skill document for parser testing.');
    expect(doc.tokenEstimates).toEqual({ full: 1000, standard: 500, minimal: 200 });
    expect(doc.content.full).toContain('full content of the test skill');
    expect(doc.content.standard).toContain('standard content');
    expect(doc.content.minimal).toContain('Brief test skill content');
  });

  it('parses a skill with optional integration fields', () => {
    const doc = parseSkillDocument(INTEGRATION_SKILL_MD);

    expect(doc.id).toBe('hubspot-integration');
    expect(doc.skillTier).toBe('integration');
    expect(doc.mcpServerUrl).toBe('https://mcp.example.com/hubspot');
    expect(doc.lastVerified).toBe('2026-03-01T00:00:00Z');
    expect(doc.externalApiVersion).toBe('v3');
    expect(doc.suppressMcpSchema).toBe(true);
  });

  it('throws for a skill with missing frontmatter', () => {
    expect(() => parseSkillDocument(MISSING_FRONTMATTER_MD)).toThrow(
      'Skill document missing YAML frontmatter',
    );
  });

  it('throws for a skill with invalid metadata (missing skillTier)', () => {
    expect(() => parseSkillDocument(MISSING_SKILL_TIER_MD)).toThrow();
  });

  it('uses empty strings for missing content sections', () => {
    const doc = parseSkillDocument(MISSING_SECTIONS_MD);

    expect(doc.content.full).toContain('Only full content here');
    expect(doc.content.standard).toBe('');
    expect(doc.content.minimal).toBe('');
  });
});

describe('parseSkillDirectory', () => {
  it('reads skill documents from subdirectories', () => {
    const docsDir = join(__dirname, '..', 'documents');
    const docs = parseSkillDirectory(docsDir);

    // Should find all 7 platform placeholder skills
    expect(docs.length).toBeGreaterThanOrEqual(7);

    const ids = docs.map((d) => d.id);
    expect(ids).toContain('automation-builder');
    expect(ids).toContain('portal-builder');
    expect(ids).toContain('document-templates');
    expect(ids).toContain('report-charts');
    expect(ids).toContain('record-management');
    expect(ids).toContain('communication');
    expect(ids).toContain('command-bar');

    // All should be platform tier
    for (const doc of docs) {
      expect(doc.skillTier).toBe('platform');
    }
  });
});
