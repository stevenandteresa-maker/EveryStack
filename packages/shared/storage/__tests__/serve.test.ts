import { describe, it, expect, vi } from 'vitest';
import type { StorageClient } from '../client';
import { getFileDownloadUrl, getThumbnailUrl } from '../serve';
import { ForbiddenError } from '@everystack/shared/errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStorage(): StorageClient {
  return {
    presignPut: vi.fn(),
    presignGet: vi.fn().mockResolvedValue('https://storage.example.com/signed-url'),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    headObject: vi.fn(),
    getStream: vi.fn(),
    put: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests — getFileDownloadUrl
// ---------------------------------------------------------------------------

describe('getFileDownloadUrl', () => {
  it('throws ForbiddenError for pending scan status', async () => {
    const storage = createMockStorage();

    await expect(
      getFileDownloadUrl(storage, {
        storageKey: 't/tenant/files/123/original/doc.pdf',
        scanStatus: 'pending',
      }),
    ).rejects.toThrow(ForbiddenError);

    await expect(
      getFileDownloadUrl(storage, {
        storageKey: 't/tenant/files/123/original/doc.pdf',
        scanStatus: 'pending',
      }),
    ).rejects.toThrow('File is being scanned');

    expect(storage.presignGet).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError for infected scan status', async () => {
    const storage = createMockStorage();

    await expect(
      getFileDownloadUrl(storage, {
        storageKey: 't/tenant/files/123/original/doc.pdf',
        scanStatus: 'infected',
      }),
    ).rejects.toThrow(ForbiddenError);

    await expect(
      getFileDownloadUrl(storage, {
        storageKey: 't/tenant/files/123/original/doc.pdf',
        scanStatus: 'infected',
      }),
    ).rejects.toThrow('File is quarantined');

    expect(storage.presignGet).not.toHaveBeenCalled();
  });

  it('returns signed URL for clean scan status with 15-minute expiry', async () => {
    const storage = createMockStorage();

    const url = await getFileDownloadUrl(storage, {
      storageKey: 't/tenant/files/123/original/doc.pdf',
      scanStatus: 'clean',
    });

    expect(url).toBe('https://storage.example.com/signed-url');
    expect(storage.presignGet).toHaveBeenCalledWith(
      't/tenant/files/123/original/doc.pdf',
      900, // 15 minutes in seconds
    );
  });

  it('returns signed URL for skipped scan status', async () => {
    const storage = createMockStorage();

    const url = await getFileDownloadUrl(storage, {
      storageKey: 't/tenant/files/123/original/doc.pdf',
      scanStatus: 'skipped',
    });

    expect(url).toBe('https://storage.example.com/signed-url');
    expect(storage.presignGet).toHaveBeenCalledWith(
      't/tenant/files/123/original/doc.pdf',
      900,
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — getThumbnailUrl
// ---------------------------------------------------------------------------

describe('getThumbnailUrl', () => {
  it('builds CDN-cacheable thumbnail URL', () => {
    const url = getThumbnailUrl(
      'https://files.everystack.com',
      't/tenant-001/files/file-001/thumb/200.webp',
    );

    expect(url).toBe(
      'https://files.everystack.com/t/tenant-001/files/file-001/thumb/200.webp',
    );
  });
});
