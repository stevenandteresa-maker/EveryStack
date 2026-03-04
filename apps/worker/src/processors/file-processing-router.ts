/**
 * FileProcessingRouter — dispatches file-processing queue jobs by name.
 *
 * A single Worker handles the file-processing queue. Job names determine
 * which processor handles the work:
 *   - file.thumbnail → FileThumbnailProcessor
 *   - file.scan      → FileScanProcessor
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { FileThumbnailJobData, FileScanJobData } from '@everystack/shared/queue';
import { BaseProcessor } from '../lib/base-processor';
import type { FileThumbnailProcessor } from './file-thumbnail';
import type { FileScanProcessor } from './file-scan';

type FileProcessingJobData = FileThumbnailJobData | FileScanJobData;

export class FileProcessingRouter extends BaseProcessor<FileProcessingJobData> {
  constructor(
    private readonly thumbnail: FileThumbnailProcessor,
    private readonly scan: FileScanProcessor,
  ) {
    super('file-processing', { concurrency: 2 });
  }

  async processJob(job: Job<FileProcessingJobData>, logger: Logger): Promise<void> {
    switch (job.name) {
      case 'file.thumbnail':
        await this.thumbnail.processJob(
          job as Job<FileThumbnailJobData>,
          logger,
        );
        break;
      case 'file.scan':
        await this.scan.processJob(job as Job<FileScanJobData>, logger);
        break;
      default:
        logger.warn({ jobName: job.name }, 'Unknown file-processing job type');
    }
  }
}
