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

export interface OutboundSyncJobData extends BaseJobData {
  recordId: string;
  tableId: string;
  baseConnectionId: string;
  changedFieldIds: string[];
  editedBy: string;
  priority: number;
}

export interface InitialSyncJobData extends SyncJobData {
  workspaceId: string;
}

export interface IncrementalSyncJobData extends SyncJobData {
  /** Job type discriminant for incremental (polling) inbound sync. */
  jobType: 'incremental';
}

export interface SyncSchedulerTickJobData extends BaseJobData {
  /** Job type discriminant for the scheduler tick. */
  jobType: 'scheduler_tick';
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
  sync: SyncJobData | InitialSyncJobData | IncrementalSyncJobData | SyncSchedulerTickJobData;
  'sync:outbound': OutboundSyncJobData;
  'file-processing': FileThumbnailJobData | FileScanJobData;
  email: EmailJobData;
  automation: AutomationJobData;
  'document-gen': DocumentGenJobData;
  cleanup: FileOrphanCleanupJobData;
}

/** Compile-time check: QueueJobDataMap must cover every QueueName. */
type _AssertCoversAllQueues = QueueJobDataMap[QueueName];
export type { _AssertCoversAllQueues as _QueueCoverageCheck };
