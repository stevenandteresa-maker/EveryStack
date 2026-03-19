'use client';

/**
 * GenerateDocumentButton — Record View header button for document generation.
 *
 * Hidden when no templates exist for the record's table.
 * Opens GenerateDocumentDialog on click.
 *
 * @see docs/reference/smart-docs.md § Generation Flow
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GenerateDocumentDialog } from './GenerateDocumentDialog';
import type { DocumentTemplateWithCreator } from '@/data/document-templates';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GenerateDocumentButtonProps {
  /** Templates available for the record's table */
  templates: DocumentTemplateWithCreator[];
  /** The record to generate from */
  recordId: string;
  /** Called when a document is successfully generated (refresh list) */
  onGenerated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerateDocumentButton({
  templates,
  recordId,
  onGenerated,
}: GenerateDocumentButtonProps) {
  const t = useTranslations('documentGeneration');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Hidden when no templates
  if (templates.length === 0) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setDialogOpen(true)}
        aria-label={t('buttonLabel')}
        data-testid="generate-document-button"
      >
        <FileText className="h-4 w-4" />
      </Button>

      <GenerateDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        templates={templates}
        recordId={recordId}
        onGenerated={onGenerated}
      />
    </>
  );
}
