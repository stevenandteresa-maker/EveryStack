import type { QueueName } from './constants';

/**
 * Base shape for all job data. Every job must carry tenant context and
 * trace propagation fields so the worker can continue the caller's trace.
 */
export interface BaseJobData {
  tenantId: string;
  traceId: string;
  triggeredBy: string;
}

// ---------------------------------------------------------------------------
// File processing jobs
// ---------------------------------------------------------------------------

export interface FileThumbnailJobData extends BaseJobData {
  fileId: string;
  mimeType: string;
}

export interface FileScanJobData extends BaseJobData {
  fileId: string;
  storageKey: string;
}

export interface FileOrphanCleanupJobData extends BaseJobData {
  olderThanMs: number;
  batchSize: number;
}

// ---------------------------------------------------------------------------
// Domain job placeholders — extended in later phases
// ---------------------------------------------------------------------------

export interface SyncJobData extends BaseJobData {
  connectionId: string;
}

export interface EmailJobData extends BaseJobData {
  to: string;
  templateId: string;
}

export interface AutomationJobData extends BaseJobData {
  automationId: string;
  runId: string;
}

export interface DocumentGenJobData extends BaseJobData {
  templateId: string;
  recordId: string;
}

// ---------------------------------------------------------------------------
// Queue → JobData mapping
// ---------------------------------------------------------------------------

/**
 * Maps each queue name to its expected job data type.
 * Used for type-safe queue/worker generics.
 */
export interface QueueJobDataMap {
  sync: SyncJobData;
  'file-processing': FileThumbnailJobData | FileScanJobData;
  email: EmailJobData;
  automation: AutomationJobData;
  'document-gen': DocumentGenJobData;
  cleanup: FileOrphanCleanupJobData;
}

/** Compile-time check: QueueJobDataMap must cover every QueueName. */
type _AssertCoversAllQueues = QueueJobDataMap[QueueName];
export type { _AssertCoversAllQueues as _QueueCoverageCheck };
