import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import {
  getDbForTenant,
  files,
  eq,
  and,
} from '@everystack/shared/db';
import {
  R2StorageClient,
  getStorageConfig,
  verifyMagicBytes,
  sanitizeSvg,
  THUMBNAIL_MIME_TYPES,
} from '@everystack/shared/storage';
import { webLogger, getTraceId } from '@everystack/shared/logging';
import { getQueue } from '@/lib/queue';
import type { FileScanJobData, FileThumbnailJobData } from '@everystack/shared/queue';

/** How many bytes to read for magic byte verification. */
const MAGIC_BYTE_READ_SIZE = 8192;

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  let authCtx;
  try {
    authCtx = await getAuthContext();
  } catch {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  const { fileId } = await params;

  // Look up the file row — must belong to this tenant
  const db = getDbForTenant(authCtx.tenantId, 'read');
  const [fileRow] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.tenantId, authCtx.tenantId)));

  if (!fileRow) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'File not found' } },
      { status: 404 },
    );
  }

  // HEAD object in storage — confirm exists and size matches
  const config = getStorageConfig();
  const storage = new R2StorageClient(config);

  const headResult = await storage.headObject(fileRow.storageKey);
  if (!headResult) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'File not found in storage' } },
      { status: 404 },
    );
  }

  if (headResult.size !== fileRow.sizeBytes) {
    webLogger.warn(
      { fileId, expected: fileRow.sizeBytes, actual: headResult.size },
      'Upload size mismatch',
    );
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Uploaded file size does not match' } },
      { status: 422 },
    );
  }

  // Read first 8KB for magic byte verification
  const stream = await storage.getStream(fileRow.storageKey);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalRead = 0;

  try {
    while (totalRead < MAGIC_BYTE_READ_SIZE) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalRead += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  const buffer = mergeChunks(chunks, totalRead);

  // Verify magic bytes match claimed MIME type
  const verification = verifyMagicBytes(buffer, fileRow.mimeType);
  if (!verification.valid) {
    webLogger.warn(
      { fileId, claimedMime: fileRow.mimeType, detectedMime: verification.detectedMime },
      'Magic byte mismatch — deleting file',
    );

    // Delete storage object + file row
    await storage.delete(fileRow.storageKey);
    const writeDb = getDbForTenant(authCtx.tenantId, 'write');
    await writeDb.delete(files).where(eq(files.id, fileId));

    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'File content does not match claimed type',
          details: { claimedMime: fileRow.mimeType, detectedMime: verification.detectedMime },
        },
      },
      { status: 422 },
    );
  }

  // SVG sanitization: sanitize content and replace in storage
  if (fileRow.mimeType === 'image/svg+xml') {
    const fullStream = await storage.getStream(fileRow.storageKey);
    const fullChunks: Uint8Array[] = [];
    const fullReader = fullStream.getReader();
    try {
      for (;;) {
        const { done, value } = await fullReader.read();
        if (done || !value) break;
        fullChunks.push(value);
      }
    } finally {
      fullReader.cancel().catch(() => {});
    }

    const fullBuffer = new Uint8Array(fullChunks.reduce((acc, c) => acc + c.byteLength, 0));
    let offset = 0;
    for (const chunk of fullChunks) {
      fullBuffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const originalSvg = new TextDecoder().decode(fullBuffer);
    const sanitizedSvg = sanitizeSvg(originalSvg);

    if (sanitizedSvg !== originalSvg) {
      const sanitizedBytes = new TextEncoder().encode(sanitizedSvg);
      const presign = await storage.presignPut(fileRow.storageKey, {
        contentType: 'image/svg+xml',
        contentLength: sanitizedBytes.byteLength,
      });

      await fetch(presign.url, {
        method: 'PUT',
        headers: presign.headers,
        body: sanitizedBytes,
      });

      webLogger.info({ fileId }, 'SVG sanitized and re-uploaded');
    }
  }

  // Update files row
  const writeDb = getDbForTenant(authCtx.tenantId, 'write');
  await writeDb
    .update(files)
    .set({ scanStatus: 'pending' })
    .where(eq(files.id, fileId));

  // Enqueue file.scan job
  const traceId = getTraceId() ?? fileId;
  const fileProcessingQueue = getQueue('file-processing');

  await fileProcessingQueue.add('file.scan', {
    fileId,
    storageKey: fileRow.storageKey,
    tenantId: authCtx.tenantId,
    traceId,
    triggeredBy: authCtx.userId,
  } satisfies FileScanJobData);

  // If image, enqueue file.thumbnail job
  if (THUMBNAIL_MIME_TYPES.has(fileRow.mimeType)) {
    await fileProcessingQueue.add('file.thumbnail', {
      fileId,
      mimeType: fileRow.mimeType,
      tenantId: authCtx.tenantId,
      traceId,
      triggeredBy: authCtx.userId,
    } satisfies FileThumbnailJobData);
  }

  webLogger.info(
    { fileId, tenantId: authCtx.tenantId, mimeType: fileRow.mimeType },
    'Upload completion verified',
  );

  return NextResponse.json({
    id: fileRow.id,
    filename: fileRow.originalFilename,
    mimeType: fileRow.mimeType,
    sizeBytes: fileRow.sizeBytes,
    contextType: fileRow.contextType,
    contextId: fileRow.contextId,
    scanStatus: 'pending',
    createdAt: fileRow.createdAt.toISOString(),
  });
}

/** Merge multiple Uint8Array chunks into a single buffer. */
function mergeChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    const toCopy = Math.min(chunk.byteLength, totalLength - offset);
    result.set(chunk.subarray(0, toCopy), offset);
    offset += toCopy;
  }
  return result;
}
