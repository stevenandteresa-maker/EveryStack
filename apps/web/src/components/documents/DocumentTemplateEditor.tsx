'use client';

/**
 * DocumentTemplateEditor — full-featured template editing interface.
 *
 * Layout: Top toolbar (EditorToolbar + PreviewToggle) with auto-save indicator.
 * Left 70%: SmartDocEditor. Right 30%: MergeTagInserter sidebar.
 * Auto-saves with 3s debounce, showing "Saving..." → "Saved" indicator.
 *
 * @see docs/reference/smart-docs.md § Template Authoring Mode
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { JSONContent } from '@tiptap/core';
import { SmartDocEditor } from '@/components/editor/SmartDocEditor';
import { useSmartDocEditor } from '@/components/editor/use-smart-doc-editor';
import { EditorToolbar } from '@/components/editor/toolbar/EditorToolbar';
import {
  PreviewToggle,
  usePreviewToggle,
} from '@/components/editor/toolbar/PreviewToggle';
import { MergeTagInserter } from '@/components/editor/sidebar/MergeTagInserter';
import { useMergeTagFields } from '@/components/editor/hooks/use-merge-tag-fields';
import { updateDocumentTemplate } from '@/actions/document-templates';
import type { DocumentTemplateWithCreator } from '@/data/document-templates';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_SAVE_DELAY_MS = 3000;

// ---------------------------------------------------------------------------
// Save status type
// ---------------------------------------------------------------------------

type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DocumentTemplateEditorProps {
  template: DocumentTemplateWithCreator;
  tenantId: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentTemplateEditor({
  template,
  tenantId,
  userId,
}: DocumentTemplateEditorProps) {
  const t = useTranslations('documentTemplates.editor');

  // -------------------------------------------------------------------------
  // Auto-save state
  // -------------------------------------------------------------------------

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<JSONContent | null>(null);
  const isSavingRef = useRef(false);

  const doSave = useCallback(
    async (content: JSONContent) => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      setSaveStatus('saving');

      try {
        await updateDocumentTemplate({
          templateId: template.id,
          content: content as Record<string, unknown>,
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      } finally {
        isSavingRef.current = false;
      }
    },
    [template.id],
  );

  const scheduleSave = useCallback(
    (content: JSONContent) => {
      latestContentRef.current = content;
      setSaveStatus('unsaved');

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        if (latestContentRef.current) {
          doSave(latestContentRef.current);
        }
      }, AUTO_SAVE_DELAY_MS);
    },
    [doSave],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // TipTap editor
  // -------------------------------------------------------------------------

  const { editor } = useSmartDocEditor({
    content: template.content as JSONContent | undefined,
    onUpdate: scheduleSave,
    placeholder: t('untitled'),
  });

  // -------------------------------------------------------------------------
  // Preview toggle
  // -------------------------------------------------------------------------

  const { mode, setMode, isResolving } = usePreviewToggle({
    editor,
    tenantId,
  });

  // -------------------------------------------------------------------------
  // Merge-tag fields
  // -------------------------------------------------------------------------

  const { groups, isLoading: fieldsLoading } = useMergeTagFields({
    tenantId,
    tableId: template.tableId,
    userId,
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <SmartDocEditor
      editor={editor}
      className="h-full"
      renderToolbar={(ed) => (
        <div className="flex items-center justify-between gap-4">
          <EditorToolbar editor={ed} />
          <div className="flex items-center gap-3">
            <SaveStatusIndicator status={saveStatus} />
            <PreviewToggle
              editor={ed}
              mode={mode}
              onModeChange={setMode}
              isResolving={isResolving}
            />
          </div>
        </div>
      )}
      renderSidebar={(ed) => (
        <MergeTagInserter
          editor={ed}
          groups={groups}
          isLoading={fieldsLoading}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// SaveStatusIndicator
// ---------------------------------------------------------------------------

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  const t = useTranslations('documentTemplates.editor');

  if (status === 'idle') return null;

  const labelMap: Record<Exclude<SaveStatus, 'idle'>, string> = {
    saving: t('saving'),
    saved: t('saved'),
    unsaved: t('unsaved'),
  };

  const colorMap: Record<Exclude<SaveStatus, 'idle'>, string> = {
    saving: 'text-muted-foreground',
    saved: 'text-emerald-600',
    unsaved: 'text-amber-600',
  };

  return (
    <span className={`text-[12px] leading-[16px] ${colorMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}
