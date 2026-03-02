// ---------------------------------------------------------------------------
// Permission error matching the AppError interface from CLAUDE.md.
// ---------------------------------------------------------------------------

export interface PermissionDeniedDetails {
  action: string;
  resource: string;
  resourceId?: string;
  requiredRole?: string;
}

/**
 * Thrown when a user lacks the required role for an operation.
 * Matches the AppError shape (code + message + details) and carries
 * structured details for audit logging.
 */
export class PermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED' as const;
  readonly httpStatus = 403;
  readonly details: PermissionDeniedDetails;

  constructor(
    message: string,
    details: PermissionDeniedDetails,
  ) {
    super(message);
    this.name = 'PermissionDeniedError';
    this.details = details;
  }
}
