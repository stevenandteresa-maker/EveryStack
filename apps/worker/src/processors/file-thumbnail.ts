/**
 * FileThumbnailProcessor — generates WebP thumbnails and blurhash for uploaded images.
 *
 * Pipeline: look up file → verify not infected → download → Sharp pipeline
 * (auto-rotate EXIF → resize → WebP) → upload thumbs → blurhash → update DB → publish event.
 *
 * Guards: 60s timeout, skip >50MP images, GIF first frame only.
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { FileThumbnailJobData } from '@everystack/shared/queue';
import type { StorageClient } from '@everystack/shared/storage';
import type { EventPublisher } from '@everystack/shared/realtime';
import { fileThumbnailKey } from '@everystack/shared/storage';
import { getDbForTenant, files, eq, and } from '@everystack/shared/db';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { BaseProcessor } from '../lib/base-processor';

const MAX_PIXELS = 50_000_000; // 50 megapixels
const BLURHASH_X_COMPONENTS = 4;
const BLURHASH_Y_COMPONENTS = 3;

const THUMB_CONFIGS = [
  { size: 200, quality: 80 },
  { size: 800, quality: 85 },
] as const;

export class FileThumbnailProcessor extends BaseProcessor<FileThumbnailJobData> {
  static readonly JOB_NAME = 'file.thumbnail' as const;

  constructor(
    private readonly storage: StorageClient,
    private readonly eventPublisher: EventPublisher,
  ) {
    super('file-processing');
  }

  async processJob(job: Job<FileThumbnailJobData>, logger: Logger): Promise<void> {
    const { fileId, tenantId, mimeType } = job.data;

    // Look up file
    const readDb = getDbForTenant(tenantId, 'read');
    const [file] = await readDb
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.tenantId, tenantId)));

    if (!file) {
      logger.warn({ fileId }, 'File not found, skipping thumbnail');
      return;
    }

    // Don't process infected files
    if (file.scanStatus === 'infected') {
      logger.warn({ fileId }, 'File is infected, skipping thumbnail');
      return;
    }

    // Download file
    const stream = await this.storage.getStream(file.storageKey);
    const buffer = await streamToBuffer(stream);

    // Check dimensions — skip images over 50MP
    const meta = await sharp(buffer).metadata();
    const pixels = (meta.width ?? 0) * (meta.height ?? 0);
    if (pixels > MAX_PIXELS) {
      logger.warn(
        { fileId, pixels, maxPixels: MAX_PIXELS },
        'Image exceeds 50MP limit, skipping thumbnail',
      );
      return;
    }

    // GIF: extract first frame only
    let inputBuffer = buffer;
    if (mimeType === 'image/gif') {
      inputBuffer = await sharp(buffer, { pages: 1 }).toBuffer();
    }

    // Generate thumbnails
    let blurhashValue: string | undefined;
    let thumbWidth: number | undefined;
    let thumbHeight: number | undefined;

    for (const { size, quality } of THUMB_CONFIGS) {
      const result = await sharp(inputBuffer)
        .rotate() // auto-rotate based on EXIF
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true });

      const key = fileThumbnailKey(tenantId, fileId, size);
      await this.storage.put(key, result.data, 'image/webp');

      // Generate blurhash from the 200px thumbnail
      if (size === 200) {
        const { data: rawPixels, info } = await sharp(result.data)
          .raw()
          .ensureAlpha()
          .toBuffer({ resolveWithObject: true });

        blurhashValue = encode(
          new Uint8ClampedArray(rawPixels),
          info.width,
          info.height,
          BLURHASH_X_COMPONENTS,
          BLURHASH_Y_COMPONENTS,
        );
        thumbWidth = info.width;
        thumbHeight = info.height;
      }
    }

    // Update files row with thumbnail key and metadata
    const thumbnailKeyBase = `t/${tenantId}/files/${fileId}/thumb`;
    const writeDb = getDbForTenant(tenantId, 'write');
    await writeDb
      .update(files)
      .set({
        thumbnailKey: thumbnailKeyBase,
        metadata: {
          ...(file.metadata as Record<string, unknown>),
          blurhash: blurhashValue,
          thumbWidth,
          thumbHeight,
        },
      })
      .where(and(eq(files.id, fileId), eq(files.tenantId, tenantId)));

    // Publish file.thumbnail_ready event
    await this.eventPublisher.publish({
      tenantId,
      channel: `file:${fileId}`,
      event: REALTIME_EVENTS.FILE_THUMBNAIL_READY,
      payload: { fileId, thumbnailKey: thumbnailKeyBase },
    });

    logger.info(
      { fileId, thumbnailKey: thumbnailKeyBase, blurhash: blurhashValue },
      'Thumbnails generated',
    );
  }
}

/** Convert a web ReadableStream to a Node.js Buffer. */
async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}
