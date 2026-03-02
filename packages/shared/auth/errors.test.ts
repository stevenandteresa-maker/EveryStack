import { describe, it, expect } from 'vitest';
import { PermissionDeniedError } from './errors';
import { AppError, ForbiddenError } from '../errors';

describe('PermissionDeniedError', () => {
  it('extends Error', () => {
    const err = new PermissionDeniedError('Forbidden', {
      action: 'edit',
      resource: 'record',
    });
    expect(err).toBeInstanceOf(Error);
  });

  it('extends ForbiddenError and AppError', () => {
    const err = new PermissionDeniedError('Forbidden', {
      action: 'edit',
      resource: 'record',
    });
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err).toBeInstanceOf(AppError);
  });

  it('has code PERMISSION_DENIED', () => {
    const err = new PermissionDeniedError('Forbidden', {
      action: 'delete',
      resource: 'table',
    });
    expect(err.code).toBe('PERMISSION_DENIED');
  });

  it('has statusCode 403', () => {
    const err = new PermissionDeniedError('Forbidden', {
      action: 'read',
      resource: 'workspace',
    });
    expect(err.statusCode).toBe(403);
  });

  it('sets name to PermissionDeniedError', () => {
    const err = new PermissionDeniedError('Nope', {
      action: 'create',
      resource: 'field',
    });
    expect(err.name).toBe('PermissionDeniedError');
  });

  it('carries message', () => {
    const err = new PermissionDeniedError('Custom message', {
      action: 'manage',
      resource: 'automation',
    });
    expect(err.message).toBe('Custom message');
  });

  it('carries structured details', () => {
    const err = new PermissionDeniedError('Forbidden', {
      action: 'edit',
      resource: 'record',
      resourceId: 'rec-123',
      requiredRole: 'manager',
    });
    expect(err.details).toEqual({
      action: 'edit',
      resource: 'record',
      resourceId: 'rec-123',
      requiredRole: 'manager',
    });
  });

  it('details without optional fields', () => {
    const err = new PermissionDeniedError('Forbidden', {
      action: 'read',
      resource: 'view',
    });
    expect(err.details.resourceId).toBeUndefined();
    expect(err.details.requiredRole).toBeUndefined();
  });
});
