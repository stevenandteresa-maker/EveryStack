// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { Command, CommandList } from '@/components/ui/command';
import {
  CommandBarSlashMenu,
  fuzzyFilterCommands,
  groupByCategory,
} from '../slash-menu';
import type { CommandEntry } from '@/lib/command-bar/types';

// Polyfill ResizeObserver + scrollIntoView for cmdk in jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() { /* noop */ }
      unobserve() { /* noop */ }
      disconnect() { /* noop */ }
    };
  }
  Element.prototype.scrollIntoView = vi.fn();
});

// ---------------------------------------------------------------------------
// Test data — subset of system commands
// ---------------------------------------------------------------------------

const MOCK_COMMANDS: CommandEntry[] = [
  {
    id: 'sys-goto',
    command_key: 'goto',
    label: 'Go To',
    description: 'Fuzzy search any base, table, or record',
    category: 'Navigation',
    source: 'system',
    context_scopes: ['global', 'table_view'],
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
    context_scopes: ['global'],
    permission_required: 'viewer',
    sort_order: 110,
  },
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
    id: 'sys-settings',
    command_key: 'settings',
    label: 'Settings',
    description: 'Open workspace settings',
    category: 'Settings',
    source: 'system',
    context_scopes: ['global'],
    permission_required: 'admin',
    sort_order: 700,
  },
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
];

// ---------------------------------------------------------------------------
// Pure function unit tests
// ---------------------------------------------------------------------------

describe('fuzzyFilterCommands', () => {
  it('returns all commands for empty query', () => {
    expect(fuzzyFilterCommands(MOCK_COMMANDS, '')).toHaveLength(5);
    expect(fuzzyFilterCommands(MOCK_COMMANDS, '/')).toHaveLength(5);
  });

  it('filters by command_key', () => {
    const result = fuzzyFilterCommands(MOCK_COMMANDS, '/goto');
    expect(result).toHaveLength(1);
    expect(result.at(0)?.id).toBe('sys-goto');
  });

  it('filters by label', () => {
    const result = fuzzyFilterCommands(MOCK_COMMANDS, 'Office');
    expect(result).toHaveLength(1);
    expect(result.at(0)?.id).toBe('sys-office');
  });

  it('filters by description', () => {
    const result = fuzzyFilterCommands(MOCK_COMMANDS, 'workspace settings');
    expect(result).toHaveLength(1);
    expect(result.at(0)?.id).toBe('sys-settings');
  });

  it('is case-insensitive', () => {
    expect(fuzzyFilterCommands(MOCK_COMMANDS, '/GOTO')).toHaveLength(1);
  });

  it('strips leading slashes before matching', () => {
    expect(fuzzyFilterCommands(MOCK_COMMANDS, '///goto')).toHaveLength(1);
  });

  it('returns empty for no match', () => {
    expect(fuzzyFilterCommands(MOCK_COMMANDS, 'zzzzz')).toHaveLength(0);
  });
});

describe('groupByCategory', () => {
  it('groups commands by category', () => {
    const groups = groupByCategory(MOCK_COMMANDS);
    expect(groups.size).toBe(4); // Navigation, Record Creation, Settings, AI Actions
    expect(groups.get('Navigation') ?? []).toHaveLength(2);
    expect(groups.get('Record Creation') ?? []).toHaveLength(1);
    expect(groups.get('Settings') ?? []).toHaveLength(1);
    expect(groups.get('AI Actions') ?? []).toHaveLength(1);
  });

  it('returns empty map for empty input', () => {
    const groups = groupByCategory([]);
    expect(groups.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Component tests
// ---------------------------------------------------------------------------

function renderSlashMenu(
  props: Partial<React.ComponentProps<typeof CommandBarSlashMenu>> = {},
) {
  const defaultProps = {
    query: '/',
    commands: MOCK_COMMANDS,
    ...props,
  };

  return render(
    <IntlWrapper>
      <Command>
        <CommandList>
          <CommandBarSlashMenu {...defaultProps} />
        </CommandList>
      </Command>
    </IntlWrapper>,
  );
}

describe('CommandBarSlashMenu', () => {
  it('renders all command groups when query is just /', () => {
    renderSlashMenu({ query: '/' });
    expect(screen.getByTestId('slash-group-navigation')).toBeInTheDocument();
    expect(screen.getByTestId('slash-group-record-creation')).toBeInTheDocument();
    expect(screen.getByTestId('slash-group-settings')).toBeInTheDocument();
    expect(screen.getByTestId('slash-group-ai-actions')).toBeInTheDocument();
  });

  it('shows command key and description', () => {
    renderSlashMenu({ query: '/' });
    expect(screen.getByText('/goto')).toBeInTheDocument();
    expect(screen.getByText('Fuzzy search any base, table, or record')).toBeInTheDocument();
  });

  it('filters commands by fuzzy query', () => {
    renderSlashMenu({ query: '/goto' });
    expect(screen.getByTestId('slash-cmd-goto')).toBeInTheDocument();
    expect(screen.queryByTestId('slash-cmd-office')).not.toBeInTheDocument();
    expect(screen.queryByTestId('slash-cmd-settings')).not.toBeInTheDocument();
  });

  it('shows no results for unmatched query', () => {
    renderSlashMenu({ query: '/zzzzz' });
    expect(screen.getByTestId('slash-no-results')).toBeInTheDocument();
  });

  it('shows permission-filtered commands (pre-filtered list)', () => {
    // Simulate a pre-filtered list (viewer only sees goto, office, summarize)
    const viewerCommands = MOCK_COMMANDS.filter(
      (cmd) => cmd.permission_required === 'viewer',
    );
    renderSlashMenu({ query: '/', commands: viewerCommands });

    expect(screen.getByTestId('slash-cmd-goto')).toBeInTheDocument();
    expect(screen.getByTestId('slash-cmd-office')).toBeInTheDocument();
    expect(screen.getByTestId('slash-cmd-summarize')).toBeInTheDocument();
    // Admin-only settings should not appear
    expect(screen.queryByTestId('slash-cmd-settings')).not.toBeInTheDocument();
    // Team-member-only new record should not appear
    expect(screen.queryByTestId('slash-cmd-new-record')).not.toBeInTheDocument();
  });

  it('calls onSelect when a command is selected', async () => {
    const onSelect = vi.fn();
    renderSlashMenu({ query: '/', onSelect });

    await act(async () => {
      screen.getByTestId('slash-cmd-goto').click();
    });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sys-goto' }),
    );
  });

  it('shows shortcut hints for known commands', () => {
    renderSlashMenu({ query: '/goto' });
    expect(screen.getByText('⌘G')).toBeInTheDocument();
  });
});
