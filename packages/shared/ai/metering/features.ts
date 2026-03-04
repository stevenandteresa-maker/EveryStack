/**
 * AIFeature enum — identifies which product feature triggered an AI call.
 *
 * Used in ai_usage_log.feature column and throughout the metering pipeline.
 * Extensible: new features add values here and routing entries in config/routing.ts.
 */

/**
 * All AI feature identifiers.
 * Agent-prefixed features are used for AI calls within agent sessions
 * (always paired with agent_session_id on ai_usage_log).
 */
export const AI_FEATURES = {
  /** Natural language queries in the Command Bar (MVP) */
  command_bar: 'command_bar',
  /** AI suggests formulas from description (post-MVP — formula engine deferred) */
  formula_suggest: 'formula_suggest',
  /** AI drafts email body from record context (MVP) */
  email_draft: 'email_draft',
  /** "Describe what you want" → AI drafts automation steps (MVP) */
  automation_build: 'automation_build',
  /** Cross-base analytical queries via DuckDB (post-MVP — DuckDB deferred) */
  cross_base_analysis: 'cross_base_analysis',
  /** Multi-step conversational AI guidance (post-MVP) */
  guide_mode: 'guide_mode',
  /** Document AI Draft — AI writing assist in Smart Doc editor (MVP) */
  doc_assist: 'doc_assist',
  /** Record summarization from canonical data (MVP) */
  record_summary: 'record_summary',
  /** AI suggests app layout from schema (post-MVP — App Designer deferred) */
  app_suggest: 'app_suggest',
  /** AI summarizes a Record Thread conversation (MVP) */
  thread_summary: 'thread_summary',
  /** Agent session: high-level planning step (post-MVP — AI Agents deferred) */
  agent_planning: 'agent_planning',
  /** Agent session: tool selection reasoning (post-MVP — AI Agents deferred) */
  agent_tool_selection: 'agent_tool_selection',
  /** Agent session: observation/reflection step (post-MVP — AI Agents deferred) */
  agent_observation: 'agent_observation',
} as const;

/** Union type of all valid AI feature identifiers */
export type AIFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES];
