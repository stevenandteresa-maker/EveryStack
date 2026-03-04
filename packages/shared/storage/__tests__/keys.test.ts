import { describe, expect, it } from 'vitest';

import {
  docGenOutputKey,
  fileOriginalKey,
  fileThumbnailKey,
  portalAssetKey,
  quarantineKey,
  templateKey,
} from '../keys';

const TENANT_ID = '01912345-6789-7abc-def0-123456789abc';
const FILE_ID = '01912345-6789-7abc-def0-ffffffffffff';

describe('Storage key utilities', () => {
  describe('tenant isolation prefix', () => {
    it('all keys start with t/{tenantId}/', () => {
      const keys = [
        fileOriginalKey(TENANT_ID, FILE_ID, 'photo.jpg'),
        fileThumbnailKey(TENANT_ID, FILE_ID, 200),
        portalAssetKey(TENANT_ID, 'portal-1', 'logo.png'),
        docGenOutputKey(TENANT_ID, 'doc-1', 'pdf'),
        templateKey(TENANT_ID, 'template-1'),
        quarantineKey(TENANT_ID, FILE_ID, 'virus.exe'),
      ];

      for (const key of keys) {
        expect(key).toMatch(new RegExp(`^t/${TENANT_ID}/`));
      }
    });
  });

  describe('fileOriginalKey', () => {
    it('returns correct path', () => {
      const key = fileOriginalKey(TENANT_ID, FILE_ID, 'photo.jpg');
      expect(key).toBe(`t/${TENANT_ID}/files/${FILE_ID}/original/photo.jpg`);
    });

    it('sanitizes path traversal attempts', () => {
      const key = fileOriginalKey(TENANT_ID, FILE_ID, '../../../etc/passwd');
      expect(key).not.toContain('..');
      expect(key).toMatch(new RegExp(`^t/${TENANT_ID}/`));
    });

    it('sanitizes slashes in filenames', () => {
      const key = fileOriginalKey(TENANT_ID, FILE_ID, 'path/to/file.jpg');
      expect(key).not.toContain('/to/');
      expect(key).toMatch(new RegExp(`^t/${TENANT_ID}/files/${FILE_ID}/original/`));
    });
  });

  describe('fileThumbnailKey', () => {
    it('returns correct path for 200px thumbnail', () => {
      const key = fileThumbnailKey(TENANT_ID, FILE_ID, 200);
      expect(key).toBe(`t/${TENANT_ID}/files/${FILE_ID}/thumb/200.webp`);
    });

    it('returns correct path for 800px thumbnail', () => {
      const key = fileThumbnailKey(TENANT_ID, FILE_ID, 800);
      expect(key).toBe(`t/${TENANT_ID}/files/${FILE_ID}/thumb/800.webp`);
    });
  });

  describe('portalAssetKey', () => {
    it('returns correct path', () => {
      const key = portalAssetKey(TENANT_ID, 'portal-1', 'logo.png');
      expect(key).toBe(`t/${TENANT_ID}/portal-assets/portal-1/logo.png`);
    });
  });

  describe('docGenOutputKey', () => {
    it('returns correct path for pdf', () => {
      const key = docGenOutputKey(TENANT_ID, 'doc-1', 'pdf');
      expect(key).toBe(`t/${TENANT_ID}/doc-gen/doc-1/output.pdf`);
    });

    it('returns correct path for docx', () => {
      const key = docGenOutputKey(TENANT_ID, 'doc-1', 'docx');
      expect(key).toBe(`t/${TENANT_ID}/doc-gen/doc-1/output.docx`);
    });
  });

  describe('templateKey', () => {
    it('returns correct path', () => {
      const key = templateKey(TENANT_ID, 'template-1');
      expect(key).toBe(`t/${TENANT_ID}/templates/template-1/template.docx`);
    });
  });

  describe('quarantineKey', () => {
    it('returns correct path', () => {
      const key = quarantineKey(TENANT_ID, FILE_ID, 'infected.exe');
      expect(key).toBe(`t/${TENANT_ID}/quarantine/${FILE_ID}/infected.exe`);
    });

    it('sanitizes filename', () => {
      const key = quarantineKey(TENANT_ID, FILE_ID, '../../escape.sh');
      expect(key).not.toContain('..');
      expect(key).toMatch(new RegExp(`^t/${TENANT_ID}/quarantine/`));
    });
  });
});
