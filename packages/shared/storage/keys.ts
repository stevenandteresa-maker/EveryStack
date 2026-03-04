/**
 * Storage key utilities — generates object storage keys with tenant isolation.
 *
 * ALL keys enforce the t/{tenantId}/ prefix to guarantee tenant data isolation
 * at the storage layer. Presigned URL generation validates tenant ownership
 * before signing.
 *
 * Key hierarchy:
 *   t/{tenantId}/files/{fileId}/original/{filename}
 *   t/{tenantId}/files/{fileId}/thumb/{size}.webp
 *   t/{tenantId}/portal-assets/{portalId}/{assetType}.{ext}
 *   t/{tenantId}/doc-gen/{docId}/output.{ext}
 *   t/{tenantId}/templates/{templateId}/template.docx
 *   t/{tenantId}/quarantine/{fileId}/{filename}
 */

/**
 * Key for the original uploaded file.
 * Path: t/{tenantId}/files/{fileId}/original/{filename}
 */
export function fileOriginalKey(
  tenantId: string,
  fileId: string,
  filename: string,
): string {
  return `t/${tenantId}/files/${fileId}/original/${sanitizeFilename(filename)}`;
}

/**
 * Key for a generated thumbnail.
 * Path: t/{tenantId}/files/{fileId}/thumb/{size}.webp
 */
export function fileThumbnailKey(
  tenantId: string,
  fileId: string,
  size: number,
): string {
  return `t/${tenantId}/files/${fileId}/thumb/${size}.webp`;
}

/**
 * Key for portal branding assets (logo, favicon, hero images).
 * Path: t/{tenantId}/portal-assets/{portalId}/{assetName}
 */
export function portalAssetKey(
  tenantId: string,
  portalId: string,
  assetName: string,
): string {
  return `t/${tenantId}/portal-assets/${portalId}/${sanitizeFilename(assetName)}`;
}

/**
 * Key for document generation output (PDF/DOCX).
 * Path: t/{tenantId}/doc-gen/{docId}/output.{ext}
 */
export function docGenOutputKey(
  tenantId: string,
  docId: string,
  ext: string,
): string {
  return `t/${tenantId}/doc-gen/${docId}/output.${ext}`;
}

/**
 * Key for document template source files.
 * Path: t/{tenantId}/templates/{templateId}/template.docx
 */
export function templateKey(
  tenantId: string,
  templateId: string,
): string {
  return `t/${tenantId}/templates/${templateId}/template.docx`;
}

/**
 * Key for quarantined files (moved here if malware scan fails).
 * Path: t/{tenantId}/quarantine/{fileId}/{filename}
 */
export function quarantineKey(
  tenantId: string,
  fileId: string,
  filename: string,
): string {
  return `t/${tenantId}/quarantine/${fileId}/${sanitizeFilename(filename)}`;
}

/**
 * Sanitize a filename for use in storage keys.
 * Removes path traversal attempts and replaces unsafe characters.
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.-]/g, '_');
}
