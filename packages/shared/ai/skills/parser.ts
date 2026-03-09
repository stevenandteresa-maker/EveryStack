/**
 * Skill Document Parser — reads markdown skill files with YAML frontmatter.
 *
 * Parses skill markdown files into SkillDocument objects. Used by the
 * skill loading pipeline to read skill definitions from disk.
 *
 * @module packages/shared/ai/skills/parser
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import type { SkillCondensationLevel, SkillDocument } from './types';
import { skillMetadataSchema } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTION_HEADINGS: SkillCondensationLevel[] = ['full', 'standard', 'minimal'];

// ---------------------------------------------------------------------------
// Single document parser
// ---------------------------------------------------------------------------

/** Parse a skill markdown file (YAML frontmatter + markdown sections) into a SkillDocument. */
export function parseSkillDocument(rawMarkdown: string): SkillDocument {
  // Extract YAML frontmatter between --- delimiters
  const frontmatterMatch = rawMarkdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('Skill document missing YAML frontmatter');
  }

  const frontmatter = parseYaml(frontmatterMatch[1] as string);
  const metadata = skillMetadataSchema.parse(frontmatter);

  // Extract content sections
  const content = extractSections(rawMarkdown);

  return {
    ...metadata,
    content,
  };
}

// ---------------------------------------------------------------------------
// Directory parser
// ---------------------------------------------------------------------------

/**
 * Parse all skill documents from a directory and its immediate subdirectories.
 * Recurses one level into subdirectories (platform/, integrations/, platform-maintenance/).
 * Returns parsed documents, logging warnings for files that fail validation.
 */
export function parseSkillDirectory(dirPath: string): SkillDocument[] {
  const documents: SkillDocument[] = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recurse one level into subdirectories
      const subEntries = readdirSync(fullPath, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith('.md')) {
          tryParseFile(join(fullPath, subEntry.name), documents);
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Read .md files directly in dirPath (backward compatibility)
      tryParseFile(fullPath, documents);
    }
  }

  return documents;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParseFile(filePath: string, documents: SkillDocument[]): void {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const doc = parseSkillDocument(raw);
    documents.push(doc);
  } catch (err) {
    // Log warning but don't throw — allow other files to parse
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(`[SkillParser] Failed to parse ${filePath}: ${message}`);
  }
}

function extractSections(rawMarkdown: string): Record<SkillCondensationLevel, string> {
  const content: Record<SkillCondensationLevel, string> = {
    full: '',
    standard: '',
    minimal: '',
  };

  for (const level of SECTION_HEADINGS) {
    const heading = `## ${level.charAt(0).toUpperCase() + level.slice(1)}`;
    const regex = new RegExp(
      `${escapeRegExp(heading)}\\n([\\s\\S]*?)(?=\\n## |$)`,
    );
    const sectionMatch = rawMarkdown.match(regex);
    if (sectionMatch?.[1]) {
      content[level] = sectionMatch[1].trim();
    }
  }

  return content;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
