/**
 * Document generation processor — converts pre-rendered HTML to PDF,
 * uploads to R2, and records the output in the database.
 *
 * The server action handles merge-tag resolution and HTML rendering
 * (since those depend on web-app data access functions). This processor
 * receives the ready HTML and handles:
 *   1. HTML → PDF via Gotenberg Chromium endpoint
 *   2. Upload PDF to R2 at t/{tenantId}/doc-gen/{docId}/output.pdf
 *   3. Create generated_documents row with presigned file URL
 *
 * Retry: 3 attempts with exponential backoff (5s base) — configured at enqueue time.
 *
 * @see docs/reference/smart-docs.md § Generation Flow
 * @see docs/reference/smart-docs.md § Rendering Pipelines
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { DocumentGenJobData } from '@everystack/shared/queue';
import type { StorageClient } from '@everystack/shared/storage';
import { docGenOutputKey } from '@everystack/shared/storage';
import { GotenbergClient } from '@everystack/shared/pdf';
import {
  getDbForTenant,
  generatedDocuments,
  generateUUIDv7,
} from '@everystack/shared/db';
import { BaseProcessor } from '../../lib/base-processor';

export class DocumentGenerationProcessor extends BaseProcessor<DocumentGenJobData> {
  static readonly JOB_NAME = 'document.generate' as const;
  static readonly RETRY_ATTEMPTS = 3;
  static readonly BACKOFF_BASE_MS = 5_000;

  private readonly gotenberg: GotenbergClient;

  constructor(
    private readonly storage: StorageClient,
    gotenberg?: GotenbergClient,
  ) {
    super('document-gen');
    this.gotenberg = gotenberg ?? new GotenbergClient();
  }

  async processJob(job: Job<DocumentGenJobData>, logger: Logger): Promise<void> {
    const { tenantId, templateId, recordId, triggeredBy, html, landscape } = job.data;

    // 1. Convert HTML → PDF via Gotenberg
    logger.info({ templateId, recordId }, 'Converting HTML to PDF via Gotenberg');
    const pdfBuffer = await this.gotenberg.convertHTMLToPDF(html, {
      printBackground: true,
      landscape,
    });

    // 2. Upload to R2
    const docId = generateUUIDv7();
    const storageKey = docGenOutputKey(tenantId, docId, 'pdf');
    logger.info({ storageKey, size: pdfBuffer.length }, 'Uploading PDF to storage');
    await this.storage.put(storageKey, pdfBuffer, 'application/pdf');

    // Generate a presigned URL for the file (7-day expiry)
    const fileUrl = await this.storage.presignGet(storageKey, 7 * 24 * 60 * 60);

    // 3. Create generated_documents row
    const writeDb = getDbForTenant(tenantId, 'write');
    await writeDb.insert(generatedDocuments).values({
      id: docId,
      tenantId,
      templateId,
      sourceRecordId: recordId,
      fileUrl,
      fileType: 'pdf',
      generatedBy: triggeredBy !== 'automation' ? triggeredBy : null,
    });

    logger.info(
      { docId, templateId, recordId, storageKey },
      'Document generated successfully',
    );
  }
}
