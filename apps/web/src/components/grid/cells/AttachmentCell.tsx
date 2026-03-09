'use client';

/**
 * AttachmentCell — display-only component for attachment field type.
 *
 * Display: Thumbnail strip (3–4 small thumbnails for images,
 * file type icons for non-images). "+N" overflow badge.
 *
 * Edit: Placeholder — attachment manager opens in Record View (3A-ii).
 * Grid cell is display-only for attachments.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

/* eslint-disable @next/next/no-img-element */
import { useTranslations } from 'next-intl';
import { Lock, FileText, FileImage, File } from 'lucide-react';
import { OverflowBadge } from './OverflowBadge';
import type { CellRendererProps } from '../GridCell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttachmentValue {
  id: string;
  filename: string;
  mimeType?: string;
  thumbnailUrl?: string;
}

function toAttachments(value: unknown): AttachmentValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is AttachmentValue =>
      v != null && typeof v === 'object' && 'id' in v && 'filename' in v,
  );
}

function isImageMime(mime?: string): boolean {
  return !!mime && mime.startsWith('image/');
}

function getFileIcon(mime?: string) {
  if (isImageMime(mime)) return FileImage;
  if (mime?.includes('pdf') || mime?.includes('document') || mime?.includes('text')) return FileText;
  return File;
}

/** Maximum visible thumbnails */
const MAX_VISIBLE = 4;

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function AttachmentCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const attachments = toAttachments(value);

  if (attachments.length === 0) return null;

  const visible = attachments.slice(0, MAX_VISIBLE);
  const overflowCount = attachments.length - MAX_VISIBLE;
  const overflowLabels = attachments.slice(MAX_VISIBLE).map((a) => a.filename);

  return (
    <div className="flex w-full items-center gap-1 overflow-hidden">
      {visible.map((attachment) => {
        if (attachment.thumbnailUrl && isImageMime(attachment.mimeType)) {
          return (
            <span
              key={attachment.id}
              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50"
              title={attachment.filename}
            >
              <img
                src={attachment.thumbnailUrl}
                alt={attachment.filename}
                className="h-full w-full object-cover"
              />
            </span>
          );
        }

        const Icon = getFileIcon(attachment.mimeType);
        return (
          <span
            key={attachment.id}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50"
            title={attachment.filename}
          >
            <Icon className="h-4 w-4 text-slate-400" />
          </span>
        );
      })}
      {overflowCount > 0 && (
        <OverflowBadge count={overflowCount} labels={overflowLabels} />
      )}
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit (Placeholder — attachment manager deferred to 3A-ii Record View)
// ---------------------------------------------------------------------------

export function AttachmentCellEdit({ onCancel }: CellRendererProps) {
  const t = useTranslations('grid.cells');

  return (
    <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[200px] rounded-md border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm text-slate-500">{t('attachment_placeholder')}</p>
      <button
        type="button"
        className="mt-2 text-xs text-slate-400 hover:text-slate-600"
        onClick={onCancel}
      >
        {t('attachment_close')}
      </button>
    </div>
  );
}
