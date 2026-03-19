'use client';

import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { CALLOUT_DEFAULTS, type CalloutVariant } from './callout';

/**
 * CalloutView — React NodeView for the Callout block node.
 *
 * Renders a colored admonition with an emoji, variant-driven styling,
 * and editable content area.
 */
export function CalloutView({ node, selected, updateAttributes }: NodeViewProps) {
  const variant = (node.attrs.color as CalloutVariant) || 'info';
  const emoji = node.attrs.emoji || CALLOUT_DEFAULTS[variant].emoji;
  const { bgClass, borderClass } = CALLOUT_DEFAULTS[variant];

  const variants: CalloutVariant[] = ['info', 'warning', 'success', 'error'];

  function cycleVariant() {
    const nextIndex = (variants.indexOf(variant) + 1) % variants.length;
    const next: CalloutVariant = variants[nextIndex] ?? 'info';
    updateAttributes({
      color: next,
      emoji: CALLOUT_DEFAULTS[next].emoji,
    });
  }

  return (
    <NodeViewWrapper
      className={`
        flex items-start gap-2 rounded border-l-[3px] px-4 py-3 my-2
        ${bgClass} ${borderClass}
        ${selected ? 'ring-2 ring-blue-300 ring-offset-1' : ''}
      `}
      data-callout=""
      data-callout-variant={variant}
    >
      <button
        type="button"
        contentEditable={false}
        className="shrink-0 text-base leading-none cursor-pointer select-none hover:scale-110 transition-transform"
        onClick={cycleVariant}
        aria-label="Change callout type"
      >
        {emoji}
      </button>
      <NodeViewContent className="flex-1 min-w-0 [&>p]:my-0" />
    </NodeViewWrapper>
  );
}
