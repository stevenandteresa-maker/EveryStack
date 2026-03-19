import { Node, mergeAttributes } from '@tiptap/core';
import type { DOMOutputSpec } from '@tiptap/pm/model';

/** The four callout variants — maps to semantic process states. */
export type CalloutVariant = 'info' | 'warning' | 'success' | 'error';

export interface CalloutAttributes {
  /** Emoji icon shown at the start of the callout */
  emoji: string;
  /** Variant determines the background/border color */
  color: CalloutVariant;
}

/** Default emoji per variant */
export const CALLOUT_DEFAULTS: Record<CalloutVariant, { emoji: string; bgClass: string; borderClass: string }> = {
  info: { emoji: 'ℹ️', bgClass: 'bg-blue-50', borderClass: 'border-blue-300' },
  warning: { emoji: '⚠️', bgClass: 'bg-amber-50', borderClass: 'border-amber-300' },
  success: { emoji: '✅', bgClass: 'bg-green-50', borderClass: 'border-green-300' },
  error: { emoji: '🚫', bgClass: 'bg-red-50', borderClass: 'border-red-300' },
};

/** Static color map for HTML rendering (no Tailwind in renderHTML) */
const CALLOUT_COLORS: Record<CalloutVariant, { bg: string; border: string }> = {
  info: { bg: '#eff6ff', border: '#93c5fd' },
  warning: { bg: '#fffbeb', border: '#fcd34d' },
  success: { bg: '#f0fdf4', border: '#86efac' },
  error: { bg: '#fef2f2', border: '#fca5a5' },
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /**
       * Insert a callout block at the current position.
       */
      insertCallout: (attrs?: Partial<CalloutAttributes>) => ReturnType;
      /**
       * Toggle the callout variant (cycles through info → warning → success → error).
       */
      toggleCalloutVariant: () => ReturnType;
    };
  }
}

/**
 * Callout — TipTap Environment 2 custom block node.
 *
 * A styled admonition block with an emoji and color variant.
 * Content is a paragraph (or multiple) inside the callout.
 */
export const Callout = Node.create({
  name: 'callout',

  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: { default: 'ℹ️' },
      color: { default: 'info' as CalloutVariant },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    const variant = (HTMLAttributes.color as CalloutVariant) || 'info';
    const colors = CALLOUT_COLORS[variant] || CALLOUT_COLORS.info;

    return [
      'div',
      mergeAttributes(
        {
          'data-callout': '',
          'data-callout-variant': variant,
          style: `background: ${colors.bg}; border-left: 3px solid ${colors.border}; padding: 12px 16px; border-radius: 4px; margin: 8px 0;`,
        },
        HTMLAttributes,
      ),
      [
        'span',
        {
          contenteditable: 'false',
          style: 'margin-right: 8px; user-select: none;',
        },
        HTMLAttributes.emoji || 'ℹ️',
      ],
      ['div', { style: 'flex: 1; min-width: 0;' }, 0],
    ];
  },

  addCommands() {
    return {
      insertCallout:
        (attrs) =>
        ({ commands }) => {
          const variant = attrs?.color || 'info';
          const emoji = attrs?.emoji || CALLOUT_DEFAULTS[variant]?.emoji || 'ℹ️';

          return commands.insertContent({
            type: this.name,
            attrs: { emoji, color: variant },
            content: [{ type: 'paragraph' }],
          });
        },

      toggleCalloutVariant:
        () =>
        ({ state, commands }) => {
          const { from } = state.selection;
          const node = state.doc.nodeAt(from);
          if (!node || node.type.name !== 'callout') return false;

          const variants: CalloutVariant[] = ['info', 'warning', 'success', 'error'];
          const currentIndex = variants.indexOf(node.attrs.color as CalloutVariant);
          const nextVariant: CalloutVariant = variants[(currentIndex + 1) % variants.length] ?? 'info';
          const defaults = CALLOUT_DEFAULTS[nextVariant];

          return commands.updateAttributes('callout', {
            color: nextVariant,
            emoji: defaults.emoji,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Backspace at start of empty callout → lift out of callout
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;

        // Only handle if inside a callout
        const calloutDepth = $from.depth;
        if (calloutDepth < 2) return false;

        const parentNode = $from.node(calloutDepth - 1);
        if (parentNode.type.name !== 'callout') return false;

        // Only at start of first child block when it's empty
        const isAtStart = $from.parentOffset === 0;
        const isFirstChild = $from.index(calloutDepth - 1) === 0;
        const isEmpty = $from.parent.content.size === 0;

        if (isAtStart && isFirstChild && isEmpty && parentNode.childCount === 1) {
          // Replace callout with an empty paragraph
          return editor.commands.clearNodes();
        }

        return false;
      },
    };
  },
});
