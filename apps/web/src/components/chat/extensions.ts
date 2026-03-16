import { StarterKit } from '@tiptap/starter-kit';
import { Mention } from '@tiptap/extension-mention';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import type { ChatMentionSuggestionConfig } from './types';

/**
 * TipTap Environment 1 — Chat Editor extensions.
 *
 * Includes: Bold, Italic, Underline, Strike, Code (inline marks),
 * BulletList, OrderedList, Blockquote, Link (autolink),
 * Mention (teal pill), Placeholder, History (undo/redo),
 * InputRules (markdown shortcuts).
 *
 * Deliberately excludes: Headings, Tables, CodeBlock, Image,
 * HorizontalRule — those belong to TipTap Environment 2 (Smart Docs).
 */
export function createChatEditorExtensions(options?: {
  placeholder?: string;
  mentionSuggestion?: ChatMentionSuggestionConfig;
}) {
  return [
    StarterKit.configure({
      // Disable features not used in chat (TipTap env 2 only)
      heading: false,
      codeBlock: false,
      horizontalRule: false,
      // Disable link/underline from StarterKit — we configure them separately below
      link: false,
      underline: false,
    }),

    Link.configure({
      autolink: true,
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-teal-600 underline cursor-pointer',
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),

    Underline,

    Mention.configure({
      HTMLAttributes: {
        class:
          'inline-flex items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-800 no-underline',
      },
      renderText({ node }) {
        return `@${node.attrs.label ?? node.attrs.id}`;
      },
      renderHTML({ options: opts, node }) {
        return [
          'span',
          opts.HTMLAttributes,
          `@${node.attrs.label ?? node.attrs.id}`,
        ];
      },
      ...(options?.mentionSuggestion
        ? { suggestion: options.mentionSuggestion }
        : {}),
    }),

    Placeholder.configure({
      placeholder: options?.placeholder ?? 'Type a message…',
    }),
  ];
}

/**
 * The names of all extensions that should be active in the chat editor.
 * Used for test verification — StarterKit bundles multiple extensions.
 */
export const CHAT_EDITOR_EXTENSION_NAMES = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'bulletList',
  'orderedList',
  'blockquote',
  'link',
  'mention',
  'placeholder',
  'undoRedo',

  // StarterKit bundled infrastructure extensions
  'document',
  'paragraph',
  'text',
  'listItem',
  'listKeymap',
  'dropcursor',
  'gapcursor',
  'hardBreak',
] as const;

/**
 * Extensions that must NOT be present in chat editor (env 2 only).
 */
export const CHAT_EDITOR_EXCLUDED_EXTENSIONS = [
  'heading',
  'codeBlock',
  'horizontalRule',
  'image',
  'table',
] as const;
