/**
 * File serving utilities — presigned download URLs with scan status guards.
 *
 * Authenticated files use short-lived presigned GET URLs (15-minute expiry).
 * Thumbnails use CDN-cacheable public URLs.
 */

import type { StorageClient } from './client';
import { ForbiddenError } from '@everystack/shared/errors';

export interface GetFileDownloadUrlOptions {
  /** The storage key for the file object. */
  storageKey: string;
  /** Current scan status of the file (pending, clean, infected, skipped). */
  scanStatus: string;
}

/** Presigned download URL expiry: 15 minutes. */
const DOWNLOAD_URL_EXPIRY_SECONDS = 900;

/**
 * Generate a presigned download URL for an authenticated file.
 *
 * Blocks access to files that are still being scanned or are infected.
 * Clean and skipped files receive a 15-minute presigned URL.
 */
export async function getFileDownloadUrl(
  storage: StorageClient,
  options: GetFileDownloadUrlOptions,
): Promise<string> {
  if (options.scanStatus === 'pending') {
    throw new ForbiddenError('File is being scanned');
  }
  if (options.scanStatus === 'infected') {
    throw new ForbiddenError('File is quarantined');
  }

  return storage.presignGet(options.storageKey, DOWNLOAD_URL_EXPIRY_SECONDS);
}

/**
 * Build a CDN-cacheable thumbnail URL.
 *
 * Thumbnails are public assets served with `Cache-Control: public, max-age=86400`.
 */
export function getThumbnailUrl(publicUrl: string, thumbnailKey: string): string {
  return `${publicUrl}/${thumbnailKey}`;
}
