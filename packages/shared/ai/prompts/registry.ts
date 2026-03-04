/**
 * Prompt Registry — stores, versions, and compiles provider-agnostic prompt templates.
 *
 * Templates are registered with monotonically increasing versions. The registry
 * prevents registering a lower version than what already exists for a given ID.
 * Templates are immutable once registered.
 *
 * @module packages/shared/ai/prompts/registry
 */

import type { CapabilityTier, ProviderId, JSONSchema } from '../types';
import type { ProviderModelConfig } from '../config/routing';
import { resolveRouteByTier } from '../config/routing';
import type { PromptCompiler } from './compiler';
import { compilerForProvider } from './compiler';

// ---------------------------------------------------------------------------
// Supporting Types
// ---------------------------------------------------------------------------

/** Definition of a variable placeholder within a prompt template */
export interface VariableDefinition {
  /** Variable name as it appears in the template: {{name}} */
  name: string;
  /** Expected type of the variable value */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Whether this variable must be provided at compile time */
  required: boolean;
  /** Human-readable description of the variable's purpose */
  description: string;
}

/** A few-shot example pair for prompt templates */
export interface PromptExample {
  /** Example input to the prompt */
  input: string;
  /** Expected output for the given input */
  expectedOutput: string;
}

/** A provider/model combination that has been tested with this template */
export interface TestedModel {
  /** Provider that was tested */
  providerId: ProviderId;
  /** Specific model ID that was tested */
  modelId: string;
  /** Pass rate from evaluation (0–1) */
  passRate: number;
}

// ---------------------------------------------------------------------------
// PromptTemplate Interface
// ---------------------------------------------------------------------------

/** A versioned, provider-agnostic prompt template */
export interface PromptTemplate {
  /** Unique template identifier (e.g. 'automation_builder', 'document_draft') */
  id: string;
  /** Monotonically increasing version number */
  version: number;
  /** Human-readable description of the template's purpose */
  description: string;
  /** The capability tier this template is designed for */
  capabilityTier: CapabilityTier;
  /** System instruction with {{variable}} placeholders */
  systemInstruction: string;
  /** Expected output schema (Zod -> JSON Schema) */
  outputSchema: JSONSchema;
  /** Variable definitions for template placeholders */
  variables: VariableDefinition[];
  /** Few-shot example pairs */
  examples: PromptExample[];
  /** Provider/model combos validated against this template */
  testedWith: TestedModel[];
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Human-readable changelog for this version */
  changelog: string;
}

// ---------------------------------------------------------------------------
// PromptRegistry
// ---------------------------------------------------------------------------

/**
 * In-memory registry for versioned prompt templates.
 *
 * Enforces monotonically increasing version numbers per template ID.
 * Templates are immutable once registered.
 */
export class PromptRegistry {
  /** Map of template ID -> Map of version -> PromptTemplate */
  private readonly templates = new Map<string, Map<number, PromptTemplate>>();
  /** Map of template ID -> highest registered version */
  private readonly latestVersions = new Map<string, number>();

  /**
   * Register a new prompt template version.
   *
   * @throws Error if version <= current latest version for this template ID
   */
  register(template: PromptTemplate): void {
    const currentLatest = this.latestVersions.get(template.id);

    if (currentLatest !== undefined && template.version <= currentLatest) {
      throw new Error(
        `Cannot register template '${template.id}' v${template.version}: ` +
          `current latest is v${currentLatest}. Versions must be monotonically increasing.`,
      );
    }

    let versionMap = this.templates.get(template.id);
    if (!versionMap) {
      versionMap = new Map();
      this.templates.set(template.id, versionMap);
    }

    // Store a frozen copy to enforce immutability
    versionMap.set(template.version, Object.freeze({ ...template }));
    this.latestVersions.set(template.id, template.version);
  }

  /**
   * Get a template by ID and optional version.
   * Returns undefined if the template or version doesn't exist.
   */
  get(id: string, version?: number): PromptTemplate | undefined {
    const versionMap = this.templates.get(id);
    if (!versionMap) return undefined;

    if (version !== undefined) {
      return versionMap.get(version);
    }

    return this.getLatest(id);
  }

  /**
   * Get the latest version of a template by ID.
   * Returns undefined if no template exists with that ID.
   */
  getLatest(id: string): PromptTemplate | undefined {
    const latestVersion = this.latestVersions.get(id);
    if (latestVersion === undefined) return undefined;

    const versionMap = this.templates.get(id);
    return versionMap?.get(latestVersion);
  }

  /**
   * List all registered templates with their latest version numbers.
   */
  listTemplates(): Array<{ id: string; latestVersion: number }> {
    return Array.from(this.latestVersions.entries()).map(
      ([id, latestVersion]) => ({
        id,
        latestVersion,
      }),
    );
  }

  /**
   * Compile a template into a CompiledAIRequest ready for a provider adapter.
   *
   * Resolves the capability tier to a provider/model via routing config,
   * then uses the provider-specific compiler to produce the final request.
   *
   * @param templateId - The template to compile
   * @param variables - Variable values to substitute into the template
   * @param providerId - Optional provider override (defaults to routing resolution)
   * @returns CompiledAIRequest ready for adapter.complete()
   * @throws Error if template not found or required variables are missing
   */
  compile(
    templateId: string,
    variables: Record<string, unknown>,
    providerId?: ProviderId,
  ) {
    const template = this.getLatest(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found in registry.`);
    }

    // Validate required variables
    for (const varDef of template.variables) {
      if (varDef.required && !(varDef.name in variables)) {
        throw new Error(
          `Missing required variable '${varDef.name}' for template '${templateId}'.`,
        );
      }
    }

    // Resolve provider/model from capability tier
    const route: ProviderModelConfig = resolveRouteByTier(
      template.capabilityTier,
    );
    const resolvedProviderId = providerId ?? route.providerId;

    // Get the compiler for this provider
    const compiler: PromptCompiler = compilerForProvider(resolvedProviderId);

    return compiler.compile(template, variables, {
      modelId: route.modelId,
      providerId: resolvedProviderId,
    });
  }
}
