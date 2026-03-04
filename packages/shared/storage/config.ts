/**
 * Storage configuration — reads from environment variables with MinIO defaults
 * for local development.
 *
 * Production: Cloudflare R2 (S3-compatible)
 * Development: MinIO (S3-compatible, runs in Docker)
 */

export interface StorageConfig {
  /** S3 bucket name. */
  bucket: string;
  /** S3 region. 'auto' for Cloudflare R2. */
  region: string;
  /** S3-compatible endpoint URL. */
  endpoint: string;
  /** Public URL prefix for CDN-served assets (optional in dev). */
  publicUrl: string;
  /** S3 access key ID. */
  accessKeyId: string;
  /** S3 secret access key. */
  secretAccessKey: string;
}

let cachedConfig: StorageConfig | null = null;

/**
 * Read storage configuration from environment variables.
 * Falls back to MinIO defaults for local development.
 */
export function getStorageConfig(): StorageConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    bucket: process.env['STORAGE_BUCKET'] ?? 'everystack-dev',
    region: process.env['STORAGE_REGION'] ?? 'us-east-1',
    endpoint: process.env['STORAGE_ENDPOINT'] ?? 'http://localhost:9000',
    publicUrl: process.env['STORAGE_PUBLIC_URL'] ?? 'http://localhost:9000/everystack-dev',
    accessKeyId: process.env['STORAGE_ACCESS_KEY_ID'] ?? 'minioadmin',
    secretAccessKey: process.env['STORAGE_SECRET_ACCESS_KEY'] ?? 'minioadmin',
  };

  return cachedConfig;
}

/**
 * Reset the cached config. Used in tests to pick up env overrides.
 * @internal
 */
export function resetStorageConfig(): void {
  cachedConfig = null;
}
