import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth-context';
import {
  getDbForTenant,
  generateUUIDv7,
  files,
  tenants,
  eq,
  and,
  isNull,
} from '@everystack/shared/db';
import { sum } from 'drizzle-orm';
import {
  isAllowedMimeType,
  isAllowedExtension,
  sanitizeFilename,
  getFileLimits,
  fileOriginalKey,
  R2StorageClient,
  getStorageConfig,
} from '@everystack/shared/storage';
import { webLogger } from '@everystack/shared/logging';

const CONTEXT_TYPES = [
  'record_attachment',
  'smart_doc',
  'doc_gen_output',
  'portal_asset',
  'email_attachment',
  'chat_attachment',
  'template',
] as const;

const PresignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
  contextType: z.enum(CONTEXT_TYPES),
  contextId: z.string().uuid().optional(),
});

/** Presigned URL expiration: 1 hour. */
const PRESIGN_EXPIRES_SECONDS = 3600;

export async function POST(request: Request) {
  let authCtx;
  try {
    authCtx = await getAuthContext();
  } catch {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = PresignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Invalid request body', details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { filename, mimeType, sizeBytes, contextType, contextId } = parsed.data;

  // Validate MIME type against allowlist
  if (!isAllowedMimeType(mimeType)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'File type not allowed', details: { mimeType } } },
      { status: 422 },
    );
  }

  // Validate extension matches MIME type
  if (!isAllowedExtension(mimeType, filename)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'File extension does not match MIME type', details: { mimeType, filename } } },
      { status: 422 },
    );
  }

  // Fetch tenant plan to determine limits
  const db = getDbForTenant(authCtx.tenantId, 'read');
  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, authCtx.tenantId));

  if (!tenant) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
      { status: 404 },
    );
  }

  const limits = getFileLimits(tenant.plan);

  // Check file size against plan limit
  if (sizeBytes > limits.maxFileBytes) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'File exceeds maximum size for your plan',
          details: { maxBytes: limits.maxFileBytes, requestedBytes: sizeBytes },
        },
      },
      { status: 422 },
    );
  }

  // Check storage quota
  const [quotaResult] = await db
    .select({ totalBytes: sum(files.sizeBytes) })
    .from(files)
    .where(and(eq(files.tenantId, authCtx.tenantId), isNull(files.archivedAt)));

  const currentUsage = Number(quotaResult?.totalBytes ?? 0);
  if (currentUsage + sizeBytes > limits.totalStorageBytes) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Storage quota exceeded',
          details: { currentBytes: currentUsage, limitBytes: limits.totalStorageBytes },
        },
      },
      { status: 422 },
    );
  }

  // Sanitize filename
  const safeName = sanitizeFilename(filename);

  // Generate file ID and storage key
  const fileId = generateUUIDv7();
  const storageKey = fileOriginalKey(authCtx.tenantId, fileId, safeName);

  // Create storage client and generate presigned URL
  const config = getStorageConfig();
  const storage = new R2StorageClient(config);

  const presignResult = await storage.presignPut(storageKey, {
    contentType: mimeType,
    contentLength: sizeBytes,
    expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
  });

  // Create files row with scan_status: pending
  const writeDb = getDbForTenant(authCtx.tenantId, 'write');
  await writeDb.insert(files).values({
    id: fileId,
    tenantId: authCtx.tenantId,
    uploadedBy: authCtx.userId,
    storageKey,
    originalFilename: safeName,
    mimeType,
    sizeBytes,
    scanStatus: 'pending',
    contextType,
    contextId: contextId ?? null,
  });

  webLogger.info(
    { fileId, tenantId: authCtx.tenantId, mimeType, sizeBytes },
    'Presigned upload URL generated',
  );

  return NextResponse.json({
    fileId,
    presignedUrl: presignResult.url,
    headers: presignResult.headers,
    expiresAt: new Date(Date.now() + PRESIGN_EXPIRES_SECONDS * 1000).toISOString(),
  });
}
