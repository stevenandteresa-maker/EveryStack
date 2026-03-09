/**
 * Feature Skill Registry — Core Types
 *
 * Defines the type system for the three-tier skill model:
 *   - Tier 1 (platform): User-facing feature skills (automation-builder, portal-builder, etc.)
 *   - Tier 1 (integration): MCP/API integration skills (google-analytics, hubspot, stripe)
 *   - Tier 1 (platform-maintenance): Agent operational skills (sync-health-patterns, etc.)
 *
 * These types are consumed by the SkillRegistry, SkillLoader, and (in Phase 5)
 * the Context Builder. They are intentionally flexible to support all three skill
 * tiers without requiring core type modifications when new tiers are added.
 *
 * @module packages/shared/ai/skills/types
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// AI Task Types — mirrors config/routing.ts AITaskType
// ---------------------------------------------------------------------------

/**
 * Task types that trigger skill loading.
 * Matches the existing AITaskType union in packages/shared/ai/config/routing.ts.
 * Note: Skill domains use `string[]` (not `AITaskType[]`) because platform
 * maintenance agents use different domain strings (e.g., 'platform_sync_monitoring').
 * AITaskType remains the authoritative type for user-facing intent classification.
 */
export type AITaskType =
  | 'classify_intent'
  | 'summarize'
  | 'conversation'
  | 'draft_content'
  | 'draft_communication'
  | 'suggest_schema'
  | 'generate_automation'
  | 'generate_app'
  | 'smart_fill'
  | 'search_records';

// ---------------------------------------------------------------------------
// Skill Condensation
// ---------------------------------------------------------------------------

/** Condensation levels — pre-written by skill authors at different token budgets. */
export type SkillCondensationLevel = 'full' | 'standard' | 'minimal';

// ---------------------------------------------------------------------------
// Skill Metadata & Document
// ---------------------------------------------------------------------------

/**
 * Metadata for a skill document (lightweight, used for skill selection).
 * This interface is intentionally flexible to support three future skill tiers:
 *   - 'platform': user-facing feature skills (automation-builder, portal-builder, etc.)
 *   - 'integration': MCP/API integration skills (google-analytics, hubspot, stripe)
 *   - 'platform-maintenance': agent operational skills (sync-health-patterns, etc.)
 * Optional fields (mcpServerUrl, lastVerified, etc.) are populated by integration
 * skills and ignored by platform skills.
 */
export interface SkillMetadata {
  id: string;                              // e.g., 'automation-builder', 'google-analytics'
  version: number;                         // Monotonically increasing
  domain: string[];                        // Task types or agent domain strings that trigger this skill
  skillTier: string;                       // 'platform' | 'integration' | 'platform-maintenance'
  description: string;                     // One-line summary for logging/debugging
  tokenEstimates: Record<SkillCondensationLevel, number>;

  // Integration skill fields (optional — undefined for platform skills)
  mcpServerUrl?: string;                   // Associated MCP server URL
  lastVerified?: string;                   // ISO date — when evals last passed against live integration
  externalApiVersion?: string;             // API version this skill was validated against
  suppressMcpSchema?: boolean;             // Context Builder skips this server's tool schema when skill loaded
}

/**
 * Full skill document with content at all condensation levels.
 * Content is markdown at each condensation level, pre-written by skill authors.
 */
export interface SkillDocument extends SkillMetadata {
  content: Record<SkillCondensationLevel, string>;
}

// ---------------------------------------------------------------------------
// Loaded Skill — output of the SkillLoader
// ---------------------------------------------------------------------------

/**
 * What the Context Builder receives after skill loading (Phase 5 wiring).
 * The `tier` field is preserved from the source SkillDocument so that
 * downstream consumers (usage logging, monitoring) know the skill's origin.
 */
export interface LoadedSkill {
  id: string;
  tier: string;                            // Preserved from SkillDocument.skillTier
  level: SkillCondensationLevel;
  content: string;                         // The markdown at the selected level
  tokenEstimate: number;
}

// ---------------------------------------------------------------------------
// Intent Classification — Phase 5 enhancement
// ---------------------------------------------------------------------------

/**
 * Enhanced intent classification output (Phase 5 — intent classifier update).
 * Produced by the fast-tier intent classifier, consumed by the skill loader.
 */
export interface SkillAwareIntent {
  taskType: AITaskType;
  confidence: number;
  relevantSkills: string[];                // Skill IDs to load
  complexityEstimate: 'simple' | 'moderate' | 'complex';
  involvedIntegrations?: string[];         // Integration IDs — triggers integration skill loading
}

// ---------------------------------------------------------------------------
// Usage Logging — Phase 5 migration
// ---------------------------------------------------------------------------

/**
 * Shape for the `skill_context` JSONB column on `ai_usage_log`.
 * Defined here so the Phase 5 migration and the Skill Performance Dashboard
 * reference the same canonical type. Pure type — no runtime cost.
 */
export interface SkillContextLog {
  skills: Array<{
    id: string;
    tier: string;                          // 'platform' | 'integration' | 'workspace' | 'behavioral'
    level: SkillCondensationLevel;
    tokens: number;
  }>;
  totalSkillTokens: number;
  budgetAllocated: number;
}

// ---------------------------------------------------------------------------
// Workspace Usage Descriptor — late Phase 5 / post-MVP
// ---------------------------------------------------------------------------

/**
 * Contract for Tier 2 workspace context skills (late Phase 5 / post-MVP).
 * The Workspace Usage Descriptor module implements this interface by querying
 * tenant configuration data. Defined here as a stable contract for Phase 5
 * Context Builder integration planning.
 */
export interface WorkspaceUsageDescriptor {
  workspaceId: string;

  connectedIntegrations: Array<{
    platform: string;                      // 'google-analytics', 'hubspot', etc.
    mcpConnected: boolean;
    syncAdapterConnected: boolean;
    targetTables: string[];
    fieldMappings: Array<{
      externalField: string;
      everyStackField: string;
      fieldType: string;
    }>;
    syncSchedule?: string;                 // 'every 15 min', 'hourly', 'manual'
  }>;

  automationSummary: {
    totalCount: number;
    triggerDistribution: Record<string, number>;
    actionDistribution: Record<string, number>;
    commonPatterns: Array<{
      trigger: string;
      actions: string[];
      frequency: number;
    }>;
  };

  portalSummary: {
    totalCount: number;
    commonFieldConfigs: string[];
    authPreference: string;                // 'magic_link' | 'password' | 'mixed'
  };

  documentSummary: {
    totalCount: number;
    commonMergeTags: string[];
  };
}

// ---------------------------------------------------------------------------
// Zod Schemas — runtime validation
// ---------------------------------------------------------------------------

/** Runtime validation of skill document frontmatter. */
export const skillMetadataSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  domain: z.array(z.string()).min(1),
  skillTier: z.string().min(1),
  description: z.string().min(1),
  tokenEstimates: z.object({
    full: z.number().int().positive(),
    standard: z.number().int().positive(),
    minimal: z.number().int().positive(),
  }),
  // Integration skill fields — optional
  mcpServerUrl: z.string().url().optional(),
  lastVerified: z.string().optional(),
  externalApiVersion: z.string().optional(),
  suppressMcpSchema: z.boolean().optional(),
});
