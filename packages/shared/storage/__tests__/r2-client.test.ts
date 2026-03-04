import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

// Mock @aws-sdk/client-s3 before importing R2StorageClient
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class MockS3Client {
      send = mockSend;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(public config: any) {
        MockS3Client.lastConfig = config;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      static lastConfig: any;
    },
    PutObjectCommand: vi.fn().mockImplementation(function (this: unknown, input: unknown) {
      return { input, _type: 'PutObject' };
    }),
    GetObjectCommand: vi.fn().mockImplementation(function (this: unknown, input: unknown) {
      return { input, _type: 'GetObject' };
    }),
    DeleteObjectCommand: vi.fn().mockImplementation(function (this: unknown, input: unknown) {
      return { input, _type: 'DeleteObject' };
    }),
    DeleteObjectsCommand: vi.fn().mockImplementation(function (this: unknown, input: unknown) {
      return { input, _type: 'DeleteObjects' };
    }),
    HeadObjectCommand: vi.fn().mockImplementation(function (this: unknown, input: unknown) {
      return { input, _type: 'HeadObject' };
    }),
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://minio:9000/signed-url'),
}));

import {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { R2StorageClient } from '../r2-client';
import type { StorageConfig } from '../config';

const TEST_CONFIG: StorageConfig = {
  bucket: 'test-bucket',
  region: 'us-east-1',
  endpoint: 'http://localhost:9000',
  publicUrl: 'http://localhost:9000/test-bucket',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
};

describe('R2StorageClient', () => {
  let client: R2StorageClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new R2StorageClient(TEST_CONFIG);
  });

  describe('constructor', () => {
    it('creates S3Client with forcePathStyle: true', () => {
      const lastConfig = (S3Client as unknown as { lastConfig: Record<string, unknown> }).lastConfig;
      expect(lastConfig).toMatchObject({
        forcePathStyle: true,
        region: 'us-east-1',
        endpoint: 'http://localhost:9000',
      });
    });
  });

  describe('presignPut', () => {
    it('returns a presigned URL and headers', async () => {
      const result = await client.presignPut('t/tenant-1/files/file-1/original/photo.jpg', {
        contentType: 'image/jpeg',
        contentLength: 1024,
      });

      expect(result.url).toBe('https://minio:9000/signed-url');
      expect(result.headers).toEqual({
        'Content-Type': 'image/jpeg',
        'Content-Length': '1024',
      });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ _type: 'PutObject' }),
        { expiresIn: 3600 },
      );
    });

    it('respects custom expiresInSeconds', async () => {
      await client.presignPut('key', {
        contentType: 'text/plain',
        contentLength: 10,
        expiresInSeconds: 600,
      });

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 600 },
      );
    });
  });

  describe('presignGet', () => {
    it('returns a presigned GET URL', async () => {
      const url = await client.presignGet('t/tenant-1/files/file-1/original/photo.jpg');

      expect(url).toBe('https://minio:9000/signed-url');
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ _type: 'GetObject' }),
        { expiresIn: 3600 },
      );
    });

    it('passes ResponseContentDisposition: attachment', async () => {
      await client.presignGet('key');

      expect(GetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ResponseContentDisposition: 'attachment',
        }),
      );
    });
  });

  describe('delete', () => {
    it('sends DeleteObjectCommand', async () => {
      mockSend.mockResolvedValueOnce({});

      await client.delete('t/tenant-1/files/file-1/original/photo.jpg');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 't/tenant-1/files/file-1/original/photo.jpg',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteMany', () => {
    it('sends a single batch for <= 1000 keys', async () => {
      mockSend.mockResolvedValueOnce({});
      const keys = Array.from({ length: 5 }, (_, i) => `key-${i}`);

      await client.deleteMany(keys);

      expect(DeleteObjectsCommand).toHaveBeenCalledTimes(1);
      expect(DeleteObjectsCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Delete: {
          Objects: keys.map((k) => ({ Key: k })),
          Quiet: true,
        },
      });
    });

    it('batches at 1000 keys', async () => {
      mockSend.mockResolvedValue({});
      const keys = Array.from({ length: 2500 }, (_, i) => `key-${i}`);

      await client.deleteMany(keys);

      expect(DeleteObjectsCommand).toHaveBeenCalledTimes(3);

      // First batch: 1000 keys
      const firstCall = vi.mocked(DeleteObjectsCommand).mock.calls[0]?.[0] as { Delete?: { Objects?: unknown[] } } | undefined;
      expect(firstCall?.Delete?.Objects).toHaveLength(1000);

      // Second batch: 1000 keys
      const secondCall = vi.mocked(DeleteObjectsCommand).mock.calls[1]?.[0] as { Delete?: { Objects?: unknown[] } } | undefined;
      expect(secondCall?.Delete?.Objects).toHaveLength(1000);

      // Third batch: 500 keys
      const thirdCall = vi.mocked(DeleteObjectsCommand).mock.calls[2]?.[0] as { Delete?: { Objects?: unknown[] } } | undefined;
      expect(thirdCall?.Delete?.Objects).toHaveLength(500);
    });

    it('does nothing for empty array', async () => {
      await client.deleteMany([]);

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('headObject', () => {
    it('returns size and contentType for existing object', async () => {
      mockSend.mockResolvedValueOnce({
        ContentLength: 2048,
        ContentType: 'image/png',
      });

      const result = await client.headObject('t/tenant-1/files/file-1/original/photo.png');

      expect(result).toEqual({
        size: 2048,
        contentType: 'image/png',
      });
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 't/tenant-1/files/file-1/original/photo.png',
      });
    });

    it('returns null for non-existent object (NotFound)', async () => {
      const notFoundError = new Error('NotFound');
      notFoundError.name = 'NotFound';
      mockSend.mockRejectedValueOnce(notFoundError);

      const result = await client.headObject('t/tenant-1/files/missing.jpg');

      expect(result).toBeNull();
    });

    it('returns null for non-existent object (NoSuchKey)', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(noSuchKeyError);

      const result = await client.headObject('t/tenant-1/files/missing.jpg');

      expect(result).toBeNull();
    });

    it('re-throws non-NotFound errors', async () => {
      const accessDenied = new Error('Access Denied');
      accessDenied.name = 'AccessDenied';
      mockSend.mockRejectedValueOnce(accessDenied);

      await expect(client.headObject('t/tenant-1/files/secret.jpg')).rejects.toThrow('Access Denied');
    });

    it('defaults contentType when missing', async () => {
      mockSend.mockResolvedValueOnce({
        ContentLength: 100,
        ContentType: undefined,
      });

      const result = await client.headObject('key');

      expect(result?.contentType).toBe('application/octet-stream');
    });
  });

  describe('getStream', () => {
    it('returns a ReadableStream', async () => {
      const mockStream = new ReadableStream();
      mockSend.mockResolvedValueOnce({
        Body: {
          transformToWebStream: () => mockStream,
        },
      });

      const stream = await client.getStream('t/tenant-1/files/file-1/original/data.csv');

      expect(stream).toBe(mockStream);
    });

    it('throws if response body is empty', async () => {
      mockSend.mockResolvedValueOnce({ Body: undefined });

      await expect(client.getStream('t/tenant-1/missing.txt')).rejects.toThrow(
        'Empty response body',
      );
    });
  });
});
