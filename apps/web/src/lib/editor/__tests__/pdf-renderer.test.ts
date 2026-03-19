import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { renderToHTML } from '../pdf-renderer';
import type { DocumentTemplateSettings } from '../pdf-renderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: DocumentTemplateSettings = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
};

function simpleDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderToHTML', () => {
  it('produces a complete HTML document', () => {
    const html = renderToHTML(simpleDoc('Hello world'), DEFAULT_SETTINGS);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('Hello world');
  });

  it('includes DM Sans font link', () => {
    const html = renderToHTML(simpleDoc('test'), DEFAULT_SETTINGS);

    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('DM+Sans');
    expect(html).toContain("font-family: 'DM Sans'");
  });

  it('includes JetBrains Mono font link', () => {
    const html = renderToHTML(simpleDoc('test'), DEFAULT_SETTINGS);

    expect(html).toContain('JetBrains+Mono');
    expect(html).toContain("font-family: 'JetBrains Mono'");
  });

  it('sets @page rule with A4 portrait dimensions', () => {
    const html = renderToHTML(simpleDoc('test'), DEFAULT_SETTINGS);

    // A4 portrait: 210mm × 297mm
    expect(html).toContain('size: 210mm 297mm');
    expect(html).toContain('margin: 20mm 20mm 20mm 20mm');
  });

  it('swaps dimensions for landscape orientation', () => {
    const settings: DocumentTemplateSettings = {
      ...DEFAULT_SETTINGS,
      orientation: 'landscape',
    };
    const html = renderToHTML(simpleDoc('test'), settings);

    // A4 landscape: 297mm × 210mm
    expect(html).toContain('size: 297mm 210mm');
  });

  it('uses Letter dimensions when specified', () => {
    const settings: DocumentTemplateSettings = {
      ...DEFAULT_SETTINGS,
      pageSize: 'Letter',
    };
    const html = renderToHTML(simpleDoc('test'), settings);

    // Letter portrait: 216mm × 279mm
    expect(html).toContain('size: 216mm 279mm');
  });

  it('uses Legal dimensions when specified', () => {
    const settings: DocumentTemplateSettings = {
      ...DEFAULT_SETTINGS,
      pageSize: 'Legal',
    };
    const html = renderToHTML(simpleDoc('test'), settings);

    // Legal portrait: 216mm × 356mm
    expect(html).toContain('size: 216mm 356mm');
  });

  it('falls back to A4 for unknown page sizes', () => {
    const settings: DocumentTemplateSettings = {
      ...DEFAULT_SETTINGS,
      pageSize: 'Tabloid',
    };
    const html = renderToHTML(simpleDoc('test'), settings);

    expect(html).toContain('size: 210mm 297mm');
  });

  it('applies custom margins', () => {
    const settings: DocumentTemplateSettings = {
      ...DEFAULT_SETTINGS,
      margins: { top: 10, right: 15, bottom: 25, left: 30 },
    };
    const html = renderToHTML(simpleDoc('test'), settings);

    expect(html).toContain('margin: 10mm 15mm 25mm 30mm');
  });

  it('includes print-color-adjust for background rendering', () => {
    const html = renderToHTML(simpleDoc('test'), DEFAULT_SETTINGS);

    expect(html).toContain('-webkit-print-color-adjust: exact');
    expect(html).toContain('print-color-adjust: exact');
  });

  it('renders headings correctly', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Subtitle' }],
        },
      ],
    };
    const html = renderToHTML(content, DEFAULT_SETTINGS);

    expect(html).toMatch(/<h1[^>]*>Title<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Subtitle<\/h2>/);
  });

  it('renders bold and italic inline marks', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'bold' }],
              text: 'strong',
            },
            { type: 'text', text: ' and ' },
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'emphasis',
            },
          ],
        },
      ],
    };
    const html = renderToHTML(content, DEFAULT_SETTINGS);

    expect(html).toContain('<strong>strong</strong>');
    expect(html).toContain('<em>emphasis</em>');
  });

  it('renders a table', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Name' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Alice' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const html = renderToHTML(content, DEFAULT_SETTINGS);

    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Name');
    expect(html).toContain('<td');
    expect(html).toContain('Alice');
  });

  it('renders a bullet list', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item one' }],
                },
              ],
            },
          ],
        },
      ],
    };
    const html = renderToHTML(content, DEFAULT_SETTINGS);

    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('Item one');
  });

  it('renders an empty document without errors', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
    const html = renderToHTML(content, DEFAULT_SETTINGS);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toMatch(/<p[^>]*><\/p>/);
  });
});
