/**
 * File sanitization utilities — filename cleaning and SVG stripping.
 *
 * Part of the five-layer content-type security model (see files.md).
 */

/** Maximum filename length after sanitization. */
const MAX_FILENAME_LENGTH = 255;

/**
 * Sanitize a user-provided filename for safe storage and display.
 *
 * - Replaces path separators and unsafe characters with underscores
 * - Collapses consecutive dots (prevents extension spoofing)
 * - Collapses consecutive whitespace
 * - Trims leading/trailing whitespace and dots
 * - Enforces 255 character limit
 * - Falls back to 'unnamed' if the result is empty
 */
export function sanitizeFilename(filename: string): string {
  let result = filename
    // Remove null bytes
    .replace(/\0/g, '')
    // Replace path separators
    .replace(/[/\\]/g, '_')
    // Replace control characters and unsafe shell characters
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0001-\u001F\u007F<>:"|?*]/g, '_')
    // Collapse consecutive dots (prevents extension spoofing)
    .replace(/\.{2,}/g, '.')
    // Collapse consecutive whitespace
    .replace(/\s+/g, ' ')
    // Trim whitespace and dots from edges
    .trim()
    .replace(/^\.+|\.+$/g, '');

  // Enforce length limit — preserve extension if possible
  if (result.length > MAX_FILENAME_LENGTH) {
    const lastDot = result.lastIndexOf('.');
    if (lastDot > 0 && result.length - lastDot <= 10) {
      const ext = result.slice(lastDot);
      const name = result.slice(0, MAX_FILENAME_LENGTH - ext.length);
      result = name + ext;
    } else {
      result = result.slice(0, MAX_FILENAME_LENGTH);
    }
  }

  return result || 'unnamed';
}

/**
 * Sanitize SVG content by removing potentially dangerous elements and attributes.
 *
 * Strips:
 * - <script> elements and their content
 * - <foreignObject> elements and their content
 * - on* event handler attributes (onclick, onload, onerror, etc.)
 * - javascript: and data: URIs in href/xlink:href attributes
 *
 * Uses a lightweight regex approach (no DOM parsing required).
 */
export function sanitizeSvg(svgContent: string): string {
  let result = svgContent;

  // Remove <script>...</script> elements (including multi-line)
  result = result.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Remove self-closing <script /> tags
  result = result.replace(/<script[^>]*\/>/gi, '');

  // Remove <foreignObject>...</foreignObject> elements
  result = result.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  // Remove self-closing <foreignObject /> tags
  result = result.replace(/<foreignObject[^>]*\/>/gi, '');

  // Remove on* event handler attributes
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Remove javascript: URIs in href attributes
  result = result.replace(
    /\s+(href|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi,
    '',
  );

  // Remove data: URIs in href attributes (potential script injection)
  result = result.replace(
    /\s+(href|xlink:href)\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi,
    '',
  );

  return result;
}
