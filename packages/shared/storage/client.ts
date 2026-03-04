/**
 * StorageClient — Provider-agnostic object storage interface.
 *
 * Feature code imports StorageClient, never @aws-sdk directly.
 * The R2StorageClient implementation handles S3-compatible providers
 * (Cloudflare R2 in production, MinIO in development).
 */

/** Options for generating a presigned PUT URL. */
export interface PresignOptions {
  /** MIME type of the file being uploaded. */
  contentType: string;
  /** Exact size in bytes of the file being uploaded. */
  contentLength: number;
  /** How long the presigned URL is valid, in seconds. Defaults to 3600. */
  expiresInSeconds?: number;
}

/** Result of generating a presigned PUT URL. */
export interface PresignResult {
  /** The presigned URL to upload to. */
  url: string;
  /** Headers the client must include with the PUT request. */
  headers: Record<string, string>;
}

/** Result of a HEAD object request. */
export interface HeadObjectResult {
  /** File size in bytes. */
  size: number;
  /** MIME content type. */
  contentType: string;
}

/**
 * Provider-agnostic storage client interface.
 *
 * All file operations go through this interface. Feature code requests
 * storage operations via StorageClient — never references @aws-sdk or
 * any provider SDK directly.
 */
export interface StorageClient {
  /**
   * Generate a presigned PUT URL for direct client upload.
   * The client uploads directly to object storage — never streams through the server.
   */
  presignPut(key: string, options: PresignOptions): Promise<PresignResult>;

  /**
   * Generate a presigned GET URL for direct client download.
   * Sets Content-Disposition: attachment for browser downloads.
   */
  presignGet(key: string, expiresInSeconds?: number): Promise<string>;

  /** Delete a single object by key. */
  delete(key: string): Promise<void>;

  /**
   * Delete multiple objects by key.
   * Automatically batches into groups of 1000 (S3 API limit).
   */
  deleteMany(keys: string[]): Promise<void>;

  /**
   * Get object metadata without downloading the body.
   * Returns null if the object does not exist (does not throw).
   */
  headObject(key: string): Promise<HeadObjectResult | null>;

  /** Get the object body as a readable stream. */
  getStream(key: string): Promise<ReadableStream>;
}
