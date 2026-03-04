/**
 * MIME type allowlist for file uploads.
 *
 * Five-layer content-type security (see files.md § Content-Type Security):
 * 1. MIME allowlist at presign time (this module)
 * 2. Magic byte verification at completion (magic-bytes.ts)
 * 3. SVG sanitization (sanitize.ts)
 * 4. Content-Disposition on download
 * 5. Separate CDN domain
 */

/** Map of allowed MIME types to their valid file extensions. */
export const ALLOWED_MIME_TYPES: Record<string, readonly string[]> = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],

  // Documents
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],

  // Audio
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],

  // Video
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],

  // Archives
  'application/zip': ['.zip'],
} as const;

/** Set of MIME types that support thumbnail generation. */
export const THUMBNAIL_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/** Check if a MIME type is in the allowlist. */
export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType in ALLOWED_MIME_TYPES;
}

/**
 * Check if a filename's extension matches the claimed MIME type.
 * Returns true if the extension is valid for the given MIME type.
 */
export function isAllowedExtension(mimeType: string, filename: string): boolean {
  const extensions = ALLOWED_MIME_TYPES[mimeType];
  if (!extensions) return false;

  const ext = getExtension(filename);
  if (!ext) return false;

  return extensions.includes(ext);
}

/** Extract lowercase extension from a filename, including the dot. */
function getExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) return null;
  return filename.slice(lastDot).toLowerCase();
}
