/**
 * Command Registry — MVP system commands with permission + context filtering.
 *
 * System commands are hardcoded per the Slash Command Catalog in command-bar.md.
 * No DB table is queried for now — tenant-specific custom commands are post-MVP.
 *
 * @see docs/reference/command-bar.md § Slash Command Catalog (MVP)
 */

import { resolveEffectiveRole, roleAtLeast } from '@everystack/shared/auth';
import type { EffectiveRole } from '@everystack/shared/auth';
import type { CommandEntry } from '@/lib/command-bar/types';

// ---------------------------------------------------------------------------
// MVP System Commands — from command-bar.md § Slash Command Catalog
// ---------------------------------------------------------------------------

const SYSTEM_COMMANDS: CommandEntry[] = [
  // Navigation
  {
    id: 'sys-goto',
    command_key: 'goto',
    label: 'Go To',
    description: 'Fuzzy search any base, table, or record',
    category: 'Navigation',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail', 'chat'],
    permission_required: 'viewer',
    sort_order: 100,
  },
  {
    id: 'sys-office',
    command_key: 'office',
    label: 'My Office',
    description: 'Go to My Office',
    category: 'Navigation',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail', 'chat'],
    permission_required: 'viewer',
    sort_order: 110,
  },

  // Record Creation
  {
    id: 'sys-new-record',
    command_key: 'new record',
    label: 'New Record',
    description: 'Create a new record in the current table',
    category: 'Record Creation',
    source: 'system',
    context_scopes: ['table_view'],
    permission_required: 'team_member',
    sort_order: 200,
  },
  {
    id: 'sys-todo',
    command_key: 'todo',
    label: 'To-Do',
    description: 'Create a personal to-do item',
    category: 'Record Creation',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail', 'chat'],
    permission_required: 'viewer',
    sort_order: 210,
  },
  {
    id: 'sys-event',
    command_key: 'event',
    label: 'Event',
    description: 'Create a personal calendar event',
    category: 'Record Creation',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail', 'chat'],
    permission_required: 'viewer',
    sort_order: 220,
  },

  // Data Operations
  {
    id: 'sys-print',
    command_key: 'print',
    label: 'Print / PDF',
    description: 'Print or export the current view as PDF',
    category: 'Data Operations',
    source: 'system',
    context_scopes: ['table_view'],
    permission_required: 'viewer',
    sort_order: 300,
  },

  // Communication
  {
    id: 'sys-dm',
    command_key: 'dm',
    label: 'Direct Message',
    description: 'Send a direct message to a user',
    category: 'Communication',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail', 'chat'],
    permission_required: 'viewer',
    sort_order: 400,
  },
  {
    id: 'sys-thread',
    command_key: 'thread',
    label: 'Start Thread',
    description: 'Start a thread on the current context',
    category: 'Communication',
    source: 'system',
    context_scopes: ['table_view', 'record_detail'],
    permission_required: 'team_member',
    sort_order: 410,
  },
  {
    id: 'sys-status',
    command_key: 'status',
    label: 'Set Status',
    description: 'Set your presence status',
    category: 'Communication',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail', 'chat'],
    permission_required: 'viewer',
    sort_order: 420,
  },
  {
    id: 'sys-mute',
    command_key: 'mute',
    label: 'Mute Thread',
    description: 'Mute the current thread',
    category: 'Communication',
    source: 'system',
    context_scopes: ['chat'],
    permission_required: 'viewer',
    sort_order: 430,
  },

  // Document Generation
  {
    id: 'sys-generate-doc',
    command_key: 'generate doc',
    label: 'Generate Document',
    description: 'Generate a document from a template for the current record',
    category: 'Document Generation',
    source: 'system',
    context_scopes: ['record_detail'],
    permission_required: 'team_member',
    sort_order: 500,
  },
  {
    id: 'sys-templates',
    command_key: 'templates',
    label: 'Browse Templates',
    description: 'Browse available document templates',
    category: 'Document Generation',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail'],
    permission_required: 'team_member',
    sort_order: 510,
  },

  // Automation
  {
    id: 'sys-create-automation',
    command_key: 'create automation',
    label: 'Create Automation',
    description: 'Open the automation creation wizard',
    category: 'Automation',
    source: 'system',
    context_scopes: ['global', 'table_view'],
    permission_required: 'manager',
    sort_order: 600,
  },
  {
    id: 'sys-automations',
    command_key: 'automations',
    label: 'Automations',
    description: 'Go to the automations list',
    category: 'Automation',
    source: 'system',
    context_scopes: ['global', 'table_view'],
    permission_required: 'manager',
    sort_order: 610,
  },

  // Settings
  {
    id: 'sys-settings',
    command_key: 'settings',
    label: 'Settings',
    description: 'Open workspace settings',
    category: 'Settings',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail'],
    permission_required: 'admin',
    sort_order: 700,
  },
  {
    id: 'sys-command-prompt-setup',
    command_key: 'command prompt setup',
    label: 'Customize Commands',
    description: 'Customize your command bar',
    category: 'Settings',
    source: 'system',
    context_scopes: ['global'],
    permission_required: 'manager',
    sort_order: 710,
  },
  {
    id: 'sys-invite',
    command_key: 'invite',
    label: 'Invite',
    description: 'Invite a user to the workspace',
    category: 'Settings',
    source: 'system',
    context_scopes: ['global'],
    permission_required: 'admin',
    sort_order: 720,
  },

  // Utility
  {
    id: 'sys-timer',
    command_key: 'timer',
    label: 'Timer',
    description: 'Start or stop a time tracker',
    category: 'Utility',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail'],
    permission_required: 'viewer',
    sort_order: 800,
  },
  {
    id: 'sys-remind',
    command_key: 'remind',
    label: 'Reminder',
    description: 'Set a personal reminder',
    category: 'Utility',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail', 'chat'],
    permission_required: 'viewer',
    sort_order: 810,
  },
  {
    id: 'sys-saved',
    command_key: 'saved',
    label: 'Saved Messages',
    description: 'View your bookmarked messages',
    category: 'Utility',
    source: 'system',
    context_scopes: ['global'],
    permission_required: 'viewer',
    sort_order: 820,
  },
  {
    id: 'sys-suggest-feature',
    command_key: 'suggest a feature',
    label: 'Suggest a Feature',
    description: 'Submit a feature suggestion',
    category: 'Utility',
    source: 'system',
    context_scopes: ['global'],
    permission_required: 'viewer',
    sort_order: 830,
  },
  {
    id: 'sys-vote-feature',
    command_key: 'vote on feature',
    label: 'Vote on Feature',
    description: 'Vote on feature suggestions',
    category: 'Utility',
    source: 'system',
    context_scopes: ['global'],
    permission_required: 'viewer',
    sort_order: 840,
  },

  // AI Actions
  {
    id: 'sys-summarize',
    command_key: 'summarize',
    label: 'Summarize',
    description: 'Summarize the current or selected records',
    category: 'AI Actions',
    source: 'system',
    context_scopes: ['table_view', 'record_detail'],
    permission_required: 'viewer',
    sort_order: 900,
  },
  {
    id: 'sys-draft',
    command_key: 'draft',
    label: 'Draft',
    description: 'Draft an email or message using AI',
    category: 'AI Actions',
    source: 'system',
    context_scopes: ['record_detail', 'chat'],
    permission_required: 'team_member',
    sort_order: 910,
  },
  {
    id: 'sys-ask',
    command_key: 'ask',
    label: 'Ask AI',
    description: 'Ask a question about your data',
    category: 'AI Actions',
    source: 'system',
    context_scopes: ['global', 'table_view', 'record_detail'],
    permission_required: 'viewer',
    sort_order: 920,
  },
];

/** Expose the constant for testing. */
export { SYSTEM_COMMANDS };

// ---------------------------------------------------------------------------
// getCommandRegistry
// ---------------------------------------------------------------------------

/**
 * Returns system commands filtered by the user's role and the current
 * context scope.
 *
 * 1. Filter by context_scopes — only commands valid for the current scope
 * 2. Filter by permission_required — user must meet minimum role
 * 3. Sort by sort_order ascending
 */
export async function getCommandRegistry(
  tenantId: string,
  userId: string,
  context: { scope: string; tableId?: string },
): Promise<CommandEntry[]> {
  // Resolve user role — uses workspaceId=undefined so tenant-level roles
  // (owner/admin) resolve directly, while members need a workspace context.
  // For system commands, tenant-level check is sufficient.
  const role = await resolveEffectiveRole(userId, tenantId);
  if (!role) return [];

  return filterCommandsByRoleAndScope(SYSTEM_COMMANDS, role, context.scope);
}

/**
 * Pure filter function — separated for testability.
 */
export function filterCommandsByRoleAndScope(
  commands: CommandEntry[],
  role: EffectiveRole,
  scope: string,
): CommandEntry[] {
  return commands
    .filter((cmd) => cmd.context_scopes.includes(scope))
    .filter((cmd) => roleAtLeast(role, cmd.permission_required as EffectiveRole))
    .sort((a, b) => a.sort_order - b.sort_order);
}
