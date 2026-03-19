'use client';

import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

/**
 * RecordRefView — React NodeView for the RecordRef node.
 *
 * Renders an inline chip linking to a record. Shows a small
 * record icon and the display text.
 */
export function RecordRefView({ node, selected }: NodeViewProps) {
  const { displayText } = node.attrs;

  return (
    <NodeViewWrapper
      as="span"
      className={`
        inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5
        text-xs font-medium text-slate-700 cursor-pointer
        hover:bg-slate-200 transition-colors
        ${selected ? 'ring-2 ring-slate-400 ring-offset-1' : ''}
      `}
      data-record-ref=""
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect
          x="1.5"
          y="1.5"
          width="9"
          height="9"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1"
        />
        <line x1="4" y1="4" x2="8" y2="4" stroke="currentColor" strokeWidth="1" />
        <line x1="4" y1="6" x2="7" y2="6" stroke="currentColor" strokeWidth="1" />
        <line x1="4" y1="8" x2="6" y2="8" stroke="currentColor" strokeWidth="1" />
      </svg>
      {displayText || 'Record'}
    </NodeViewWrapper>
  );
}
