import { Node, mergeAttributes } from '@tiptap/core';
import type { DOMOutputSpec } from '@tiptap/pm/model';

export interface RecordRefAttributes {
  /** Table the record belongs to */
  tableId: string;
  /** Record being referenced */
  recordId: string;
  /** Display text shown in the chip */
  displayText: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    recordRef: {
      /**
       * Insert a record reference chip at the current cursor position.
       */
      insertRecordRef: (attrs: RecordRefAttributes) => ReturnType;
    };
  }
}

/**
 * RecordRef — TipTap Environment 2 custom inline node.
 *
 * Renders an inline chip that links to another record. Used in
 * document templates and wiki-style content to cross-reference records.
 */
export const RecordRef = Node.create({
  name: 'recordRef',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      tableId: { default: null },
      recordId: { default: null },
      displayText: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-record-ref]' }];
  },

  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    return [
      'span',
      mergeAttributes(
        {
          'data-record-ref': '',
          'data-table-id': HTMLAttributes.tableId,
          'data-record-id': HTMLAttributes.recordId,
          class:
            'inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors',
        },
        HTMLAttributes,
      ),
      HTMLAttributes.displayText || 'Record',
    ];
  },

  addCommands() {
    return {
      insertRecordRef:
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
