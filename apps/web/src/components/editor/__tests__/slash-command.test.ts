// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  SLASH_COMMANDS,
  filterSlashCommands,
  type SlashCommandItem,
} from '../extensions/slash-command/commands';

describe('slash-command commands registry', () => {
  it('contains all 13 default commands', () => {
    expect(SLASH_COMMANDS).toHaveLength(13);
  });

  it('has unique IDs for every command', () => {
    const ids = SLASH_COMMANDS.map((cmd) => cmd.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every command has label, icon, and action', () => {
    for (const cmd of SLASH_COMMANDS) {
      expect(cmd.label).toBeTruthy();
      expect(cmd.icon).toBeTruthy();
      expect(typeof cmd.action).toBe('function');
    }
  });

  it('includes heading 1-4', () => {
    const headingIds = SLASH_COMMANDS.filter((c) => c.id.startsWith('heading-')).map((c) => c.id);
    expect(headingIds).toEqual(['heading-1', 'heading-2', 'heading-3', 'heading-4']);
  });

  it('includes lists (bullet, ordered, task)', () => {
    const listIds = SLASH_COMMANDS.filter(
      (c) => c.id.includes('list'),
    ).map((c) => c.id);
    expect(listIds).toContain('bullet-list');
    expect(listIds).toContain('ordered-list');
    expect(listIds).toContain('task-list');
  });

  it('includes blockquote, code-block, table, image, callout, horizontal-rule', () => {
    const ids = SLASH_COMMANDS.map((c) => c.id);
    expect(ids).toContain('blockquote');
    expect(ids).toContain('code-block');
    expect(ids).toContain('table');
    expect(ids).toContain('image');
    expect(ids).toContain('callout');
    expect(ids).toContain('horizontal-rule');
  });
});

describe('filterSlashCommands', () => {
  it('returns all commands when query is empty', () => {
    expect(filterSlashCommands('')).toHaveLength(SLASH_COMMANDS.length);
  });

  it('filters by label (case-insensitive)', () => {
    const results = filterSlashCommands('head');
    expect(results.every((r) => r.label.toLowerCase().includes('head'))).toBe(true);
    expect(results.length).toBe(4); // Heading 1-4
  });

  it('filters by alias', () => {
    const results = filterSlashCommands('h1');
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('heading-1');
  });

  it('filters by alias "todo" → task list', () => {
    const results = filterSlashCommands('todo');
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('task-list');
  });

  it('filters by alias "hr" → horizontal-rule', () => {
    const results = filterSlashCommands('hr');
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('horizontal-rule');
  });

  it('returns empty array when no match', () => {
    expect(filterSlashCommands('zzzznotreal')).toHaveLength(0);
  });

  it('matches partial label', () => {
    const results = filterSlashCommands('code');
    expect(results.some((r) => r.id === 'code-block')).toBe(true);
  });
});

describe('slash command actions', () => {
  it('heading action calls setHeading with correct level', () => {
    for (let level = 1; level <= 4; level++) {
      const cmd = SLASH_COMMANDS.find((c) => c.id === `heading-${level}`) as SlashCommandItem;
      let calledLevel: number | undefined;

      const mockEditor = {
        chain: () => ({
          focus: () => ({
            setHeading: (opts: { level: number }) => {
              calledLevel = opts.level;
              return { run: () => {} };
            },
          }),
        }),
      };

      cmd.action(mockEditor as never);
      expect(calledLevel).toBe(level);
    }
  });

  it('bullet-list action calls toggleBulletList', () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === 'bullet-list') as SlashCommandItem;
    let called = false;

    const mockEditor = {
      chain: () => ({
        focus: () => ({
          toggleBulletList: () => {
            called = true;
            return { run: () => {} };
          },
        }),
      }),
    };

    cmd.action(mockEditor as never);
    expect(called).toBe(true);
  });

  it('table action calls insertTable with 3x3', () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === 'table') as SlashCommandItem;
    let insertArgs: { rows: number; cols: number; withHeaderRow: boolean } | undefined;

    const mockEditor = {
      chain: () => ({
        focus: () => ({
          insertTable: (opts: { rows: number; cols: number; withHeaderRow: boolean }) => {
            insertArgs = opts;
            return { run: () => {} };
          },
        }),
      }),
    };

    cmd.action(mockEditor as never);
    expect(insertArgs).toEqual({ rows: 3, cols: 3, withHeaderRow: true });
  });

  it('callout action calls insertCallout', () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === 'callout') as SlashCommandItem;
    let called = false;

    const mockEditor = {
      chain: () => ({
        focus: () => ({
          insertCallout: () => {
            called = true;
            return { run: () => {} };
          },
        }),
      }),
    };

    cmd.action(mockEditor as never);
    expect(called).toBe(true);
  });

  it('horizontal-rule action calls setHorizontalRule', () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === 'horizontal-rule') as SlashCommandItem;
    let called = false;

    const mockEditor = {
      chain: () => ({
        focus: () => ({
          setHorizontalRule: () => {
            called = true;
            return { run: () => {} };
          },
        }),
      }),
    };

    cmd.action(mockEditor as never);
    expect(called).toBe(true);
  });
});
