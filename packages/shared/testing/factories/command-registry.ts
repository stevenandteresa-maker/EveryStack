/**
 * Factory for CommandEntry test data.
 *
 * Produces valid CommandEntry objects with sensible defaults.
 * No database insertion — CommandEntry is an in-memory type (system commands
 * are hardcoded, no DB table yet).
 */

import type { CommandEntry } from '../../../../apps/web/src/lib/command-bar/types';

let counter = 0;

/**
 * Creates a test CommandEntry with sensible defaults.
 * Each call produces a unique id and command_key.
 */
export function createTestCommandRegistryEntry(
  overrides?: Partial<CommandEntry>,
): CommandEntry {
  counter += 1;

  return {
    id: overrides?.id ?? `test-cmd-${counter}`,
    command_key: overrides?.command_key ?? `test-command-${counter}`,
    label: overrides?.label ?? `Test Command ${counter}`,
    description: overrides?.description ?? `Description for test command ${counter}`,
    category: overrides?.category ?? 'Utility',
    source: overrides?.source ?? 'system',
    context_scopes: overrides?.context_scopes ?? ['global'],
    permission_required: overrides?.permission_required ?? 'viewer',
    sort_order: overrides?.sort_order ?? counter * 100,
  };
}

/** Reset the counter between test suites if needed. */
export function resetCommandRegistryCounter(): void {
  counter = 0;
}
