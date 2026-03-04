/**
 * FileScanProcessor — scans uploaded files for viruses via ClamAV daemon.
 *
 * Dev mode (NODE_ENV !== 'production'): if ClamAV is unavailable, sets scan_status to 'skipped'.
 * Production: downloads file stream → pipes to ClamAV daemon (TCP INSTREAM command).
 *
 * Results:
 *   - clean    → scan_status = 'clean'
 *   - infected → quarantine flow (copy to quarantine key, delete original, audit log, event)
 *   - error    → scan_status = 'skipped' with error log
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { FileScanJobData } from '@everystack/shared/queue';
import type { StorageClient } from '@everystack/shared/storage';
import type { EventPublisher } from '@everystack/shared/realtime';
import { quarantineKey } from '@everystack/shared/storage';
import { getDbForTenant, files, eq, and } from '@everystack/shared/db';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import { FILE_AUDIT_ACTIONS, writeFileAuditLog } from '@everystack/shared/storage';
import { BaseProcessor } from '../lib/base-processor';
import { scanBuffer } from '../lib/clamav-client';

export class FileScanProcessor extends BaseProcessor<FileScanJobData> {
  static readonly JOB_NAME = 'file.scan' as const;

  constructor(
    private readonly storage: StorageClient,
    private readonly eventPublisher: EventPublisher,
  ) {
    super('file-processing');
  }

  async processJob(job: Job<FileScanJobData>, logger: Logger): Promise<void> {
    const { fileId, tenantId, storageKey } = job.data;

    // Look up file to get current filename
    const readDb = getDbForTenant(tenantId, 'read');
    const [file] = await readDb
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.tenantId, tenantId)));

    if (!file) {
      logger.warn({ fileId }, 'File not found, skipping scan');
      return;
    }

    // Download file for scanning
    let buffer: Buffer;
    try {
      const stream = await this.storage.getStream(storageKey);
      buffer = await streamToBuffer(stream);
    } catch (err) {
      logger.error(
        { fileId, err: err instanceof Error ? err.message : String(err) },
        'Failed to download file for scanning',
      );
      await this.updateScanStatus(tenantId, fileId, 'skipped');
      return;
    }

    // Scan via ClamAV
    try {
      const result = await scanBuffer(buffer);

      if (result.isInfected) {
        logger.warn(
          { fileId, virusName: result.virusName },
          'Infected file detected, quarantining',
        );
        await this.quarantineFile(tenantId, fileId, file.originalFilename, storageKey, buffer, logger);
      } else {
        await this.updateScanStatus(tenantId, fileId, 'clean');
        logger.info({ fileId }, 'File scan clean');
      }

      // Publish scan complete event
      await this.eventPublisher.publish({
        tenantId,
        channel: `file:${fileId}`,
        event: REALTIME_EVENTS.FILE_SCAN_COMPLETE,
        payload: {
          fileId,
          scanStatus: result.isInfected ? 'infected' : 'clean',
        },
      });
    } catch (err) {
      const isDevMode = process.env['NODE_ENV'] !== 'production';
      const errMessage = err instanceof Error ? err.message : String(err);
      const isConnectionRefused =
        errMessage.includes('ECONNREFUSED') || errMessage.includes('connect');

      if (isConnectionRefused && isDevMode) {
        logger.warn(
          { fileId },
          'ClamAV unavailable in dev mode, setting scan_status to skipped',
        );
      } else if (isConnectionRefused) {
        logger.error(
          { fileId, err: errMessage },
          'ClamAV connection refused, setting scan_status to skipped',
        );
      } else {
        logger.error(
          { fileId, err: errMessage },
          'ClamAV scan error, setting scan_status to skipped',
        );
      }

      await this.updateScanStatus(tenantId, fileId, 'skipped');
    }
  }

  private async updateScanStatus(
    tenantId: string,
    fileId: string,
    scanStatus: string,
  ): Promise<void> {
    const writeDb = getDbForTenant(tenantId, 'write');
    await writeDb
      .update(files)
      .set({ scanStatus })
      .where(and(eq(files.id, fileId), eq(files.tenantId, tenantId)));
  }

  private async quarantineFile(
    tenantId: string,
    fileId: string,
    originalFilename: string,
    storageKey: string,
    buffer: Buffer,
    logger: Logger,
  ): Promise<void> {
    // Copy to quarantine location
    const qKey = quarantineKey(tenantId, fileId, originalFilename);
    await this.storage.put(qKey, buffer, 'application/octet-stream');

    // Delete original
    await this.storage.delete(storageKey);

    // Update DB: new storage key, scan status, metadata
    const writeDb = getDbForTenant(tenantId, 'write');
    await writeDb
      .update(files)
      .set({
        storageKey: qKey,
        scanStatus: 'infected',
      })
      .where(and(eq(files.id, fileId), eq(files.tenantId, tenantId)));

    // Audit log
    await writeFileAuditLog({
      action: FILE_AUDIT_ACTIONS.QUARANTINED,
      fileId,
      tenantId,
      details: { originalKey: storageKey, quarantineKey: qKey },
      timestamp: new Date(),
    });

    logger.info(
      { fileId, quarantineKey: qKey },
      'File quarantined',
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
