# EveryStack — File & Asset Management

> **Reference doc.** Schema, upload flow, storage client, serving strategy, security, processing pipeline, limits, and lifecycle for all platform file types.
> See `GLOSSARY.md` for concept definitions and MVP scope.
> Cross-references: `data-model.md` (files table schema), `smart-docs.md` (TipTap image uploads), `email.md` (email attachments), `communications.md` (chat attachments)
> Last updated: 2026-02-27 — Aligned with GLOSSARY.md. Removed personal notes file capture (post-MVP). Removed document-intelligence references (post-MVP). Preserved full upload pipeline, security, and serving strategy.

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                        | Lines   | Covers                                                                                           |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------ |
| File Types Across the Platform | 29–42   | Context types: record_attachment, smart_doc, doc_gen_output, portal_asset, email/chat attachment |
| Data Model                     | 44–68   | files table DDL, columns, indexes, tenant isolation                                              |
| Storage Client                 | 70–129  | Provider abstraction (S3/GCS/R2), storage key hierarchy, signed URL generation                   |
| Upload Flow                    | 131–171 | Standard upload (≤100MB), multipart upload (>100MB, Business+), presigned URL pattern            |
| Content-Type Security          | 173–218 | MIME validation, extension allowlist, magic byte verification, executable blocking               |
| Image Processing Pipeline      | 220–247 | Thumbnail generation, resize variants, Sharp integration, format conversion                      |
| Virus Scanning                 | 249–266 | ClamAV integration, quarantine flow, async scan pattern                                          |
| Serving Strategy               | 268–302 | Public files (CDN), authenticated files (signed URLs), thumbnail serving                         |
| File Size Limits               | 304–316 | Per-plan limits: Free/Starter/Business/Enterprise tiers                                          |
| Orphan Cleanup                 | 318–329 | Scheduled job to remove unreferenced files, grace period                                         |
| Audit & Access Logging         | 331–342 | File access audit trail, download tracking                                                       |
| Phase Implementation           | 344–352 | Phase breakdown: MVP — Foundation through Post-MVP                                               |

---

## File Types Across the Platform

| Feature                    | Files Involved                           | Context Type               |
| -------------------------- | ---------------------------------------- | -------------------------- |
| File attachment field type | User-uploaded files attached to records  | `record_attachment`        |
| Smart Doc images/embeds    | Images and media within TipTap documents | `smart_doc`                |
| Doc gen output             | Generated DOCX/PDF documents             | `doc_gen_output`           |
| Portal assets              | Logos, hero images, favicons             | `portal_asset`             |
| User avatars               | Profile images (managed by Clerk)        | N/A (not in `files` table) |
| Email attachments          | Files sent via CRM email                 | `email_attachment`         |
| Chat attachments           | Images/files shared in threads           | `chat_attachment`          |
| Template files             | DOCX templates for doc gen               | `template`                 |

---

## Data Model

### `files` Table

| Column              | Type                   | Purpose                                                                  |
| ------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `id`                | UUID                   | Primary key                                                              |
| `tenant_id`         | UUID                   | Tenant scope                                                             |
| `uploaded_by`       | UUID                   | User who uploaded                                                        |
| `storage_key`       | VARCHAR                | Object key in R2/S3                                                      |
| `original_filename` | VARCHAR(255)           | Sanitized user-facing name                                               |
| `mime_type`         | VARCHAR(127)           | Verified MIME type                                                       |
| `size_bytes`        | BIGINT                 | File size                                                                |
| `checksum_sha256`   | VARCHAR(64)            | Integrity verification                                                   |
| `scan_status`       | VARCHAR                | `pending`, `clean`, `infected`, `skipped`                                |
| `context_type`      | VARCHAR                | See File Types table                                                     |
| `context_id`        | UUID (nullable)        | Parent record/doc/portal/thread                                          |
| `thumbnail_key`     | VARCHAR (nullable)     | Thumbnail storage key                                                    |
| `metadata`          | JSONB                  | Dimensions (images), page count (PDFs), duration (audio/video), blurhash |
| `created_at`        | TIMESTAMPTZ            |                                                                          |
| `deleted_at`        | TIMESTAMPTZ (nullable) | Soft delete                                                              |

**Indexes:** `(tenant_id, context_type, context_id)` for fetching files per entity. `(tenant_id, scan_status)` for processing queue. `(deleted_at)` partial index for orphan cleanup.

---

## Storage Client

Covers Provider Abstraction, Storage Key Hierarchy.

### Provider Abstraction

```typescript
interface StorageClient {
  presignPut(
    key: string,
    options: PresignOptions,
  ): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  headObject(key: string): Promise<{ size: number; contentType: string } | null>;
  getStream(key: string): Promise<ReadableStream>;
}
```

**Implementation:** `R2StorageClient` wraps `@aws-sdk/client-s3` (R2 is S3-compatible). Feature code imports `StorageClient` from shared package, never `@aws-sdk` directly.

**Configuration:**

```typescript
export const storageConfig = {
  bucket: env.STORAGE_BUCKET,
  region: env.STORAGE_REGION, // 'auto' for R2
  endpoint: env.STORAGE_ENDPOINT, // R2 endpoint
  publicUrl: env.STORAGE_PUBLIC_URL, // CDN URL prefix
};
```

### Storage Key Hierarchy

```
t/{tenantId}/
  files/
    {fileId}/
      original/{sanitizedFilename}     ← Original upload
      thumb/200.webp                    ← Thumbnail (200px)
      thumb/800.webp                    ← Preview (800px)
  portal-assets/
    {portalId}/
      logo.{ext}
      favicon.{ext}
      hero/{assetId}.{ext}
  doc-gen/
    {docId}/
      output.{ext}                     ← Generated DOCX/PDF
  templates/
    {templateId}/
      template.docx
  quarantine/
    {fileId}/{sanitizedFilename}        ← Moved if infected
```

**Tenant isolation enforced by key prefix.** Presigned URL generation validates tenant ownership before signing.

---

## Upload Flow

Covers Standard Upload (≤ 100MB), Multipart Upload (> 100MB, Business+).

### Standard Upload (≤ 100MB)

```
Client selects file(s)
  → POST /api/upload/presign
    Body: { filename, mimeType, sizeBytes, contextType, contextId }
    Server validates:
      1. Authenticated (Clerk session)
      2. Tenant ID from session
      3. MIME type in allowlist
      4. Size ≤ plan limit
      5. Storage quota not exceeded
      6. Filename sanitized
    Creates `files` row (scan_status='pending'), generates storage_key
    Returns: { fileId, presignedUrl, headers, expiresAt }
  → Client uploads directly to R2/S3 via presigned PUT
  → POST /api/upload/complete/{fileId}
    Server validates:
      1. File belongs to tenant
      2. HEAD confirms exists + size matches
      3. Magic byte verification
    Updates files row, enqueues: file.scan, file.thumbnail
    Returns file metadata
```

### Multipart Upload (> 100MB, Business+)

S3 multipart via presigned parts (10MB chunks). Supports retry per part.

```
POST /api/upload/multipart/start → uploadId
POST /api/upload/multipart/presign-part → presigned URL per part
Client uploads parts individually
POST /api/upload/multipart/complete → standard completion flow
```

---

## Content-Type Security

**Five-layer defense:**

1. **MIME allowlist at presign time:**

```typescript
const ALLOWED_MIME_TYPES = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],

  // Documents
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],

  // Audio/Video (Business+ only)
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],

  // Archives (scanned aggressively)
  'application/zip': ['.zip'],
};
```

2. **Magic byte verification at completion.** Worker reads first 8KB, verifies magic bytes match claimed MIME. Mismatch → rejected, row deleted, user notified.

3. **SVG sanitization.** Parsed and stripped of `<script>`, `<foreignObject>`, event handlers before storage.

4. **Content-Disposition on download.** `attachment; filename="{sanitized}"` forces download, prevents XSS via uploaded HTML/SVG.

5. **Separate CDN domain.** User content served from `files.everystack.com`, never main app domain. Prevents cookie theft.

---

## Image Processing Pipeline

**Library: `sharp`** (worker service).

### Thumbnail Generation

BullMQ job `file.thumbnail` after upload:

| Output           | Max Dimension | Format | Quality | Purpose               |
| ---------------- | ------------- | ------ | ------- | --------------------- |
| `thumb/200.webp` | 200px         | WebP   | 80      | Grid cell, file list  |
| `thumb/800.webp` | 800px         | WebP   | 85      | Lightbox, record view |

**Process:**

1. Download original via stream
2. EXIF orientation detect, auto-rotate
3. Resize (`fit: 'inside'`)
4. Convert to WebP
5. Generate blurhash (10-char, stored in `metadata.blurhash`)
6. Upload thumbnails
7. Update `files.thumbnail_key` and `metadata`

**PDF thumbnails:** First page via Gotenberg → PNG → sharp pipeline.

**Timeout:** 60s per file. >50MP images skipped with warning.

---

## Virus Scanning

All user-uploaded files scanned before serving.

**Implementation:** ClamAV sidecar container (or R2 built-in scanning in production).

| Result     | Behavior                                                         |
| ---------- | ---------------------------------------------------------------- |
| `clean`    | Served normally                                                  |
| `infected` | Moved to `quarantine/`. User notified. Audit log. Never served.  |
| `skipped`  | Scanning unavailable — warning badge. Admin alerted.             |
| `pending`  | Processing indicator. **Download blocked** until scan completes. |

**Timing:** <30s for files under 50MB. Signature DB updated daily.

**Dev mode:** ClamAV optional. `scan_status` defaults to `skipped`. Docker Compose optional profile.

---

## Serving Strategy

Covers Public Files (Portal Assets, Public Doc Gen), Authenticated Files (Attachments, Smart Doc Images, Chat), Thumbnails.

### Public Files (Portal Assets, Public Doc Gen)

CDN with long TTL:

```
URL: https://files.everystack.com/t/{tenantId}/portal-assets/{portalId}/logo.png
Cache-Control: public, max-age=31536000, immutable
```

Content-addressed via `checksum_sha256` — new version = new file ID, no cache invalidation.

### Authenticated Files (Attachments, Smart Doc Images, Chat)

Short-lived presigned GET URLs (15-minute expiry):

```typescript
async function getFileDownloadUrl(fileId: string): Promise<string> {
  const file = await getFile(tenantId, fileId);
  if (file.scanStatus === 'pending') throw new ForbiddenError('Being scanned');
  if (file.scanStatus === 'infected') throw new ForbiddenError('Quarantined');
  return storageClient.presignGet(file.storageKey, 900);
}
```

No CDN caching of authenticated content.

### Thumbnails

CDN for all contexts. `Cache-Control: public, max-age=86400` (1 day).

---

## File Size Limits

| Plan         | Max File | Total Storage | Multipart |
| ------------ | -------- | ------------- | --------- |
| Freelancer   | 25 MB    | 5 GB          | No        |
| Starter      | 50 MB    | 25 GB         | No        |
| Professional | 100 MB   | 100 GB        | No        |
| Business     | 250 MB   | 500 GB        | Yes       |
| Enterprise   | 500 MB   | 1 TB          | Yes       |

**Enforcement:** Checked at presign AND verified at completion. Quota = `SUM(size_bytes) WHERE tenant_id = $1 AND deleted_at IS NULL`.

---

## Orphan Cleanup

Files orphaned when parent deleted. **Strategy:** Soft delete on parent cascade. Daily BullMQ `file.orphan_cleanup` for files with `deleted_at` > 30 days:

1. Delete original + thumbnails from storage
2. Hard-delete `files` row

**Template files and portal assets:** Never auto-deleted on unpublish. Only on tenant deletion or explicit admin action.

**Tenant deletion cascade:** All files queued for permanent deletion in batches of 100.

---

## Audit & Access Logging

| Action                     | Audit Entry                                      |
| -------------------------- | ------------------------------------------------ |
| Uploaded                   | `file.uploaded` with ID, filename, size, context |
| Downloaded (URL generated) | `file.accessed` with ID and user                 |
| Deleted                    | `file.deleted` with ID                           |
| Quarantined                | `file.quarantined` with scan result              |

Download logging is lightweight — signed URL generation logs access, not actual download.

---

## Phase Implementation

| Phase                         | File Work                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MVP — Foundation (MVP)**    | `files` table. `StorageClient` + R2 implementation. Presigned upload endpoints. Docker Compose with MinIO. MIME allowlist. Basic upload manager. |
| **MVP — Core UX**             | File attachment field rendering. Smart Doc image upload. Thumbnail pipeline (sharp + Gotenberg). Signed URL serving.                             |
| **Post-MVP — Portals & Apps** | Portal asset management. Doc gen output storage. CDN serving.                                                                                    |
| **Post-MVP — Documents**      | Template file upload. Multipart upload (Business+).                                                                                              |
| **Post-MVP — Comms & Polish** | Chat/email attachments. ClamAV integration. Full orphan cleanup. SVG sanitization. Separate CDN domain.                                          |
