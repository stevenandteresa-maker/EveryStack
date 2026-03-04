/**
 * R2StorageClient — S3-compatible storage client for Cloudflare R2 / MinIO.
 *
 * Wraps @aws-sdk/client-s3 behind the StorageClient interface.
 * Feature code should never import this directly — use StorageClient from the barrel export.
 */

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type {
  HeadObjectResult,
  PresignOptions,
  PresignResult,
  StorageClient,
} from './client';
import type { StorageConfig } from './config';
import { getStorageConfig } from './config';

const DEFAULT_PRESIGN_EXPIRES_SECONDS = 3600;
const DELETE_MANY_BATCH_SIZE = 1000;

export class R2StorageClient implements StorageClient {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(config?: StorageConfig) {
    const cfg = config ?? getStorageConfig();
    this.bucket = cfg.bucket;

    this.s3 = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  async presignPut(key: string, options: PresignOptions): Promise<PresignResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
      ContentLength: options.contentLength,
    });

    const expiresIn = options.expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRES_SECONDS;
    const url = await getSignedUrl(this.s3, command, { expiresIn });

    return {
      url,
      headers: {
        'Content-Type': options.contentType,
        'Content-Length': String(options.contentLength),
      },
    };
  }

  async presignGet(key: string, expiresInSeconds?: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: 'attachment',
    });

    const expiresIn = expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRES_SECONDS;
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3.send(command);
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    // S3 DeleteObjects supports max 1000 keys per request
    for (let i = 0; i < keys.length; i += DELETE_MANY_BATCH_SIZE) {
      const batch = keys.slice(i, i + DELETE_MANY_BATCH_SIZE);
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: batch.map((k) => ({ Key: k })),
          Quiet: true,
        },
      });

      await this.s3.send(command);
    }
  }

  async headObject(key: string): Promise<HeadObjectResult | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3.send(command);

      return {
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
      };
    } catch (error: unknown) {
      // S3 returns NotFound (404) when the object doesn't exist
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async getStream(key: string): Promise<ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3.send(command);

    if (!response.Body) {
      throw new Error(`Empty response body for key: ${key}`);
    }

    return response.Body.transformToWebStream();
  }
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const name = (error as { name?: string }).name;
  return name === 'NotFound' || name === 'NoSuchKey' || name === '404';
}
