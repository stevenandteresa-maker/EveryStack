/**
 * FileOrphanCleanupProcessor — permanently deletes files soft-deleted over 30 days ago.
 *
 * Runs as a system-level job across all tenants on the cleanup queue.
 * For each expired file: deletes original + thumbnails from storage, hard-deletes DB row.
 * Scheduled daily at 3 AM via BullMQ job scheduler.
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { FileOrphanCleanupJobData } from '@everystack/shared/queue';
import type { StorageClient } from '@everystack/shared/storage';
import { fileThumbnailKey } from '@everystack/shared/storage';
import { db, files, eq, and, isNotNull, sql } from '@everystack/shared/db';
import type { FileRecord } from '@everystack/shared/db';
import { BaseProcessor } from '../lib/base-processor';

const THUMB_SIZES = [200, 800];

export class FileOrphanCleanupProcessor extends BaseProcessor<FileOrphanCleanupJobData> {
  static readonly JOB_NAME = 'file.orphan_cleanup' as const;

  constructor(private readonly storage: StorageClient) {
    super('cleanup');
  }

  async processJob(job: Job<FileOrphanCleanupJobData>, logger: Logger): Promise<void> {
    const { olderThanMs, batchSize } = job.data;
    const cutoffDate = new Date(Date.now() - olderThanMs);

    // System-level query across all tenants — uses admin db client
    const expiredFiles: FileRecord[] = await db
      .select()
      .from(files)
      .where(
        and(
          isNotNull(files.archivedAt),
          sql`${files.archivedAt} < ${cutoffDate.toISOString()}`,
        ),
      )
      .limit(batchSize);

    if (expiredFiles.length === 0) {
      logger.info('No orphaned files to clean up');
      return;
    }

    logger.info(
      { count: expiredFiles.length, cutoffDate: cutoffDate.toISOString() },
      'Starting orphan cleanup',
    );

    let deletedCount = 0;
    for (const file of expiredFiles) {
      try {
        // Collect all storage keys to delete (original + thumbnails)
        const keysToDelete = [file.storageKey];

        if (file.thumbnailKey) {
          for (const size of THUMB_SIZES) {
            keysToDelete.push(
              fileThumbnailKey(file.tenantId, file.id, size),
            );
          }
        }

        // Delete from object storage
        await this.storage.deleteMany(keysToDelete);

        // Hard-delete DB row
        await db.delete(files).where(eq(files.id, file.id));

        deletedCount++;
        logger.info(
          { fileId: file.id, sizeBytes: file.sizeBytes },
          'Orphaned file permanently deleted',
        );
      } catch (err) {
        logger.error(
          { fileId: file.id, err: err instanceof Error ? err.message : String(err) },
          'Failed to delete orphaned file',
        );
      }
    }

    logger.info(
      { deletedCount, totalFound: expiredFiles.length },
      'Orphan cleanup completed',
    );
  }
}
