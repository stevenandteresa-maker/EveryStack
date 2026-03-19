'use client';

/**
 * GeneratedDocumentList — displays generated PDFs for a record.
 *
 * Shows template name, generation date, generator name, and download link.
 * Empty state when no documents exist.
 *
 * @see docs/reference/smart-docs.md § Document Generation — Two Prongs
 */

import { useTranslations } from 'next-intl';
import { FileText, Download, FileX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedDocumentItem {
  id: string;
  templateName: string;
  fileUrl: string | null;
  fileType: string;
  generatedBy: string;
  generatorName: string;
  generatedAt: Date | string;
  aiDrafted: boolean;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GeneratedDocumentListProps {
  documents: GeneratedDocumentItem[];
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeneratedDocumentList({
  documents,
  isLoading = false,
}: GeneratedDocumentListProps) {
  const t = useTranslations('documentGeneration');

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <FileX className="h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-[13px] font-medium text-muted-foreground">
          {t('noDocuments')}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground/70">
          {t('noDocumentsHint')}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-80">
      <div className="space-y-1 p-4">
        {documents.map((doc) => {
          const date = new Date(doc.generatedAt);
          const formattedDate = date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const formattedTime = date.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-teal-50 text-teal-600">
                <FileText className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-[18px] text-foreground truncate">
                  {doc.templateName}
                  {doc.aiDrafted && (
                    <span className="ml-1.5 text-[10px] text-teal-600 font-normal">
                      AI
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground leading-[14px]">
                  {formattedDate} {formattedTime}
                  {' · '}
                  {doc.generatorName}
                </p>
              </div>

              {doc.fileUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  asChild
                >
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('download')}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
