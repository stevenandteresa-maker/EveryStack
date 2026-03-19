'use client';

/**
 * DocumentTemplateListPage — client component for the template list.
 *
 * Grid of TemplateCards with "New Template" button and empty state.
 * Handles duplicate/delete actions with optimistic state.
 *
 * @see docs/reference/smart-docs.md § Document Generation — Two Prongs
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateCard } from './TemplateCard';
import {
  duplicateDocumentTemplate,
  deleteDocumentTemplate,
} from '@/actions/document-templates';
import type { DocumentTemplateListItem } from '@/data/document-templates';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DocumentTemplateListPageProps {
  templates: DocumentTemplateListItem[];
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentTemplateListPage({
  templates: initialTemplates,
  workspaceId,
}: DocumentTemplateListPageProps) {
  const t = useTranslations('documentTemplates');
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);

  const handleNavigate = useCallback(
    (templateId: string) => {
      router.push(`/${workspaceId}/documents/${templateId}`);
    },
    [router, workspaceId],
  );

  const handleNew = useCallback(() => {
    router.push(`/${workspaceId}/documents/new`);
  }, [router, workspaceId]);

  const handleDuplicate = useCallback(
    async (templateId: string) => {
      const result = await duplicateDocumentTemplate({ templateId });
      // Add the duplicate to the list (it will appear at top since sorted by updatedAt)
      const source = templates.find((t) => t.id === templateId);
      if (source && result) {
        const newItem: DocumentTemplateListItem = {
          ...result,
          creatorName: source.creatorName,
          tableName: source.tableName,
        };
        setTemplates((prev) => [newItem, ...prev]);
      } else {
        router.refresh();
      }
    },
    [templates, router],
  );

  const handleDelete = useCallback(
    async (templateId: string) => {
      await deleteDocumentTemplate({ templateId });
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    },
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-foreground">{t('title')}</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t('newTemplate')}
        </Button>
      </div>

      {/* Template grid or empty state */}
      {templates.length === 0 ? (
        <EmptyState onCreateClick={handleNew} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onNavigate={handleNavigate}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  const t = useTranslations('documentTemplates');

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-600">
        <FileText className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-h3 text-foreground">{t('emptyTitle')}</h2>
      <p className="mt-2 max-w-sm text-body-sm text-muted-foreground">
        {t('emptyDescription')}
      </p>
      <Button className="mt-6" onClick={onCreateClick}>
        <Plus className="mr-2 h-4 w-4" />
        {t('emptyAction')}
      </Button>
    </div>
  );
}
