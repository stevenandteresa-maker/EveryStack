/**
 * PDFRenderer — converts TipTap JSONB content into a complete HTML document
 * with print CSS for PDF generation via Gotenberg's Chromium endpoint.
 *
 * Uses generateHTML() from @tiptap/html with the Smart Doc extension set,
 * then wraps the output in a full HTML page with embedded print styles
 * (page size, margins, DM Sans font).
 *
 * @see docs/reference/smart-docs.md § Rendering Pipelines
 */

import { generateHTML } from '@tiptap/html';
import type { JSONContent } from '@tiptap/core';
import { createSmartDocExtensions } from '@/components/editor/extensions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Page configuration for a document template. */
export interface DocumentTemplateSettings {
  /** Paper size — 'A4', 'Letter', 'Legal', etc. */
  pageSize: string;
  /** Page orientation. */
  orientation: 'portrait' | 'landscape';
  /** Margins in millimetres. */
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

// ---------------------------------------------------------------------------
// Page-size dimensions (mm) for the CSS @page rule
// ---------------------------------------------------------------------------

const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
};

function getPageDimensions(
  pageSize: string,
  orientation: 'portrait' | 'landscape',
): { width: number; height: number } {
  const base = PAGE_SIZES[pageSize] ?? PAGE_SIZES['A4']!;
  if (orientation === 'landscape') {
    return { width: base.height, height: base.width };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Render TipTap JSONB content into a complete HTML document ready for
 * Gotenberg's Chromium HTML→PDF endpoint.
 *
 * The returned HTML is a self-contained page with:
 * - DM Sans font loaded from Google Fonts
 * - Print CSS (@page rule with size/margins)
 * - Prose-like body styling matching the editor's appearance
 */
export function renderToHTML(
  content: JSONContent,
  settings: DocumentTemplateSettings,
): string {
  const extensions = createSmartDocExtensions();
  const bodyHTML = generateHTML(content, extensions);

  const { width, height } = getPageDimensions(settings.pageSize, settings.orientation);
  const { top, right, bottom, left } = settings.margins;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: ${width}mm ${height}mm;
      margin: ${top}mm ${right}mm ${bottom}mm ${left}mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    body {
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Headings */
    h1 { font-size: 28px; font-weight: 700; margin: 24px 0 12px; }
    h2 { font-size: 22px; font-weight: 600; margin: 20px 0 10px; }
    h3 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
    h4 { font-size: 16px; font-weight: 600; margin: 14px 0 8px; }
    h5 { font-size: 14px; font-weight: 600; margin: 12px 0 6px; }
    h6 { font-size: 13px; font-weight: 600; margin: 12px 0 6px; }

    /* Paragraphs and lists */
    p { margin: 0 0 8px; }
    ul, ol { margin: 0 0 8px; padding-left: 24px; }
    li { margin-bottom: 4px; }

    /* Blockquote */
    blockquote {
      border-left: 3px solid #d1d5db;
      margin: 12px 0;
      padding: 4px 16px;
      color: #4b5563;
    }

    /* Horizontal rule */
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 16px 0;
    }

    /* Code */
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      background: #f3f4f6;
      padding: 2px 4px;
      border-radius: 3px;
    }
    pre {
      background: #1e1e2e;
      color: #cdd6f4;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 12px 0;
    }
    pre code {
      background: none;
      padding: 0;
      color: inherit;
    }

    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
    }

    /* Task lists */
    ul[data-type="taskList"] {
      list-style: none;
      padding-left: 0;
    }
    ul[data-type="taskList"] li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    /* Links */
    a {
      color: #0d9488;
      text-decoration: underline;
    }

    /* Images */
    img {
      max-width: 100%;
      border-radius: 4px;
    }

    /* Callout — custom EveryStack node */
    div[data-callout] {
      padding: 12px 16px;
      border-radius: 6px;
      margin: 12px 0;
      border: 1px solid #e5e7eb;
    }
    div[data-callout="info"] { background: #eff6ff; border-color: #bfdbfe; }
    div[data-callout="warning"] { background: #fffbeb; border-color: #fde68a; }
    div[data-callout="error"] { background: #fef2f2; border-color: #fecaca; }
    div[data-callout="success"] { background: #f0fdf4; border-color: #bbf7d0; }

    /* Text alignment */
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-justify { text-align: justify; }

    /* Highlight */
    mark { padding: 2px 0; }
  </style>
</head>
<body>
  ${bodyHTML}
</body>
</html>`;
}
