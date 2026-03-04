import { describe, it, expect } from 'vitest';
import {
  ALLOWED_MIME_TYPES,
  THUMBNAIL_MIME_TYPES,
  isAllowedMimeType,
  isAllowedExtension,
} from '../mime';

describe('MIME allowlist', () => {
  it('contains exactly 19 MIME types', () => {
    // 7 images + 7 documents + 2 audio + 2 video + 1 archive = 19
    expect(Object.keys(ALLOWED_MIME_TYPES)).toHaveLength(19);
  });

  describe('isAllowedMimeType', () => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/heic',
      'image/heif',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/csv',
      'text/plain',
      'application/json',
      'audio/mpeg',
      'audio/wav',
      'video/mp4',
      'video/webm',
      'application/zip',
    ];

    it.each(allowedTypes)('allows %s', (mime) => {
      expect(isAllowedMimeType(mime)).toBe(true);
    });

    it('rejects executable types', () => {
      expect(isAllowedMimeType('application/x-executable')).toBe(false);
      expect(isAllowedMimeType('application/x-msdownload')).toBe(false);
      expect(isAllowedMimeType('application/x-sh')).toBe(false);
      expect(isAllowedMimeType('application/x-msdos-program')).toBe(false);
    });

    it('rejects HTML', () => {
      expect(isAllowedMimeType('text/html')).toBe(false);
    });

    it('rejects unknown MIME types', () => {
      expect(isAllowedMimeType('application/octet-stream')).toBe(false);
      expect(isAllowedMimeType('text/xml')).toBe(false);
      expect(isAllowedMimeType('')).toBe(false);
    });
  });

  describe('isAllowedExtension', () => {
    it('validates correct extensions for image types', () => {
      expect(isAllowedExtension('image/jpeg', 'photo.jpg')).toBe(true);
      expect(isAllowedExtension('image/jpeg', 'photo.jpeg')).toBe(true);
      expect(isAllowedExtension('image/png', 'image.png')).toBe(true);
      expect(isAllowedExtension('image/gif', 'animation.gif')).toBe(true);
      expect(isAllowedExtension('image/webp', 'photo.webp')).toBe(true);
      expect(isAllowedExtension('image/svg+xml', 'icon.svg')).toBe(true);
    });

    it('validates correct extensions for document types', () => {
      expect(isAllowedExtension('application/pdf', 'doc.pdf')).toBe(true);
      expect(isAllowedExtension('text/csv', 'data.csv')).toBe(true);
      expect(isAllowedExtension('text/plain', 'readme.txt')).toBe(true);
      expect(isAllowedExtension('application/json', 'config.json')).toBe(true);
    });

    it('rejects mismatched extensions', () => {
      expect(isAllowedExtension('image/jpeg', 'file.png')).toBe(false);
      expect(isAllowedExtension('image/png', 'file.jpg')).toBe(false);
      expect(isAllowedExtension('application/pdf', 'file.docx')).toBe(false);
    });

    it('rejects files with no extension', () => {
      expect(isAllowedExtension('image/jpeg', 'noextension')).toBe(false);
    });

    it('rejects unknown MIME types even with valid-looking extensions', () => {
      expect(isAllowedExtension('application/x-executable', 'file.exe')).toBe(false);
    });

    it('handles case-insensitive extensions', () => {
      expect(isAllowedExtension('image/jpeg', 'photo.JPG')).toBe(true);
      expect(isAllowedExtension('image/png', 'image.PNG')).toBe(true);
      expect(isAllowedExtension('application/pdf', 'doc.PDF')).toBe(true);
    });
  });

  describe('THUMBNAIL_MIME_TYPES', () => {
    it('includes raster image types', () => {
      expect(THUMBNAIL_MIME_TYPES.has('image/jpeg')).toBe(true);
      expect(THUMBNAIL_MIME_TYPES.has('image/png')).toBe(true);
      expect(THUMBNAIL_MIME_TYPES.has('image/gif')).toBe(true);
      expect(THUMBNAIL_MIME_TYPES.has('image/webp')).toBe(true);
      expect(THUMBNAIL_MIME_TYPES.has('image/heic')).toBe(true);
      expect(THUMBNAIL_MIME_TYPES.has('image/heif')).toBe(true);
    });

    it('excludes SVG (vector, not thumbnailable the same way)', () => {
      expect(THUMBNAIL_MIME_TYPES.has('image/svg+xml')).toBe(false);
    });

    it('excludes non-image types', () => {
      expect(THUMBNAIL_MIME_TYPES.has('application/pdf')).toBe(false);
      expect(THUMBNAIL_MIME_TYPES.has('video/mp4')).toBe(false);
    });
  });
});
