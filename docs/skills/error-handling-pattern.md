---
name: error-handling-pattern
category: error-handling
derivedFrom:
  - doc: CLAUDE.md
    section: Error Handling — Default Patterns
    sourceHash: placeholder
  - doc: docs/reference/permissions.md
    section: Permission Denial Behavior
    sourceHash: placeholder
generatedAt: 2026-03-24T15:06:36Z
ablespecVersion: 0
---

# Error Handling Pattern

EveryStack implements consistent error handling across all surfaces with standardized error shapes, UI behaviors, and logging patterns. Domain-specific error specs override these defaults when specified.

## Convention Rules

- Server Actions MUST throw AppError (caught by global error boundary)
- Platform API endpoints MUST return { success: false, error: string } with appropriate HTTP status codes
- Portal endpoints MUST return { error: string } — never expose internal details to portal clients
- Real-time events MUST NOT send error events — failures are silent with server-side logging
- All 500 errors MUST be logged with Pino + Sentry
- All 403 errors MUST be written to audit_log with context
- Permission denials MUST return 403 for API endpoints, never 404 (except cross-tenant)
- Cross-tenant access MUST return 404 to prevent enumeration attacks
- MUST use consistent UI error patterns for each error type

## Pattern Templates

Covers Server Action Error Pattern, API Endpoint Error Pattern, UI Error Behavior Pattern, Permission Denial Pattern, Logging Pattern.

### Server Action Error Pattern
```typescript
import { AppError } from '@/lib/errors';

export async function updateRecord(recordId: string, data: UpdateData) {
  try {
    // Validation
    const validatedData = UpdateSchema.parse(data);
    
    // Permission check
    const canEdit = await checkPermission(userId, recordId, 'write');
    if (!canEdit) {
      throw new AppError('You don\'t have permission to edit this record', 403);
    }
    
    // Business logic
    const result = await db.update(records)
      .set(validatedData)
      .where(eq(records.id, recordId));
      
    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error; // Re-throw AppError for global boundary
    }
    
    // Log unexpected errors
    logger.error('Failed to update record', {
      recordId,
      error: error.message,
      traceId: getTraceId(),
    });
    
    throw new AppError('Something went wrong. Please try again.', 500);
  }
}
```

### API Endpoint Error Pattern
```typescript
// Platform API (apps/web/src/app/api/)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = CreateSchema.parse(body);
    
    const result = await createResource(validatedData);
    
    return Response.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { success: false, error: 'Invalid input data' },
        { status: 422 }
      );
    }
    
    if (error instanceof AppError) {
      return Response.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    
    logger.error('API error', { error: error.message, traceId: getTraceId() });
    
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Portal API (apps/web/src/app/portal/)
export async function POST(request: Request) {
  try {
    // Portal logic
    const result = await portalOperation();
    return Response.json(result);
  } catch (error) {
    // Never expose internal details to portal clients
    return Response.json(
      { error: 'Unable to complete request' },
      { status: 400 }
    );
  }
}
```

### UI Error Behavior Pattern
```typescript
// Error boundary for Server Actions
function GlobalErrorBoundary({ error }: { error: AppError }) {
  const errorPatterns = {
    422: () => {
      // Validation errors - inline field errors, focus first error
      showFieldErrors(error.fieldErrors);
      focusFirstError();
      // Don't clear form
    },
    403: () => {
      toast.error("You don't have permission to do that.");
      revertOptimisticUpdate();
    },
    404: () => {
      toast.error("This item is no longer available.");
      router.push('/dashboard'); // Redirect to parent context
    },
    429: () => {
      toast.error("Too many requests. Please wait a moment.");
      disableActionTemporarily(5000); // 5 second cooldown
    },
    409: () => {
      toast.error("This was modified by someone else. Please refresh.", {
        action: {
          label: "Refresh",
          onClick: () => window.location.reload(),
        },
      });
    },
    500: () => {
      toast.error("Something went wrong. Please try again.", {
        action: {
          label: "Report Issue",
          onClick: () => openSupportModal(error.traceId),
        },
      });
    },
  };
  
  const handler = errorPatterns[error.statusCode] || errorPatterns[500];
  handler();
  
  return null;
}
```

### Permission Denial Pattern
```typescript
function checkResourceAccess(userId: string, resourceId: string, tenantId: string) {
  const resource = await db.select()
    .from(resources)
    .where(
      and(
        eq(resources.id, resourceId),
        eq(resources.tenantId, tenantId) // Tenant isolation
      )
    )
    .limit(1);
    
  if (!resource) {
    // Cross-tenant or non-existent - return 404 to prevent enumeration
    throw new AppError('Resource not found', 404);
  }
  
  const hasPermission = await checkPermission(userId, resourceId);
  if (!hasPermission) {
    // Same-tenant permission denial - return 403
    await auditLog.write({
      userId,
      action: 'access_denied',
      resourceType: 'resource',
      resourceId,
      context: { attemptedAction: 'read' },
    });
    
    throw new AppError('You don\'t have permission to access this resource', 403);
  }
  
  return resource;
}
```

### Logging Pattern
```typescript
import { logger } from '@/lib/logger';
import { getTraceId } from '@/lib/tracing';

// Error logging with context
function logError(error: Error, context: Record<string, any>) {
  logger.error(error.message, {
    ...context,
    traceId: getTraceId(),
    stack: error.stack,
  });
  
  // Send to Sentry for 500 errors
  if (error instanceof AppError && error.statusCode >= 500) {
    Sentry.captureException(error, {
      tags: { traceId: getTraceId() },
      extra: context,
    });
  }
}

// Audit logging for permission denials
function logPermissionDenial(userId: string, resource: string, action: string) {
  // Rate-limited to prevent audit log flooding
  const key = `permission_denial:${userId}:${resource}:${action}`;
  const existing = await redis.get(key);
  
  if (existing) {
    // Increment count for existing entry
    await redis.incr(`${key}:count`);
  } else {
    // Create new audit entry
    await auditLog.write({
      userId,
      action: 'permission_denied',
      resourceType: resource,
      context: { attemptedAction: action },
    });
    
    await redis.setex(key, 300, '1'); // 5-minute deduplication window
  }
}
```

## Validation Criteria

- All Server Actions throw AppError instances with appropriate status codes
- API endpoints return consistent error shapes based on surface type
- Portal endpoints never expose internal error details
- Permission denials return 403 for same-tenant, 404 for cross-tenant access
- All 500 errors are logged with Pino and sent to Sentry
- Permission denials are written to audit_log with deduplication
- UI error patterns match the specified behavior for each error type
- Real-time failures are silent to clients with server-side logging
- Error messages are user-friendly and never expose stack traces