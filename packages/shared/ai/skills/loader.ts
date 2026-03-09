/**
 * Skill Loader — selects skills and allocates token budget.
 *
 * Given a task type (or explicit skill IDs) and a token budget, the loader
 * selects the best condensation level for each skill and greedily fills
 * the budget. Used by the Context Builder in Phase 5.
 *
 * @module packages/shared/ai/skills/loader
 */

import type { SkillRegistry } from './registry';
import type { LoadedSkill, SkillCondensationLevel, SkillMetadata } from './types';

// ---------------------------------------------------------------------------
// Request / Result shapes
// ---------------------------------------------------------------------------

export interface SkillLoadRequest {
  taskType: string;                         // AITaskType or platform agent domain string
  skillIds?: string[];                      // Explicit skill IDs (from SkillAwareIntent or PromptTemplate.requiredSkills)
  totalTokenBudget: number;                 // Total tokens available for skills (NOT the full context budget)
  preferredLevel?: SkillCondensationLevel;  // Override auto-selection
  complexityEstimate?: 'simple' | 'moderate' | 'complex';  // From intent classifier — drives condensation level
}

export interface SkillLoadResult {
  skills: LoadedSkill[];
  totalTokensUsed: number;
  totalTokensBudget: number;
}

// ---------------------------------------------------------------------------
// Condensation level helpers
// ---------------------------------------------------------------------------

const CONDENSATION_ORDER: SkillCondensationLevel[] = ['full', 'standard', 'minimal'];

const COMPLEXITY_TO_LEVEL: Record<string, SkillCondensationLevel> = {
  complex: 'full',
  moderate: 'standard',
  simple: 'minimal',
};

function resolveLevel(request: SkillLoadRequest): SkillCondensationLevel {
  if (request.preferredLevel) return request.preferredLevel;
  if (request.complexityEstimate) return COMPLEXITY_TO_LEVEL[request.complexityEstimate] ?? 'standard';
  return 'standard';
}

// ---------------------------------------------------------------------------
// SkillLoader
// ---------------------------------------------------------------------------

export class SkillLoader {
  constructor(private registry: SkillRegistry) {}

  /** Load skills for a given request, fitting within the token budget. */
  load(request: SkillLoadRequest): SkillLoadResult {
    const result: SkillLoadResult = {
      skills: [],
      totalTokensUsed: 0,
      totalTokensBudget: request.totalTokenBudget,
    };

    // Resolve which skills to consider
    const candidateMetadata = this.resolveCandidates(request);
    const targetLevel = resolveLevel(request);

    for (const meta of candidateMetadata) {
      const doc = this.registry.get(meta.id);
      if (!doc) continue;

      const remaining = request.totalTokenBudget - result.totalTokensUsed;
      const loaded = this.tryLoad(doc, targetLevel, remaining);
      if (loaded) {
        result.skills.push(loaded);
        result.totalTokensUsed += loaded.tokenEstimate;
      }
    }

    return result;
  }

  /**
   * Resolve candidate skills: explicit IDs first, then task type lookup.
   * Sort by domain relevance — skills whose domain includes the exact taskType first.
   */
  private resolveCandidates(request: SkillLoadRequest): SkillMetadata[] {
    let candidates: SkillMetadata[];

    if (request.skillIds && request.skillIds.length > 0) {
      candidates = request.skillIds
        .map((id) => {
          const doc = this.registry.get(id);
          if (!doc) return null;
          // Strip content to get metadata
          const { content: _content, ...metadata } = doc;
          return metadata;
        })
        .filter((m): m is SkillMetadata => m !== null);
    } else {
      candidates = this.registry.findByTaskType(request.taskType);
    }

    // Sort: exact domain match first
    return candidates.sort((a, b) => {
      const aMatch = a.domain.includes(request.taskType) ? 0 : 1;
      const bMatch = b.domain.includes(request.taskType) ? 0 : 1;
      return aMatch - bMatch;
    });
  }

  /**
   * Try to load a skill at the target level, falling back to more condensed levels.
   * Returns null if the skill doesn't fit even at 'minimal'.
   */
  private tryLoad(
    doc: { id: string; skillTier: string; tokenEstimates: Record<SkillCondensationLevel, number>; content: Record<SkillCondensationLevel, string> },
    targetLevel: SkillCondensationLevel,
    remainingBudget: number,
  ): LoadedSkill | null {
    const startIdx = CONDENSATION_ORDER.indexOf(targetLevel);

    for (let i = startIdx; i < CONDENSATION_ORDER.length; i++) {
      const level = CONDENSATION_ORDER[i] as SkillCondensationLevel;
      const estimate = doc.tokenEstimates[level];

      if (estimate <= remainingBudget) {
        return {
          id: doc.id,
          tier: doc.skillTier,
          level,
          content: doc.content[level],
          tokenEstimate: estimate,
        };
      }
    }

    return null;
  }
}
