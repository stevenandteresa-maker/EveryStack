'use server';

/**
 * Server Actions — Command Bar AI Search & Slash Command Execution
 *
 * aiSearchQuery(): Permission-filtered AI natural language search using SDS context.
 * executeSlashCommand(): Validates permissions and routes slash commands.
 *
 * @see docs/reference/command-bar.md § Unified Command Prompt
 * @see docs/reference/schema-descriptor-service.md § API Surface
 */

import { z } from 'zod';
import { getDbForTenant } from '@everystack/shared/db';
import { resolveEffectiveRole, roleAtLeast } from '@everystack/shared/auth';
import type { EffectiveRole } from '@everystack/shared/auth';
import {
  SchemaDescriptorService,
  SchemaDescriptorCache,
  condenseDescriptor,
  AIService,
} from '@everystack/shared/ai';
import { createLogger, getTraceId } from '@everystack/shared/logging';
import { getCommandRegistry } from '@/data/command-registry';
import type { AISearchResult, CommandResult } from '@/lib/command-bar/types';

const logger = createLogger({ service: 'command-bar-actions' });

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const aiSearchInputSchema = z.object({
  tenantId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  query: z.string().min(1).max(500),
});

const executeCommandInputSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  commandKey: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// AI intent classification — simple heuristic for response type
// ---------------------------------------------------------------------------

const ACTION_INTENTS = new Set([
  'create', 'update', 'delete', 'modify', 'add', 'remove', 'set', 'change',
]);

function classifyIntent(query: string): 'read' | 'action' {
  const lowerQuery = query.toLowerCase();
  for (const intent of ACTION_INTENTS) {
    if (lowerQuery.startsWith(intent) || lowerQuery.includes(` ${intent} `)) {
      return 'action';
    }
  }
  return 'read';
}

// ---------------------------------------------------------------------------
// aiSearchQuery
// ---------------------------------------------------------------------------

/**
 * Execute an AI-powered natural language search within the Command Bar.
 *
 * 1. Gets permission-filtered workspace schema via SDS
 * 2. Condenses descriptor to fit within AI token budget (2000 tokens)
 * 3. Calls AIService with `command_bar` feature (fast tier)
 * 4. Classifies intent and returns structured result
 */
export async function aiSearchQuery(
  tenantId: string,
  workspaceId: string,
  userId: string,
  query: string,
): Promise<AISearchResult> {
  const traceId = getTraceId();

  try {
    const input = aiSearchInputSchema.parse({ tenantId, workspaceId, userId, query });

    // Step 1 — Get permission-filtered workspace schema
    const db = getDbForTenant(input.tenantId);
    const cache = new SchemaDescriptorCache();
    const sds = new SchemaDescriptorService(cache, db);
    const descriptor = await sds.describeWorkspace(
      input.workspaceId,
      input.userId,
      input.tenantId,
    );

    // Step 2 — Condense for AI context budget
    const condensed = condenseDescriptor(descriptor, 2000);

    // Step 3 — Call AIService with fast tier
    const aiService = AIService.getInstance();
    const response = await aiService.execute({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'command_bar',
      prompt: input.query,
      context: {
        tableSchemas: [condensed],
      },
      // taskType omitted — inferred from feature → classify_intent → fast tier
    });

    if (!response.success) {
      return {
        success: false,
        type: 'read',
        content: response.error ?? 'AI is unavailable',
        creditsCharged: response.creditsCharged,
        creditsRemaining: response.creditsRemaining,
        error: response.error,
      };
    }

    // Step 4 — Classify intent and structure result
    const content = response.content ?? '';
    const intentType = classifyIntent(input.query);

    const result: AISearchResult = {
      success: true,
      type: intentType,
      content,
      intent: intentType,
      creditsCharged: response.creditsCharged,
      creditsRemaining: response.creditsRemaining,
    };

    // For action intents, wrap as an action suggestion requiring confirmation
    if (intentType === 'action') {
      result.actionSuggestion = {
        label: content.slice(0, 80),
        description: content,
      };
    }

    return result;
  } catch (error) {
    logger.error(
      { traceId, tenantId, error: error instanceof Error ? error.message : 'Unknown error' },
      'AI search query failed',
    );

    return {
      success: false,
      type: 'read',
      content: 'AI is unavailable',
      creditsCharged: 0,
      creditsRemaining: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ---------------------------------------------------------------------------
// executeSlashCommand
// ---------------------------------------------------------------------------

/** Navigation route map for commands that redirect */
const NAVIGATION_COMMANDS: Record<string, (params?: Record<string, unknown>) => string> = {
  goto: () => '/workspace',
  office: () => '/office',
  settings: () => '/settings',
  automations: () => '/automations',
  templates: () => '/templates',
  saved: () => '/saved',
};

/**
 * Execute a slash command from the Command Bar.
 *
 * 1. Looks up the command from the registry
 * 2. Validates user permission against command's permission_required
 * 3. Routes to the correct handler based on command_key
 * 4. Returns CommandResult with success/failure and navigation target
 */
export async function executeSlashCommand(
  tenantId: string,
  userId: string,
  commandKey: string,
  params?: Record<string, unknown>,
): Promise<CommandResult> {
  const traceId = getTraceId();

  try {
    const input = executeCommandInputSchema.parse({ tenantId, userId, commandKey, params });

    // Step 1 — Resolve role
    const role = await resolveEffectiveRole(input.userId, input.tenantId);
    if (!role) {
      return {
        success: false,
        error: 'Permission denied',
      };
    }

    // Step 2 — Look up command from registry (get all commands, find the one)
    const allCommands = await getCommandRegistry(input.tenantId, input.userId, {
      scope: 'global',
    });
    const command = allCommands.find((cmd) => cmd.command_key === input.commandKey);

    if (!command) {
      return {
        success: false,
        error: 'Command not found or insufficient permissions',
      };
    }

    // Step 3 — Validate permission (already filtered by getCommandRegistry, but double-check)
    if (!roleAtLeast(role, command.permission_required as EffectiveRole)) {
      return {
        success: false,
        error: 'Permission denied',
      };
    }

    // Step 4 — Route to handler
    const navHandler = NAVIGATION_COMMANDS[input.commandKey];
    if (navHandler) {
      return {
        success: true,
        navigationTarget: navHandler(input.params),
      };
    }

    // Non-navigation commands return a success acknowledgment
    // Actual entity creation (records, todos, events) handled by dedicated actions
    return {
      success: true,
      message: `Command "${command.label}" executed`,
    };
  } catch (error) {
    logger.error(
      { traceId, tenantId, commandKey, error: error instanceof Error ? error.message : 'Unknown error' },
      'Slash command execution failed',
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Command execution failed',
    };
  }
}
