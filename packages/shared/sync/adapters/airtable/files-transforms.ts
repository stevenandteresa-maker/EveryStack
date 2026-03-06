// ---------------------------------------------------------------------------
// Airtable Files Category Transforms (Category 8)
//
// Transforms for: files
// Airtable type: multipleAttachments
//
// Airtable attachments include a platform-specific ID and thumbnail variants.
// source_refs.airtable stores the Airtable attachment ID for each file
// (partial lossless — thumbnail URLs may differ on round-trip).
// ---------------------------------------------------------------------------

import type {
  FieldTransform,
  PlatformFieldConfig,
  CanonicalValue,
  FileObject,
} from '../../types';

/**
 * Shape of an individual Airtable attachment object from the API.
 */
interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  thumbnails?: {
    small?: { url: string };
    large?: { url: string };
    full?: { url: string };
  };
}

/**
 * Extract the best available thumbnail URL from Airtable's thumbnail variants.
 * Prefers large → full → small.
 */
function extractThumbnailUrl(
  thumbnails: AirtableAttachment['thumbnails'],
): string | null {
  if (!thumbnails) return null;
  return thumbnails.large?.url ?? thumbnails.full?.url ?? thumbnails.small?.url ?? null;
}

/** multipleAttachments → files (partial lossless with source_refs) */
export const airtableFilesTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null || !Array.isArray(value)) {
      return { type: 'files', value: [] };
    }

    const files: FileObject[] = value.map((attachment: unknown) => {
      const att = attachment as AirtableAttachment;
      return {
        url: att.url ?? '',
        filename: att.filename ?? '',
        file_type: att.type ?? '',
        size: typeof att.size === 'number' ? att.size : 0,
        thumbnail_url: extractThumbnailUrl(att.thumbnails),
        source_refs: att.id ? { airtable: att.id } : undefined,
      };
    });

    return { type: 'files', value: files };
  },

  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'files') return null;
    if (!canonical.value || canonical.value.length === 0) return [];

    // Airtable accepts [{url, filename}] for write-back.
    // The attachment ID and thumbnails are platform-managed — we only send what Airtable accepts.
    return canonical.value.map((file) => ({
      url: file.url,
      filename: file.filename,
    }));
  },

  isLossless: false,
  supportedOperations: ['read', 'write'],
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const AIRTABLE_FILES_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'multipleAttachments', transform: airtableFilesTransform },
];
