'use client';

/**
 * GenerateDocumentDialog — modal for selecting a template and generating a PDF.
 *
 * Shows available templates for the record's table. User selects one,
 * clicks "Generate PDF", then sees progress via useDocumentGeneration.
 * On completion: download link. On failure: error + retry.
 *
 * @see docs/reference/smart-docs.md § Generation Flow
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FileText,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  generateDocument,
  getGeneratedDocumentUrl,
} from '@/actions/document-generation';
import { useDocumentGeneration } from './use-document-generation';
import type { DocumentTemplateWithCreator } from '@/data/document-templates';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GenerateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: DocumentTemplateWithCreator[];
  recordId: string;
  /** Called when a document is successfully generated */
  onGenerated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerateDocumentDialog({
  open,
  onOpenChange,
  templates,
  recordId,
  onGenerated,
}: GenerateDocumentDialogProps) {
  const t = useTranslations('documentGeneration');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const { status, isPolling, startPolling, reset } = useDocumentGeneration();

  const isGenerating = isPolling || status?.status === 'active' || status?.status === 'waiting';
  const isCompleted = status?.status === 'completed';
  const isFailed = status?.status === 'failed';

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplateId) return;

    setDownloadUrl(null);
    try {
      const result = await generateDocument({
        templateId: selectedTemplateId,
        recordId,
      });
      startPolling(result.jobId);
    } catch {
      // Error is handled by the status display
    }
  }, [selectedTemplateId, recordId, startPolling]);

  // When completed, fetch the download URL
  const handleDownload = useCallback(async () => {
    if (!status?.result?.docId) return;

    try {
      const result = await getGeneratedDocumentUrl({
        documentId: status.result.docId,
      });
      if (result.fileUrl) {
        setDownloadUrl(result.fileUrl);
        window.open(result.fileUrl, '_blank');
      }
    } catch {
      // Silently fail — user can retry
    }
  }, [status]);

  const handleClose = useCallback(() => {
    if (!isGenerating) {
      reset();
      setSelectedTemplateId(null);
      setDownloadUrl(null);
      if (isCompleted) {
        onGenerated?.();
      }
      onOpenChange(false);
    }
  }, [isGenerating, isCompleted, reset, onGenerated, onOpenChange]);

  const handleRetry = useCallback(() => {
    reset();
    setDownloadUrl(null);
  }, [reset]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {/* Template selection — shown when not generating */}
        {!isGenerating && !isCompleted && !isFailed && (
          <ScrollArea className="max-h-64 -mx-6 px-6">
            <div className="space-y-1">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={cn(
                    'flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left transition-colors',
                    selectedTemplateId === template.id
                      ? 'bg-teal-50 ring-1 ring-teal-200'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-[18px] text-foreground truncate">
                      {template.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-[14px]">
                      {t('version', { version: String(template.version) })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Progress state */}
        {isGenerating && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <p className="text-[13px] text-muted-foreground">
              {t('generating')}
            </p>
          </div>
        )}

        {/* Success state */}
        {isCompleted && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <p className="text-[13px] font-medium text-foreground">
              {t('completed')}
            </p>
            {status?.result?.docId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {t('download')}
              </Button>
            )}
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-teal-600 hover:underline"
              >
                {t('openInNewTab')}
              </a>
            )}
          </div>
        )}

        {/* Error state */}
        {isFailed && (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-[13px] font-medium text-destructive">
              {t('failed')}
            </p>
            <p className="text-[12px] text-muted-foreground text-center max-w-xs">
              {status?.error ?? t('unknownError')}
            </p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              {t('retry')}
            </Button>
          </div>
        )}

        <DialogFooter>
          {!isGenerating && !isCompleted && !isFailed && (
            <Button
              onClick={handleGenerate}
              disabled={!selectedTemplateId}
            >
              <FileText className="mr-2 h-4 w-4" />
              {t('generatePdf')}
            </Button>
          )}
          {(isCompleted || isFailed) && (
            <Button variant="outline" onClick={handleClose}>
              {t('close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
