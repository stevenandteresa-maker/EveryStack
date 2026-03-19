'use client';

/**
 * DocumentTemplateEditorPage — page-level wrapper for the template editor.
 *
 * Provides: back button, editable template name, table badge,
 * and the full DocumentTemplateEditor below.
 *
 * @see docs/reference/smart-docs.md § Template Authoring Mode
 */

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DocumentTemplateEditor } from './DocumentTemplateEditor';
import { updateDocumentTemplate } from '@/actions/document-templates';
import type { DocumentTemplateWithCreator } from '@/data/document-templates';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DocumentTemplateEditorPageProps {
  template: DocumentTemplateWithCreator;
  tableName: string;
  tenantId: string;
  userId: string;
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentTemplateEditorPage({
  template,
  tableName,
  tenantId,
  userId,
  workspaceId,
}: DocumentTemplateEditorPageProps) {
  const t = useTranslations('documentTemplates.editor');
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBack = useCallback(() => {
    router.push(`/${workspaceId}/documents`);
  }, [router, workspaceId]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setName(newName);

      // Debounce name save (1s)
      if (nameTimerRef.current) {
        clearTimeout(nameTimerRef.current);
      }
      nameTimerRef.current = setTimeout(async () => {
        if (newName.trim()) {
          await updateDocumentTemplate({
            templateId: template.id,
            name: newName.trim(),
          });
        }
      }, 1000);
    },
    [template.id],
  );

  const handleNameBlur = useCallback(() => {
    // Save immediately on blur if changed
    if (nameTimerRef.current) {
      clearTimeout(nameTimerRef.current);
      nameTimerRef.current = null;
    }
    if (name.trim() && name !== template.name) {
      updateDocumentTemplate({
        templateId: template.id,
        name: name.trim(),
      });
    }
  }, [name, template.id, template.name]);

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-1.5 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToTemplates')}
        </Button>

        <div className="h-5 w-px bg-border" />

        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          className="
            flex-1 min-w-0 bg-transparent text-[16px] font-semibold
            leading-[24px] text-foreground outline-none
            focus:ring-0 border-none p-0
          "
          aria-label={t('untitled')}
        />

        <Badge variant="default" className="text-[11px] font-normal shrink-0">
          {t('tableBadge', { name: tableName })}
        </Badge>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <DocumentTemplateEditor
          template={template}
          tenantId={tenantId}
          userId={userId}
        />
      </div>
    </div>
  );
}
