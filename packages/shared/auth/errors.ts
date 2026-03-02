// ---------------------------------------------------------------------------
// Permission error — extends ForbiddenError from the shared error hierarchy.
// ---------------------------------------------------------------------------

import { ForbiddenError } from '../errors';

export interface PermissionDeniedDetails {
  action: string;
  resource: string;
  resourceId?: string;
  requiredRole?: string;
  [key: string]: unknown;
}

/**
 * Thrown when a user lacks the required role for an operation.
 * Extends ForbiddenError (code: PERMISSION_DENIED, statusCode: 403) and
 * carries structured details for audit logging.
 */
export class PermissionDeniedError extends ForbiddenError {
  override readonly details: PermissionDeniedDetails;

  constructor(
    message: string,
    details: PermissionDeniedDetails,
  ) {
    super(message, details as Record<string, unknown>);
    this.name = 'PermissionDeniedError';
    this.details = details;
  }
}
