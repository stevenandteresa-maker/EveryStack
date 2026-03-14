'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { CommandGroup, CommandItem, CommandEmpty } from '@/components/ui/command';
import { CommandShortcut } from '@/components/ui/command';
import type { CommandEntry } from '@/lib/command-bar/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandBarSlashMenuProps {
  query: string;
  commands: CommandEntry[];
  onSelect?: (command: CommandEntry) => void;
}

// ---------------------------------------------------------------------------
// Fuzzy filter — simple substring match on command_key and label
// ---------------------------------------------------------------------------

function fuzzyFilterCommands(
  commands: CommandEntry[],
  query: string,
): CommandEntry[] {
  const stripped = query.replace(/^\/+/, '').trim().toLowerCase();
  if (!stripped) return commands;

  return commands.filter(
    (cmd) =>
      cmd.command_key.toLowerCase().includes(stripped) ||
      cmd.label.toLowerCase().includes(stripped) ||
      cmd.description.toLowerCase().includes(stripped),
  );
}

// ---------------------------------------------------------------------------
// Group commands by category
// ---------------------------------------------------------------------------

function groupByCategory(
  commands: CommandEntry[],
): Map<string, CommandEntry[]> {
  const groups = new Map<string, CommandEntry[]>();
  for (const cmd of commands) {
    const existing = groups.get(cmd.category);
    if (existing) {
      existing.push(cmd);
    } else {
      groups.set(cmd.category, [cmd]);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Shortcut hints for well-known commands
// ---------------------------------------------------------------------------

const SHORTCUT_HINTS: Record<string, string> = {
  goto: '⌘G',
  'new record': '⌘N',
  settings: '⌘,',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandBarSlashMenu({
  query,
  commands,
  onSelect,
}: CommandBarSlashMenuProps) {
  const t = useTranslations('commandBar');

  const filtered = useMemo(
    () => fuzzyFilterCommands(commands, query),
    [commands, query],
  );

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  if (filtered.length === 0) {
    return (
      <CommandEmpty data-testid="slash-no-results">
        {t('slashNoResults')}
      </CommandEmpty>
    );
  }

  return (
    <>
      {Array.from(grouped.entries()).map(([category, cmds]) => (
        <CommandGroup
          key={category}
          heading={category}
          data-testid={`slash-group-${category.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {cmds.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={`slash-${cmd.command_key}`}
              onSelect={() => onSelect?.(cmd)}
              data-testid={`slash-cmd-${cmd.command_key.replace(/\s+/g, '-')}`}
            >
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">/{cmd.command_key}</span>
                <span className="text-xs text-muted-foreground">
                  {cmd.description}
                </span>
              </div>
              {SHORTCUT_HINTS[cmd.command_key] && (
                <CommandShortcut>
                  {SHORTCUT_HINTS[cmd.command_key]}
                </CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
    </>
  );
}

export { fuzzyFilterCommands, groupByCategory };
