/**
 * Feature Skill Registry — stores and queries skill documents.
 *
 * Pure in-memory registry with Zod validation on registration.
 * Phase 5 will wire this into AIService as a process-level singleton.
 *
 * @module packages/shared/ai/skills/registry
 */

import type { SkillDocument, SkillMetadata } from './types';
import { skillMetadataSchema } from './types';

export class SkillRegistry {
  private skills: Map<string, SkillDocument> = new Map();

  /** Register a skill document. Validates against skillMetadataSchema, throws if invalid. */
  register(skill: SkillDocument): void {
    // Validate metadata fields via Zod
    skillMetadataSchema.parse(skill);
    this.skills.set(skill.id, skill);
  }

  /** Get a skill by ID. */
  get(skillId: string): SkillDocument | undefined {
    return this.skills.get(skillId);
  }

  /** Get all registered skill metadata (lightweight — strips content). */
  listMetadata(): SkillMetadata[] {
    return Array.from(this.skills.values()).map((skill) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content: _content, ...metadata } = skill;
      return metadata;
    });
  }

  /** Find skills whose `domain` array includes the given task type. */
  findByTaskType(taskType: string): SkillMetadata[] {
    return this.listMetadata().filter((skill) =>
      skill.domain.includes(taskType),
    );
  }

  /** Find skills whose `skillTier` matches the given tier. */
  findByTier(tier: string): SkillMetadata[] {
    return this.listMetadata().filter((skill) => skill.skillTier === tier);
  }

  /** Check if a skill exists. */
  has(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /** Get count of registered skills. */
  get size(): number {
    return this.skills.size;
  }
}

/** Factory — returns a new SkillRegistry instance. Phase 5 wires this as a singleton. */
export function createSkillRegistry(): SkillRegistry {
  return new SkillRegistry();
}
