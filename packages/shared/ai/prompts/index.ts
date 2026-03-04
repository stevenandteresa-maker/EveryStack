/**
 * Prompt Registry — public exports.
 *
 * @module packages/shared/ai/prompts
 */

// Registry types and class
export type {
  VariableDefinition,
  PromptExample,
  TestedModel,
  PromptTemplate,
} from './registry';
export { PromptRegistry } from './registry';

// Compiler types and implementations
export type { CompilerModelConfig, PromptCompiler } from './compiler';
export {
  AnthropicPromptCompiler,
  BasicPromptCompiler,
  compilerForProvider,
} from './compiler';
