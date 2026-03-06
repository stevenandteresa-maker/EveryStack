// ---------------------------------------------------------------------------
// Airtable Text Category Transforms (Category 1)
//
// Transforms for: text, text_area, smart_doc
// Airtable types: singleLineText, multilineText, richText
// ---------------------------------------------------------------------------

import type { FieldTransform, PlatformFieldConfig, CanonicalValue } from '../../types';

/**
 * Minimal TipTap JSON document structure for rich text conversion.
 * Airtable stores rich text as Markdown; canonical form is TipTap JSON.
 */
interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
  [key: string]: unknown;
}

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Convert Airtable Markdown to a minimal TipTap JSON document.
 * Handles paragraphs, bold, italic, and code spans.
 * More complex formatting (tables, images) is best-effort.
 */
function markdownToTipTap(md: string): TipTapDoc {
  const lines = md.split('\n');
  const content: TipTapNode[] = [];

  for (const line of lines) {
    if (line.trim() === '') {
      content.push({ type: 'paragraph', content: [] });
      continue;
    }

    // Heading detection
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch && headingMatch[1] && headingMatch[2] !== undefined) {
      const level = headingMatch[1].length;
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineMarks(headingMatch[2]),
      });
      continue;
    }

    content.push({
      type: 'paragraph',
      content: parseInlineMarks(line),
    });
  }

  return { type: 'doc', content };
}

/**
 * Parse inline Markdown marks (bold, italic, code) into TipTap text nodes.
 */
function parseInlineMarks(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  // Regex matches: **bold**, *italic*, `code`, or plain text
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match[2] !== undefined) {
      // **bold**
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] });
    } else if (match[3] !== undefined) {
      // *italic*
      nodes.push({ type: 'text', text: match[3], marks: [{ type: 'italic' }] });
    } else if (match[4] !== undefined) {
      // `code`
      nodes.push({ type: 'text', text: match[4], marks: [{ type: 'code' }] });
    } else if (match[5] !== undefined) {
      // plain text
      nodes.push({ type: 'text', text: match[5] });
    }
  }

  return nodes;
}

/**
 * Convert TipTap JSON back to Markdown for Airtable.
 */
function tipTapToMarkdown(doc: TipTapDoc): string {
  const lines: string[] = [];

  for (const node of doc.content) {
    if (node.type === 'heading') {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = '#'.repeat(level);
      lines.push(`${prefix} ${renderInlineNodes(node.content ?? [])}`);
    } else if (node.type === 'paragraph') {
      lines.push(renderInlineNodes(node.content ?? []));
    } else {
      // Fallback: render children as plain text
      lines.push(renderInlineNodes(node.content ?? []));
    }
  }

  return lines.join('\n');
}

/**
 * Render TipTap inline nodes back to Markdown text.
 */
function renderInlineNodes(nodes: TipTapNode[]): string {
  return nodes
    .map((node) => {
      if (node.type !== 'text' || node.text === undefined) return '';
      const marks = node.marks ?? [];
      let text = node.text;
      for (const mark of marks) {
        if (mark.type === 'bold') text = `**${text}**`;
        else if (mark.type === 'italic') text = `*${text}*`;
        else if (mark.type === 'code') text = `\`${text}\``;
      }
      return text;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Transform definitions
// ---------------------------------------------------------------------------

/** singleLineText → text (lossless passthrough) */
export const airtableSingleLineTextTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'text', value: null };
    return { type: 'text', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'text') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** multilineText → text_area (lossless passthrough) */
export const airtableMultilineTextTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'text_area', value: null };
    return { type: 'text_area', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'text_area') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** richText → smart_doc (lossy — Markdown ↔ TipTap JSON formatting differences) */
export const airtableRichTextTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'smart_doc', value: null };
    const md = String(value);
    return { type: 'smart_doc', value: markdownToTipTap(md) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'smart_doc') return null;
    if (canonical.value == null) return null;
    // If it's a string reference, return it as-is (smart_doc_id)
    if (typeof canonical.value === 'string') return canonical.value;
    return tipTapToMarkdown(canonical.value as unknown as TipTapDoc);
  },
  isLossless: false,
  supportedOperations: ['read', 'write'],
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const AIRTABLE_TEXT_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'singleLineText', transform: airtableSingleLineTextTransform },
  { airtableType: 'multilineText', transform: airtableMultilineTextTransform },
  { airtableType: 'richText', transform: airtableRichTextTransform },
];
