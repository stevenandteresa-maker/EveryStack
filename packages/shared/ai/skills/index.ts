/**
 * Feature Skill Registry — public barrel export.
 *
 * @module packages/shared/ai/skills
 */

// Types
export type {
  AITaskType,
  SkillCondensationLevel,
  SkillMetadata,
  SkillDocument,
  LoadedSkill,
  SkillAwareIntent,
  SkillContextLog,
  WorkspaceUsageDescriptor,
} from './types';
export { skillMetadataSchema } from './types';

// Registry
export { SkillRegistry, createSkillRegistry } from './registry';

// Loader
export type { SkillLoadRequest, SkillLoadResult } from './loader';
export { SkillLoader } from './loader';

// Parser
export { parseSkillDocument, parseSkillDirectory } from './parser';
