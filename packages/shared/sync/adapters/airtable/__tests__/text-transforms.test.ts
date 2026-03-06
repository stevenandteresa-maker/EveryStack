import { describe, it, expect } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue } from '../../../types';
import {
  airtableSingleLineTextTransform,
  airtableMultilineTextTransform,
  airtableRichTextTransform,
} from '../text-transforms';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldAbc123',
  name: 'Test Field',
  platformFieldType: 'singleLineText',
};

// ---------------------------------------------------------------------------
// singleLineText → text
// ---------------------------------------------------------------------------

describe('airtableSingleLineTextTransform', () => {
  describe('toCanonical', () => {
    it('converts a string value to text canonical form', () => {
      const result = airtableSingleLineTextTransform.toCanonical('Hello World', baseConfig);
      expect(result).toEqual({ type: 'text', value: 'Hello World' });
    });

    it('returns null value for null input', () => {
      const result = airtableSingleLineTextTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'text', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableSingleLineTextTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'text', value: null });
    });

    it('coerces numeric input to string', () => {
      const result = airtableSingleLineTextTransform.toCanonical(42, baseConfig);
      expect(result).toEqual({ type: 'text', value: '42' });
    });

    it('handles empty string', () => {
      const result = airtableSingleLineTextTransform.toCanonical('', baseConfig);
      expect(result).toEqual({ type: 'text', value: '' });
    });
  });

  describe('fromCanonical', () => {
    it('returns the string value from canonical form', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'Hello' };
      const result = airtableSingleLineTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('Hello');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'text', value: null };
      const result = airtableSingleLineTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'number', value: 42 };
      const result = airtableSingleLineTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableSingleLineTextTransform.isLossless).toBe(true);
  });

  it('supports all standard operations', () => {
    expect(airtableSingleLineTextTransform.supportedOperations).toEqual([
      'read', 'write', 'filter', 'sort',
    ]);
  });
});

// ---------------------------------------------------------------------------
// multilineText → text_area
// ---------------------------------------------------------------------------

describe('airtableMultilineTextTransform', () => {
  describe('toCanonical', () => {
    it('converts a multiline string to text_area canonical form', () => {
      const result = airtableMultilineTextTransform.toCanonical('Line 1\nLine 2', baseConfig);
      expect(result).toEqual({ type: 'text_area', value: 'Line 1\nLine 2' });
    });

    it('returns null value for null input', () => {
      const result = airtableMultilineTextTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'text_area', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableMultilineTextTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'text_area', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('returns the string value from canonical form', () => {
      const canonical: CanonicalValue = { type: 'text_area', value: 'Line 1\nLine 2' };
      const result = airtableMultilineTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('Line 1\nLine 2');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'text_area', value: null };
      const result = airtableMultilineTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'hello' };
      const result = airtableMultilineTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableMultilineTextTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// richText → smart_doc (Markdown ↔ TipTap JSON)
// ---------------------------------------------------------------------------

describe('airtableRichTextTransform', () => {
  describe('toCanonical', () => {
    it('converts plain Markdown paragraph to TipTap JSON', () => {
      const result = airtableRichTextTransform.toCanonical('Hello world', baseConfig);
      expect(result).toEqual({
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hello world' }],
            },
          ],
        },
      });
    });

    it('converts Markdown with bold to TipTap JSON', () => {
      const result = airtableRichTextTransform.toCanonical('This is **bold** text', baseConfig);
      expect(result.type).toBe('smart_doc');
      const doc = (result as { type: 'smart_doc'; value: Record<string, unknown> }).value;
      const content = (doc as { content: Array<{ content: unknown[] }> }).content;
      const paragraph = content[0]!;
      expect(paragraph.content).toContainEqual({
        type: 'text',
        text: 'bold',
        marks: [{ type: 'bold' }],
      });
    });

    it('converts Markdown with italic to TipTap JSON', () => {
      const result = airtableRichTextTransform.toCanonical('This is *italic* text', baseConfig);
      const doc = (result as { type: 'smart_doc'; value: { content: Array<{ content: unknown[] }> } }).value;
      const paragraph = doc.content[0]!;
      expect(paragraph.content).toContainEqual({
        type: 'text',
        text: 'italic',
        marks: [{ type: 'italic' }],
      });
    });

    it('converts Markdown with inline code to TipTap JSON', () => {
      const result = airtableRichTextTransform.toCanonical('Use the `console.log` function', baseConfig);
      const doc = (result as { type: 'smart_doc'; value: { content: Array<{ content: unknown[] }> } }).value;
      const paragraph = doc.content[0]!;
      expect(paragraph.content).toContainEqual({
        type: 'text',
        text: 'console.log',
        marks: [{ type: 'code' }],
      });
    });

    it('converts Markdown headings to TipTap heading nodes', () => {
      const result = airtableRichTextTransform.toCanonical('## My Heading', baseConfig);
      const doc = (result as { type: 'smart_doc'; value: { content: Array<{ type: string; attrs?: { level: number } }> } }).value;
      expect(doc.content[0]!.type).toBe('heading');
      expect(doc.content[0]!.attrs?.level).toBe(2);
    });

    it('returns null value for null input', () => {
      const result = airtableRichTextTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'smart_doc', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableRichTextTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'smart_doc', value: null });
    });

    it('handles empty lines as empty paragraphs', () => {
      const result = airtableRichTextTransform.toCanonical('Line 1\n\nLine 3', baseConfig);
      const doc = (result as { type: 'smart_doc'; value: { content: Array<{ type: string }> } }).value;
      expect(doc.content).toHaveLength(3);
      expect(doc.content[1]!.type).toBe('paragraph');
    });
  });

  describe('fromCanonical', () => {
    it('converts TipTap JSON back to Markdown', () => {
      const canonical: CanonicalValue = {
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hello world' }],
            },
          ],
        },
      };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('Hello world');
    });

    it('converts TipTap bold marks back to Markdown bold', () => {
      const canonical: CanonicalValue = {
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'This is ' },
                { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
                { type: 'text', text: ' text' },
              ],
            },
          ],
        },
      };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('This is **bold** text');
    });

    it('converts TipTap italic marks back to Markdown italic', () => {
      const canonical: CanonicalValue = {
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'This is ' },
                { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
                { type: 'text', text: ' text' },
              ],
            },
          ],
        },
      };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('This is *italic* text');
    });

    it('converts TipTap code marks back to Markdown inline code', () => {
      const canonical: CanonicalValue = {
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Use ' },
                { type: 'text', text: 'console.log', marks: [{ type: 'code' }] },
              ],
            },
          ],
        },
      };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('Use `console.log`');
    });

    it('handles unknown node types in TipTap via fallback', () => {
      const canonical: CanonicalValue = {
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'blockquote',
              content: [{ type: 'text', text: 'A quote' }],
            },
          ],
        },
      };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('A quote');
    });

    it('converts TipTap heading back to Markdown heading', () => {
      const canonical: CanonicalValue = {
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Title' }],
            },
          ],
        },
      };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('## Title');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'smart_doc', value: null };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('passes through string smart_doc references', () => {
      const canonical: CanonicalValue = { type: 'smart_doc', value: 'doc_ref_123' };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('doc_ref_123');
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'hello' };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('ignores non-text inline nodes in TipTap content', () => {
      const canonical: CanonicalValue = {
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'before ' },
                { type: 'image', attrs: { src: 'test.png' } },
                { type: 'text', text: ' after' },
              ],
            },
          ],
        },
      };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('before  after');
    });

    it('ignores unknown mark types during fromCanonical', () => {
      const canonical: CanonicalValue = {
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'styled', marks: [{ type: 'strikethrough' }] },
              ],
            },
          ],
        },
      };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('styled');
    });

    it('defaults heading level to 1 when attrs missing', () => {
      const canonical: CanonicalValue = {
        type: 'smart_doc',
        value: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              content: [{ type: 'text', text: 'No Level' }],
            },
          ],
        },
      };
      const result = airtableRichTextTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('# No Level');
    });
  });

  it('is marked as lossy (Markdown ↔ TipTap formatting differences)', () => {
    expect(airtableRichTextTransform.isLossless).toBe(false);
  });

  it('supports read and write but not filter/sort', () => {
    expect(airtableRichTextTransform.supportedOperations).toEqual(['read', 'write']);
  });
});
