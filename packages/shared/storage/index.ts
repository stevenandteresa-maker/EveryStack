export type {
  HeadObjectResult,
  PresignOptions,
  PresignResult,
  StorageClient,
} from './client';
export type { StorageConfig } from './config';
export { getStorageConfig, resetStorageConfig } from './config';
export { R2StorageClient } from './r2-client';
export {
  docGenOutputKey,
  fileOriginalKey,
  fileThumbnailKey,
  portalAssetKey,
  quarantineKey,
  templateKey,
} from './keys';

// MIME type validation
export { ALLOWED_MIME_TYPES, THUMBNAIL_MIME_TYPES, isAllowedMimeType, isAllowedExtension } from './mime';

// Magic byte verification
export { MAGIC_SIGNATURES, verifyMagicBytes } from './magic-bytes';
export type { MagicByteResult } from './magic-bytes';

// Filename & SVG sanitization
export { sanitizeFilename, sanitizeSvg } from './sanitize';

// Per-plan file size limits
export { FILE_LIMITS, getFileLimits } from './limits';
export type { PlanFileLimits } from './limits';
