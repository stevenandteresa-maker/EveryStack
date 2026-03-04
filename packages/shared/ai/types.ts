/**
 * Core AI type system for EveryStack.
 *
 * Feature code references capability tiers, never providers or models.
 * These types are the contract between AI features and the AIService abstraction.
 */

// ---------------------------------------------------------------------------
// Capability Tiers — feature code uses these, never provider/model names
// ---------------------------------------------------------------------------

/** Capability tier that feature code requests from AIService */
export type CapabilityTier = 'fast' | 'standard' | 'advanced';

/** Provider identifier — 'self-hosted' is a post-MVP extension point */
export type ProviderId = 'anthropic' | 'openai' | 'self-hosted';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** A single message in a conversation with the AI */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Fully compiled request ready to send to a provider adapter */
export interface CompiledAIRequest {
  /** System-level instruction prepended to the conversation */
  systemInstruction: string;
  /** Ordered conversation messages */
  messages: AIMessage[];
  /** Provider-resolved model configuration */
  modelConfig: {
    modelId: string;
    providerId: ProviderId;
  };
  /** Optional Zod-compatible JSON schema for structured output */
  outputSchema?: Record<string, unknown>;
  /** Maximum tokens to generate */
  maxTokens: number;
  /** Sampling temperature (0–1) */
  temperature: number;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Token usage breakdown for a single AI call */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
}

/** Cost calculation result */
export interface CreditCost {
  /** Raw USD cost of the API call */
  cost_usd: number;
  /** Credits deducted from the workspace budget */
  credits_charged: number;
}

/** Standard (non-streaming) AI response */
export interface AIResponse {
  content: string;
  usage: TokenUsage;
  finishReason: 'stop' | 'max_tokens' | 'tool_use' | 'error';
  providerRequestId: string;
}

/** A single chunk in a streaming AI response */
export interface AIStreamChunk {
  /** Incremental content delta */
  delta: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Token usage — present only on the final chunk */
  usage?: TokenUsage;
}

// ---------------------------------------------------------------------------
// Tool Use
// ---------------------------------------------------------------------------

/** JSON Schema type used for tool parameter definitions */
export type JSONSchema = Record<string, unknown>;

/** Result returned by a tool handler */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Definition of a tool that an AI model can invoke */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: (params: unknown) => Promise<ToolResult>;
  requiredPermissions: string[];
}

/** A single tool call made by the AI model */
export interface AIToolCall {
  name: string;
  params: Record<string, unknown>;
  result: ToolResult;
}

/** AI response that includes tool calls */
export interface AIToolResponse {
  content: string;
  toolCalls: AIToolCall[];
  usage: TokenUsage;
}

// ---------------------------------------------------------------------------
// Post-MVP Extension Points — shapes only, no runtime logic
// ---------------------------------------------------------------------------

/**
 * Defines the permission boundary for an AI agent session.
 * Post-MVP: AI Agents are post-MVP per glossary. Shape ships now to avoid
 * migrations and type changes later.
 */
export interface AgentScope {
  /** Set of tool names the agent is allowed to invoke */
  readonly allowedTools: ReadonlySet<string>;
  /** Permission constraints that intersect with the user's own permissions */
  readonly permissionConstraints: {
    /** Maximum role level the agent can act as */
    readonly maxRoleLevel: number;
    /** Workspace IDs the agent is scoped to (empty = all user workspaces) */
    readonly workspaceIds: readonly string[];
    /** Whether the agent can perform write operations */
    readonly canWrite: boolean;
  };
}

/**
 * Configuration for a post-MVP AI agent session.
 * Shape only — no runtime logic.
 */
export interface AgentConfig {
  /** Maximum credits the agent can consume in a single session */
  budgetCredits: number;
  /** Maximum reasoning steps before the agent must stop */
  maxSteps: number;
  /** Permission and tool boundary */
  scope: AgentScope;
  /** Session timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Interface for post-MVP vector embedding providers.
 * Shape only — no runtime logic.
 */
export interface EmbeddingProvider {
  /** Generate an embedding for a single text input */
  embed(text: string): Promise<number[]>;
  /** Generate embeddings for multiple text inputs (batch) */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** The dimensionality of the embedding vectors */
  readonly dimensions: number;
}
