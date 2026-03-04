/**
 * Provider-specific prompt compilers.
 *
 * Each compiler transforms a provider-agnostic PromptTemplate + variables
 * into a CompiledAIRequest tailored for a specific provider's API.
 *
 * @module packages/shared/ai/prompts/compiler
 */

import type { CompiledAIRequest, ProviderId } from '../types';
import type { PromptTemplate } from './registry';

// ---------------------------------------------------------------------------
// Compiler Interface
// ---------------------------------------------------------------------------

/** Model configuration passed to the compiler */
export interface CompilerModelConfig {
  modelId: string;
  providerId: ProviderId;
}

/**
 * Transforms a provider-agnostic prompt template into a provider-specific
 * CompiledAIRequest.
 */
export interface PromptCompiler {
  /** The provider this compiler targets */
  readonly providerId: ProviderId;

  /**
   * Compile a template with variables into a CompiledAIRequest.
   *
   * @param template - The prompt template to compile
   * @param variables - Variable values to substitute
   * @param modelConfig - Resolved model configuration
   * @returns CompiledAIRequest ready for the provider adapter
   */
  compile(
    template: PromptTemplate,
    variables: Record<string, unknown>,
    modelConfig: CompilerModelConfig,
  ): CompiledAIRequest;
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

/**
 * Substitute {{variable}} placeholders in a template string.
 * Unknown variables are left as-is (no silent removal).
 */
function substituteVariables(
  text: string,
  variables: Record<string, unknown>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    if (name in variables) {
      const value = variables[name];
      return typeof value === 'string' ? value : JSON.stringify(value);
    }
    return match;
  });
}

/**
 * Build a user message from the template's examples as few-shot context.
 * Returns empty string if no examples exist.
 */
function buildExamplesSection(template: PromptTemplate): string {
  if (template.examples.length === 0) return '';

  const exampleParts = template.examples.map(
    (ex, i) =>
      `Example ${i + 1}:\nInput: ${ex.input}\nExpected Output: ${ex.expectedOutput}`,
  );
  return exampleParts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Anthropic Prompt Compiler
// ---------------------------------------------------------------------------

/** Default max tokens for Anthropic models */
const ANTHROPIC_DEFAULT_MAX_TOKENS = 4096;

/** Default temperature for Anthropic models */
const ANTHROPIC_DEFAULT_TEMPERATURE = 0.3;

/**
 * Anthropic-specific prompt compiler.
 *
 * - Injects cache_control metadata on system instructions
 * - Wraps structured sections in XML tags for better Claude parsing
 * - Formats examples using XML structure
 */
export class AnthropicPromptCompiler implements PromptCompiler {
  readonly providerId: ProviderId = 'anthropic';

  compile(
    template: PromptTemplate,
    variables: Record<string, unknown>,
    modelConfig: CompilerModelConfig,
  ): CompiledAIRequest {
    const compiledSystemInstruction = substituteVariables(
      template.systemInstruction,
      variables,
    );

    // Build system instruction with XML structure and cache_control marker
    const systemParts: string[] = [];

    // Main instruction wrapped in XML tags
    systemParts.push(
      '<instructions>',
      compiledSystemInstruction,
      '</instructions>',
    );

    // Output schema section if provided
    if (
      template.outputSchema &&
      Object.keys(template.outputSchema).length > 0
    ) {
      systemParts.push(
        '<output_schema>',
        JSON.stringify(template.outputSchema, null, 2),
        '</output_schema>',
      );
    }

    // Examples section if provided
    const examplesText = buildExamplesSection(template);
    if (examplesText) {
      systemParts.push('<examples>', examplesText, '</examples>');
    }

    // Append cache_control marker for Anthropic prompt caching
    systemParts.push('<!-- cache_control: { "type": "ephemeral" } -->');

    const systemInstruction = systemParts.join('\n');

    return {
      systemInstruction,
      messages: [],
      modelConfig: {
        modelId: modelConfig.modelId,
        providerId: modelConfig.providerId,
      },
      outputSchema: template.outputSchema,
      maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
      temperature: ANTHROPIC_DEFAULT_TEMPERATURE,
    };
  }
}

// ---------------------------------------------------------------------------
// Basic Prompt Compiler (Self-Hosted / Default)
// ---------------------------------------------------------------------------

/** Default max tokens for basic compiler */
const BASIC_DEFAULT_MAX_TOKENS = 2048;

/** Default temperature for basic compiler */
const BASIC_DEFAULT_TEMPERATURE = 0.3;

/**
 * Basic prompt compiler for self-hosted and other providers.
 *
 * Simple variable substitution without provider-specific optimizations.
 */
export class BasicPromptCompiler implements PromptCompiler {
  readonly providerId: ProviderId;

  constructor(providerId: ProviderId) {
    this.providerId = providerId;
  }

  compile(
    template: PromptTemplate,
    variables: Record<string, unknown>,
    modelConfig: CompilerModelConfig,
  ): CompiledAIRequest {
    const compiledSystemInstruction = substituteVariables(
      template.systemInstruction,
      variables,
    );

    const parts: string[] = [compiledSystemInstruction];

    // Append output schema as plain text
    if (
      template.outputSchema &&
      Object.keys(template.outputSchema).length > 0
    ) {
      parts.push(
        '\nExpected output schema:',
        JSON.stringify(template.outputSchema, null, 2),
      );
    }

    // Append examples as plain text
    const examplesText = buildExamplesSection(template);
    if (examplesText) {
      parts.push('\nExamples:', examplesText);
    }

    return {
      systemInstruction: parts.join('\n'),
      messages: [],
      modelConfig: {
        modelId: modelConfig.modelId,
        providerId: modelConfig.providerId,
      },
      outputSchema: template.outputSchema,
      maxTokens: BASIC_DEFAULT_MAX_TOKENS,
      temperature: BASIC_DEFAULT_TEMPERATURE,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Cached compiler instances */
const compilerCache = new Map<ProviderId, PromptCompiler>();

/**
 * Get the prompt compiler for a given provider.
 *
 * Returns the Anthropic compiler for 'anthropic', and a basic compiler
 * for 'self-hosted' and other providers.
 *
 * @param providerId - The provider to get a compiler for
 * @returns The appropriate PromptCompiler implementation
 */
export function compilerForProvider(providerId: ProviderId): PromptCompiler {
  const cached = compilerCache.get(providerId);
  if (cached) return cached;

  let compiler: PromptCompiler;

  switch (providerId) {
    case 'anthropic':
      compiler = new AnthropicPromptCompiler();
      break;
    default:
      compiler = new BasicPromptCompiler(providerId);
      break;
  }

  compilerCache.set(providerId, compiler);
  return compiler;
}
