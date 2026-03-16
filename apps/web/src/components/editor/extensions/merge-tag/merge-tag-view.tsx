'use client';

import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

/**
 * MergeTagView — React NodeView for the MergeTag node.
 *
 * Renders a teal pill showing the field placeholder text.
 * Atom node: click to select, backspace to delete.
 */
export function MergeTagView({ node, selected }: NodeViewProps) {
  const { fallback } = node.attrs;

  return (
    <NodeViewWrapper
      as="span"
      className={`
        inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5
        text-xs font-medium text-teal-800 cursor-default select-none
        ${selected ? 'ring-2 ring-teal-400 ring-offset-1' : ''}
      `}
      data-merge-tag=""
    >
      {`{{${fallback || 'field'}}}`}
    </NodeViewWrapper>
  );
}
