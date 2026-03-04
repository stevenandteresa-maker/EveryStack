/**
 * File audit action constants and types.
 *
 * Wire to writeAuditLog() when available (Phase 1I).
 */

export const FILE_AUDIT_ACTIONS = {
  UPLOADED: 'file.uploaded',
  ACCESSED: 'file.accessed',
  DELETED: 'file.deleted',
  QUARANTINED: 'file.quarantined',
} as const;

export type FileAuditAction =
  (typeof FILE_AUDIT_ACTIONS)[keyof typeof FILE_AUDIT_ACTIONS];

export interface FileAuditEntry {
  action: FileAuditAction;
  fileId: string;
  tenantId: string;
  userId?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Write a file audit log entry.
 * Stub — wired to writeAuditLog() in Phase 1I.
 */
export async function writeFileAuditLog(_entry: FileAuditEntry): Promise<void> {
  // TODO [Phase 1I]: Wire to writeAuditLog()
}
