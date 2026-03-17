import type { Editor } from '@tiptap/core';

export interface SlashCommandItem {
  /** Unique key for this command */
  id: string;
  /** Display label in the menu */
  label: string;
  /** Optional description shown below the label */
  description?: string;
  /** Lucide icon name (consumed by SlashCommandList) */
  icon: string;
  /** Search aliases (matched in addition to label) */
  aliases?: string[];
  /** Execute the command in the editor */
  action: (editor: Editor) => void;
}

/**
 * Default slash command registry for the Smart Doc Editor.
 *
 * Covers: Heading 1–4, bullet/ordered/task lists, blockquote,
 * code block, table, image, callout, horizontal rule.
 */
export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'heading-1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: 'Heading1',
    aliases: ['h1', 'title'],
    action: (editor) => {
      editor.chain().focus().setHeading({ level: 1 }).run();
    },
  },
  {
    id: 'heading-2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: 'Heading2',
    aliases: ['h2', 'subtitle'],
    action: (editor) => {
      editor.chain().focus().setHeading({ level: 2 }).run();
    },
  },
  {
    id: 'heading-3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: 'Heading3',
    aliases: ['h3'],
    action: (editor) => {
      editor.chain().focus().setHeading({ level: 3 }).run();
    },
  },
  {
    id: 'heading-4',
    label: 'Heading 4',
    description: 'Smallest section heading',
    icon: 'Heading4',
    aliases: ['h4'],
    action: (editor) => {
      editor.chain().focus().setHeading({ level: 4 }).run();
    },
  },
  {
    id: 'bullet-list',
    label: 'Bullet List',
    description: 'Unordered list with bullet points',
    icon: 'List',
    aliases: ['ul', 'unordered'],
    action: (editor) => {
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    id: 'ordered-list',
    label: 'Numbered List',
    description: 'Ordered list with numbers',
    icon: 'ListOrdered',
    aliases: ['ol', 'numbered'],
    action: (editor) => {
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    id: 'task-list',
    label: 'Task List',
    description: 'Checklist with checkboxes',
    icon: 'ListChecks',
    aliases: ['todo', 'checkbox', 'checklist'],
    action: (editor) => {
      editor.chain().focus().toggleTaskList().run();
    },
  },
  {
    id: 'blockquote',
    label: 'Blockquote',
    description: 'Indented quote block',
    icon: 'TextQuote',
    aliases: ['quote'],
    action: (editor) => {
      editor.chain().focus().toggleBlockquote().run();
    },
  },
  {
    id: 'code-block',
    label: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: 'Code2',
    aliases: ['code', 'pre', 'snippet'],
    action: (editor) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Insert a 3×3 table',
    icon: 'Table',
    aliases: ['grid'],
    action: (editor) => {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Insert an image from URL',
    icon: 'ImageIcon',
    aliases: ['img', 'picture', 'photo'],
    action: (editor) => {
      // Placeholder — real image upload wired in template UI unit
      const src = '';
      if (src) {
        editor.chain().focus().setImage({ src }).run();
      }
    },
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Info, warning, or alert block',
    icon: 'AlertCircle',
    aliases: ['admonition', 'alert', 'info', 'warning'],
    action: (editor) => {
      editor.chain().focus().insertCallout().run();
    },
  },
  {
    id: 'horizontal-rule',
    label: 'Divider',
    description: 'Horizontal rule separator',
    icon: 'Minus',
    aliases: ['hr', 'separator', 'line'],
    action: (editor) => {
      editor.chain().focus().setHorizontalRule().run();
    },
  },
];

/**
 * Filter commands by query string (matches label and aliases).
 */
export function filterSlashCommands(query: string): SlashCommandItem[] {
  if (!query) return SLASH_COMMANDS;

  const lower = query.toLowerCase();
  return SLASH_COMMANDS.filter((cmd) => {
    if (cmd.label.toLowerCase().includes(lower)) return true;
    return cmd.aliases?.some((alias) => alias.toLowerCase().includes(lower)) ?? false;
  });
}
