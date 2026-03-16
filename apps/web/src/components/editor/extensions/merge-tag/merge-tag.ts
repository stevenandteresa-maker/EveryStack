import { Node, mergeAttributes } from '@tiptap/core';
import type { DOMOutputSpec } from '@tiptap/pm/model';

export interface MergeTagAttributes {
  /** Table the field belongs to */
  tableId: string;
  /** Field to resolve at render time */
  fieldId: string;
  /** Fallback text when field value is empty */
  fallback: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mergeTag: {
      /**
       * Insert a merge tag at the current cursor position.
       */
      insertMergeTag: (attrs: MergeTagAttributes) => ReturnType;
    };
  }
}

/**
 * MergeTag — TipTap Environment 2 custom inline node.
 *
 * Renders a teal pill placeholder in the editor that is resolved to
 * actual field values at PDF/preview render time. Atom node (not editable
 * inline — select and delete as a unit).
 */
export const MergeTag = Node.create({
  name: 'mergeTag',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      tableId: { default: null },
      fieldId: { default: null },
      fallback: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-tag]' }];
  },

  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    return [
      'span',
      mergeAttributes(
        {
          'data-merge-tag': '',
          'data-table-id': HTMLAttributes.tableId,
          'data-field-id': HTMLAttributes.fieldId,
          'data-fallback': HTMLAttributes.fallback,
          class:
            'inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 cursor-default select-none',
        },
        HTMLAttributes,
      ),
      `{{${HTMLAttributes.fallback || 'field'}}}`,
    ];
  },

  addCommands() {
    return {
      insertMergeTag:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
