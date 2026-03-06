import { describe, it, expect } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue, FilesValue } from '../../../types';
import {
  airtableFilesTransform,
  AIRTABLE_FILES_TRANSFORMS,
} from '../files-transforms';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldAttach001',
  name: 'Attachments',
  platformFieldType: 'multipleAttachments',
};

// ---------------------------------------------------------------------------
// multipleAttachments → files
// ---------------------------------------------------------------------------

describe('airtableFilesTransform', () => {
  describe('toCanonical', () => {
    it('maps Airtable attachment array to canonical file objects', () => {
      const attachments = [
        {
          id: 'attABC123',
          url: 'https://dl.airtable.com/file1.pdf',
          filename: 'invoice.pdf',
          size: 102400,
          type: 'application/pdf',
          thumbnails: {
            small: { url: 'https://dl.airtable.com/thumb-s.jpg' },
            large: { url: 'https://dl.airtable.com/thumb-l.jpg' },
          },
        },
        {
          id: 'attDEF456',
          url: 'https://dl.airtable.com/photo.jpg',
          filename: 'photo.jpg',
          size: 204800,
          type: 'image/jpeg',
          thumbnails: {
            small: { url: 'https://dl.airtable.com/photo-s.jpg' },
            large: { url: 'https://dl.airtable.com/photo-l.jpg' },
            full: { url: 'https://dl.airtable.com/photo-f.jpg' },
          },
        },
      ];

      const result = airtableFilesTransform.toCanonical(attachments, baseConfig);
      expect(result).toEqual({
        type: 'files',
        value: [
          {
            url: 'https://dl.airtable.com/file1.pdf',
            filename: 'invoice.pdf',
            file_type: 'application/pdf',
            size: 102400,
            thumbnail_url: 'https://dl.airtable.com/thumb-l.jpg',
            source_refs: { airtable: 'attABC123' },
          },
          {
            url: 'https://dl.airtable.com/photo.jpg',
            filename: 'photo.jpg',
            file_type: 'image/jpeg',
            size: 204800,
            thumbnail_url: 'https://dl.airtable.com/photo-l.jpg',
            source_refs: { airtable: 'attDEF456' },
          },
        ],
      });
    });

    it('prefers large thumbnail, falls back to full then small', () => {
      const result = airtableFilesTransform.toCanonical(
        [{ id: 'att1', url: 'u', filename: 'f', size: 1, type: 't', thumbnails: { full: { url: 'full-url' }, small: { url: 'small-url' } } }],
        baseConfig,
      ) as FilesValue;
      expect(result.value[0]?.thumbnail_url).toBe('full-url');
    });

    it('returns null thumbnail when no thumbnails object', () => {
      const result = airtableFilesTransform.toCanonical(
        [{ id: 'att1', url: 'u', filename: 'f', size: 1, type: 't' }],
        baseConfig,
      ) as FilesValue;
      expect(result.value[0]?.thumbnail_url).toBeNull();
    });

    it('stores Airtable attachment ID in source_refs', () => {
      const result = airtableFilesTransform.toCanonical(
        [{ id: 'attXYZ', url: 'u', filename: 'f', size: 0, type: 't' }],
        baseConfig,
      ) as FilesValue;
      expect(result.value[0]?.source_refs).toEqual({ airtable: 'attXYZ' });
    });

    it('returns empty array for null input', () => {
      const result = airtableFilesTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'files', value: [] });
    });

    it('returns empty array for undefined input', () => {
      const result = airtableFilesTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'files', value: [] });
    });

    it('returns empty array for non-array input', () => {
      const result = airtableFilesTransform.toCanonical('not-an-array', baseConfig);
      expect(result).toEqual({ type: 'files', value: [] });
    });

    it('handles attachment with missing optional fields', () => {
      const result = airtableFilesTransform.toCanonical(
        [{ id: '', url: undefined, filename: undefined, size: undefined, type: undefined }],
        baseConfig,
      ) as FilesValue;
      const file = result.value[0];
      expect(file?.url).toBe('');
      expect(file?.filename).toBe('');
      expect(file?.file_type).toBe('');
      expect(file?.size).toBe(0);
    });
  });

  describe('fromCanonical', () => {
    it('converts canonical files to Airtable attachment shape', () => {
      const canonical: CanonicalValue = {
        type: 'files',
        value: [
          {
            url: 'https://example.com/file.pdf',
            filename: 'report.pdf',
            file_type: 'application/pdf',
            size: 5000,
            thumbnail_url: 'https://example.com/thumb.jpg',
            source_refs: { airtable: 'att123' },
          },
        ],
      };
      const result = airtableFilesTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual([
        { url: 'https://example.com/file.pdf', filename: 'report.pdf' },
      ]);
    });

    it('returns empty array for empty files', () => {
      const canonical: CanonicalValue = { type: 'files', value: [] };
      const result = airtableFilesTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual([]);
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableFilesTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossy (thumbnail URLs may differ)', () => {
    expect(airtableFilesTransform.isLossless).toBe(false);
  });

  it('supports read and write operations', () => {
    expect(airtableFilesTransform.supportedOperations).toEqual(['read', 'write']);
  });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('files transforms registration', () => {
  it('registers multipleAttachments', () => {
    const types = AIRTABLE_FILES_TRANSFORMS.map((t) => t.airtableType);
    expect(types).toEqual(['multipleAttachments']);
  });
});
