/**
 * Magic byte verification — validates file content matches claimed MIME type.
 *
 * Part of the five-layer content-type security model (see files.md).
 * Called during upload completion to detect MIME type mismatches that
 * could indicate malicious file uploads.
 */

interface MagicSignature {
  mime: string;
  /** Byte pattern at the start of the file. */
  bytes: number[];
  /** Offset from the start of the file (default 0). */
  offset?: number;
}

/**
 * Known magic byte signatures for verifiable file types.
 * OOXML formats (docx, xlsx, pptx) share the ZIP signature.
 */
export const MAGIC_SIGNATURES: readonly MagicSignature[] = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  // GIF: 47 49 46 38 (GIF8)
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: 52 49 46 46 (RIFF) at offset 0, then 57 45 42 50 (WEBP) at offset 8
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
  // PDF: 25 50 44 46 (%PDF)
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  // ZIP / OOXML (docx, xlsx, pptx): 50 4B 03 04
  { mime: 'application/zip', bytes: [0x50, 0x4B, 0x03, 0x04] },
  // MP3 with ID3 tag: 49 44 33
  { mime: 'audio/mpeg', bytes: [0x49, 0x44, 0x33] },
  // MP3 sync word (no ID3): FF FB or FF F3 or FF F2
  { mime: 'audio/mpeg', bytes: [0xFF, 0xFB] },
  // WAV: 52 49 46 46 (RIFF) — disambiguated from WebP by content at offset 8
  { mime: 'audio/wav', bytes: [0x52, 0x49, 0x46, 0x46] },
  // MP4: ftyp at offset 4
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  // WebM: 1A 45 DF A3
  { mime: 'video/webm', bytes: [0x1A, 0x45, 0xDF, 0xA3] },
];

/** MIME types that cannot be verified by magic bytes (text-based formats). */
const UNVERIFIABLE_MIMES = new Set([
  'text/csv',
  'text/plain',
  'application/json',
  'image/svg+xml',
  'image/heic',
  'image/heif',
]);

/** OOXML MIME types that share the ZIP magic bytes (PK signature). */
const OOXML_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
]);

export interface MagicByteResult {
  /** Whether the magic bytes are valid for the claimed MIME type. */
  valid: boolean;
  /** The detected MIME type based on magic bytes, if identifiable. */
  detectedMime?: string;
}

/**
 * Verify that the magic bytes of a buffer match the claimed MIME type.
 *
 * @param buffer - First 8KB of the file
 * @param claimedMime - The MIME type claimed at upload time
 * @returns Verification result with detected MIME type
 */
export function verifyMagicBytes(
  buffer: Uint8Array,
  claimedMime: string,
): MagicByteResult {
  // Text-based formats have no magic bytes — accept if in allowlist
  if (UNVERIFIABLE_MIMES.has(claimedMime)) {
    return { valid: true };
  }

  // Find matching signature in the buffer
  const detected = detectMime(buffer);

  if (!detected) {
    return { valid: false };
  }

  // OOXML formats (docx/xlsx/pptx) all have ZIP magic bytes
  if (OOXML_MIMES.has(claimedMime) && OOXML_MIMES.has(detected)) {
    return { valid: true, detectedMime: detected };
  }

  // RIFF container: disambiguate WebP vs WAV by checking offset 8
  if (detected === 'image/webp' || detected === 'audio/wav') {
    const riffType = resolveRiffType(buffer);
    if (riffType) {
      return {
        valid: riffType === claimedMime,
        detectedMime: riffType,
      };
    }
  }

  return {
    valid: detected === claimedMime,
    detectedMime: detected,
  };
}

/** Detect the MIME type from magic bytes. Returns the first match. */
function detectMime(buffer: Uint8Array): string | undefined {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return sig.mime;
  }
  return undefined;
}

/** Resolve RIFF container type by checking bytes at offset 8. */
function resolveRiffType(buffer: Uint8Array): string | undefined {
  if (buffer.length < 12) return undefined;

  // WEBP at offset 8–11
  if (
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // WAVE at offset 8–11
  if (
    buffer[8] === 0x57 &&
    buffer[9] === 0x41 &&
    buffer[10] === 0x56 &&
    buffer[11] === 0x45
  ) {
    return 'audio/wav';
  }

  return undefined;
}
