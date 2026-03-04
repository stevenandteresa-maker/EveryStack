import { describe, it, expect } from 'vitest';
import { verifyMagicBytes, MAGIC_SIGNATURES } from '../magic-bytes';

/** Helper to create a Uint8Array from hex bytes. */
function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe('verifyMagicBytes', () => {
  describe('JPEG verification', () => {
    it('accepts valid JPEG magic bytes', () => {
      const buffer = bytes(0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10);
      const result = verifyMagicBytes(buffer, 'image/jpeg');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('image/jpeg');
    });

    it('rejects when claimed JPEG but content is PNG', () => {
      const buffer = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
      const result = verifyMagicBytes(buffer, 'image/jpeg');
      expect(result.valid).toBe(false);
      expect(result.detectedMime).toBe('image/png');
    });
  });

  describe('PNG verification', () => {
    it('accepts valid PNG magic bytes', () => {
      const buffer = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
      const result = verifyMagicBytes(buffer, 'image/png');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('image/png');
    });

    it('rejects when claimed PNG but content is JPEG', () => {
      const buffer = bytes(0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x00);
      const result = verifyMagicBytes(buffer, 'image/png');
      expect(result.valid).toBe(false);
      expect(result.detectedMime).toBe('image/jpeg');
    });
  });

  describe('GIF verification', () => {
    it('accepts valid GIF magic bytes', () => {
      const buffer = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
      const result = verifyMagicBytes(buffer, 'image/gif');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('image/gif');
    });
  });

  describe('PDF verification', () => {
    it('accepts valid PDF magic bytes (%PDF)', () => {
      const buffer = bytes(0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E);
      const result = verifyMagicBytes(buffer, 'application/pdf');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('application/pdf');
    });

    it('rejects when claimed PDF but content is JPEG', () => {
      const buffer = bytes(0xFF, 0xD8, 0xFF, 0xE0);
      const result = verifyMagicBytes(buffer, 'application/pdf');
      expect(result.valid).toBe(false);
    });
  });

  describe('ZIP/OOXML verification', () => {
    const pkBytes = bytes(0x50, 0x4B, 0x03, 0x04, 0x14, 0x00);

    it('accepts ZIP magic bytes for application/zip', () => {
      const result = verifyMagicBytes(pkBytes, 'application/zip');
      expect(result.valid).toBe(true);
    });

    it('accepts ZIP magic bytes for DOCX', () => {
      const result = verifyMagicBytes(
        pkBytes,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts ZIP magic bytes for XLSX', () => {
      const result = verifyMagicBytes(
        pkBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts ZIP magic bytes for PPTX', () => {
      const result = verifyMagicBytes(
        pkBytes,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('WebP verification', () => {
    it('accepts valid WebP (RIFF + WEBP)', () => {
      // RIFF....WEBP
      const buffer = bytes(
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      );
      const result = verifyMagicBytes(buffer, 'image/webp');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('image/webp');
    });

    it('rejects RIFF container that is actually WAV when claimed as WebP', () => {
      // RIFF....WAVE
      const buffer = bytes(
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x41, 0x56, 0x45,
      );
      const result = verifyMagicBytes(buffer, 'image/webp');
      expect(result.valid).toBe(false);
      expect(result.detectedMime).toBe('audio/wav');
    });
  });

  describe('WAV verification', () => {
    it('accepts valid WAV (RIFF + WAVE)', () => {
      const buffer = bytes(
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x41, 0x56, 0x45,
      );
      const result = verifyMagicBytes(buffer, 'audio/wav');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('audio/wav');
    });
  });

  describe('MP4 verification', () => {
    it('accepts valid MP4 (ftyp at offset 4)', () => {
      // [size bytes] + ftyp
      const buffer = bytes(
        0x00, 0x00, 0x00, 0x18,
        0x66, 0x74, 0x79, 0x70,
      );
      const result = verifyMagicBytes(buffer, 'video/mp4');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('video/mp4');
    });
  });

  describe('WebM verification', () => {
    it('accepts valid WebM magic bytes', () => {
      const buffer = bytes(0x1A, 0x45, 0xDF, 0xA3);
      const result = verifyMagicBytes(buffer, 'video/webm');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('video/webm');
    });
  });

  describe('unverifiable MIME types', () => {
    it('accepts text/csv without byte verification', () => {
      const buffer = bytes(0x6E, 0x61, 0x6D, 0x65); // "name"
      const result = verifyMagicBytes(buffer, 'text/csv');
      expect(result.valid).toBe(true);
    });

    it('accepts text/plain without byte verification', () => {
      const result = verifyMagicBytes(bytes(0x48, 0x65, 0x6C), 'text/plain');
      expect(result.valid).toBe(true);
    });

    it('accepts application/json without byte verification', () => {
      const result = verifyMagicBytes(bytes(0x7B), 'application/json');
      expect(result.valid).toBe(true);
    });

    it('accepts image/svg+xml without byte verification', () => {
      const result = verifyMagicBytes(bytes(0x3C), 'image/svg+xml');
      expect(result.valid).toBe(true);
    });

    it('accepts image/heic without byte verification', () => {
      const result = verifyMagicBytes(bytes(0x00), 'image/heic');
      expect(result.valid).toBe(true);
    });

    it('accepts image/heif without byte verification', () => {
      const result = verifyMagicBytes(bytes(0x00), 'image/heif');
      expect(result.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('rejects empty buffer for verifiable types', () => {
      const result = verifyMagicBytes(new Uint8Array(0), 'image/jpeg');
      expect(result.valid).toBe(false);
    });

    it('rejects buffer too short for signature', () => {
      const buffer = bytes(0xFF, 0xD8); // JPEG needs 3 bytes
      const result = verifyMagicBytes(buffer, 'image/jpeg');
      expect(result.valid).toBe(false);
    });
  });

  describe('MAGIC_SIGNATURES', () => {
    it('has signatures for common types', () => {
      const mimes = MAGIC_SIGNATURES.map((s) => s.mime);
      expect(mimes).toContain('image/jpeg');
      expect(mimes).toContain('image/png');
      expect(mimes).toContain('application/pdf');
      expect(mimes).toContain('application/zip');
    });
  });
});
