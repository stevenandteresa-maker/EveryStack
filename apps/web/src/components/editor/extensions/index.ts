import type { AnyExtension } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Typography } from '@tiptap/extension-typography';
import { CharacterCount } from '@tiptap/extension-character-count';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { common, createLowlight } from 'lowlight';
import { MergeTag } from './merge-tag/merge-tag';
import { RecordRef } from './record-ref/record-ref';
import { Callout } from './callout/callout';
import { SlashCommand } from './slash-command/slash-command';

// Re-export custom nodes for external use
export { MergeTag, type MergeTagAttributes } from './merge-tag/merge-tag';
export { RecordRef, type RecordRefAttributes } from './record-ref/record-ref';
export { Callout, CALLOUT_DEFAULTS, type CalloutVariant, type CalloutAttributes } from './callout/callout';
export { SlashCommand, SLASH_COMMAND_PLUGIN_KEY } from './slash-command/slash-command';

// Re-export NodeView components
export { MergeTagView } from './merge-tag/merge-tag-view';
export { RecordRefView } from './record-ref/record-ref-view';
export { CalloutView } from './callout/callout-view';

const lowlight = createLowlight(common);

export interface SmartDocExtensionOptions {
  /** Placeholder text shown when the editor is empty */
  placeholder?: string;
  /** Maximum character count (0 = unlimited) */
  characterLimit?: number;
}

/**
 * TipTap Environment 2 — Smart Doc Editor extensions.
 *
 * Full-featured document editor for template authoring and wiki/doc editing.
 * Includes rich formatting, tables, code blocks, task lists, and custom
 * EveryStack nodes (MergeTag, RecordRef, Callout).
 *
 * Deliberately separate from Environment 1 (Chat Editor) — see
 * apps/web/src/components/chat/extensions.ts.
 */
export function createSmartDocExtensions(options?: SmartDocExtensionOptions): AnyExtension[] {
  return [
    StarterKit.configure({
      // Disable codeBlock — replaced by CodeBlockLowlight
      codeBlock: false,
      // Disable link + underline — configured separately below with options
      link: false,
      underline: false,
    }),

    // Inline formatting
    Underline,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,

    // Links
    Link.configure({
      autolink: true,
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-teal-600 underline cursor-pointer',
        rel: 'noopener noreferrer',
      },
    }),

    // Media
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: 'rounded max-w-full',
      },
    }),

    // Tables
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,

    // Code blocks with syntax highlighting
    CodeBlockLowlight.configure({ lowlight }),

    // Task lists
    TaskList,
    TaskItem.configure({ nested: true }),

    // Text utilities
    Placeholder.configure({
      placeholder: options?.placeholder ?? 'Start typing, or press "/" for commands…',
    }),
    Typography,
    CharacterCount.configure({
      limit: options?.characterLimit || undefined,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),

    // Custom EveryStack nodes
    MergeTag,
    RecordRef,
    Callout,

    // Slash command (shell — popup wired in Unit 5)
    SlashCommand,
  ];
}

/**
 * Names of all extensions active in the Smart Doc editor.
 * Used for test verification.
 */
export const SMART_DOC_EXTENSION_NAMES = [
  // StarterKit bundled
  'bold',
  'italic',
  'strike',
  'code',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'horizontalRule',
  'hardBreak',
  'document',
  'paragraph',
  'text',
  'listItem',
  'listKeymap',
  'dropcursor',
  'gapcursor',
  'undoRedo',

  // Configured separately
  'underline',
  'highlight',
  'textStyle',
  'color',
  'link',
  'image',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'codeBlock',
  'taskList',
  'taskItem',
  'placeholder',
  'typography',
  'characterCount',
  'textAlign',

  // Custom EveryStack nodes
  'mergeTag',
  'recordRef',
  'callout',
  'slashCommand',
] as const;
