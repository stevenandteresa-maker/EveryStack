'use client';

/**
 * PreviewToggle — Edit / Preview / Raw mode switcher for the Smart Doc editor.
 *
 * - Edit: Normal TipTap editing with merge-tag pills.
 * - Preview: Merge tags resolved with sample data, read-only.
 * - Raw: Merge tags shown as {field_name} text, read-only.
 *
 * @see docs/reference/smart-docs.md § Preview toggle
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Eye, Code2 } from 'lucide-react';
import type { Editor, JSONContent } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreviewMode = 'edit' | 'preview' | 'raw';

export interface PreviewToggleProps {
  /** TipTap editor instance */
  editor: Editor;
  /** Current mode */
  mode: PreviewMode;
  /** Mode change handler */
  onModeChange: (mode: PreviewMode) => void;
  /** Whether preview resolution is in progress */
  isResolving?: boolean;
}

export interface UsePreviewToggleOptions {
  /** TipTap editor instance */
  editor: Editor | null;
  /** Tenant ID for merge-tag resolution */
  tenantId: string;
  /** Record ID for sample data resolution */
  recordId?: string;
  /** Resolver function — resolves merge tags to sample data */
  resolveMergeTags?: (
    content: JSONContent,
    recordId: string,
    tenantId: string,
  ) => Promise<JSONContent>;
}

export interface UsePreviewToggleResult {
  mode: PreviewMode;
  setMode: (mode: PreviewMode) => void;
  isResolving: boolean;
}

// ---------------------------------------------------------------------------
// Hook — manages mode transitions and content swapping
// ---------------------------------------------------------------------------

/**
 * usePreviewToggle — manages Edit / Preview / Raw mode transitions.
 *
 * Stores the edit-mode content before switching to preview or raw,
 * and restores it when returning to edit mode.
 */
export function usePreviewToggle(
  options: UsePreviewToggleOptions,
): UsePreviewToggleResult {
  const { editor, tenantId, recordId, resolveMergeTags: resolverFn } = options;

  const [mode, setModeState] = useState<PreviewMode>('edit');
  const [isResolving, setIsResolving] = useState(false);

  // Store the original edit-mode content so we can restore it
  const editContentRef = useRef<JSONContent | null>(null);

  const setMode = useCallback(
    async (newMode: PreviewMode) => {
      if (!editor || newMode === mode) return;

      // Save current edit content when leaving edit mode
      if (mode === 'edit') {
        editContentRef.current = editor.getJSON();
      }

      if (newMode === 'edit') {
        // Restore original edit content
        if (editContentRef.current) {
          editor.commands.setContent(editContentRef.current);
        }
        editor.setEditable(true);
        setModeState('edit');
        return;
      }

      if (newMode === 'preview') {
        const sourceContent = editContentRef.current ?? editor.getJSON();

        if (resolverFn && recordId) {
          setIsResolving(true);
          try {
            const resolved = await resolverFn(sourceContent, recordId, tenantId);
            editor.commands.setContent(resolved);
          } catch {
            // On failure, show original content as fallback
            editor.commands.setContent(sourceContent);
          } finally {
            setIsResolving(false);
          }
        }

        editor.setEditable(false);
        setModeState('preview');
        return;
      }

      if (newMode === 'raw') {
        // Convert merge-tag nodes to {field_name} text
        const sourceContent = editContentRef.current ?? editor.getJSON();
        const rawContent = convertToRaw(sourceContent);
        editor.commands.setContent(rawContent);
        editor.setEditable(false);
        setModeState('raw');
      }
    },
    [editor, mode, tenantId, recordId, resolverFn],
  );

  // Ensure editor is editable when mode is edit
  useEffect(() => {
    if (editor && mode === 'edit') {
      editor.setEditable(true);
    }
  }, [editor, mode]);

  return { mode, setMode, isResolving };
}

// ---------------------------------------------------------------------------
// Raw mode conversion — replaces mergeTag nodes with {field_name} text
// ---------------------------------------------------------------------------

function convertToRaw(content: JSONContent): JSONContent {
  const cloned = JSON.parse(JSON.stringify(content)) as JSONContent;
  walkAndConvert(cloned);
  return cloned;
}

function walkAndConvert(node: JSONContent): void {
  if (node.content) {
    for (let i = 0; i < node.content.length; i++) {
      const child = node.content[i]!;

      if (child.type === 'mergeTag' && child.attrs) {
        // Replace with text node showing {field_name}
        node.content[i] = {
          type: 'text',
          text: `{${child.attrs.fallback || 'field'}}`,
        };
      } else {
        walkAndConvert(child);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// UI Component
// ---------------------------------------------------------------------------

const MODE_CONFIG: Array<{
  mode: PreviewMode;
  icon: typeof Pencil;
  labelKey: string;
}> = [
  { mode: 'edit', icon: Pencil, labelKey: 'edit' },
  { mode: 'preview', icon: Eye, labelKey: 'preview' },
  { mode: 'raw', icon: Code2, labelKey: 'raw' },
];

export function PreviewToggle({
  editor: _editor,
  mode,
  onModeChange,
  isResolving = false,
}: PreviewToggleProps) {
  const t = useTranslations('smartDocEditor.previewToggle');

  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5"
      role="radiogroup"
      aria-label={t('label')}
    >
      {MODE_CONFIG.map(({ mode: modeValue, icon: Icon, labelKey }) => {
        const isActive = mode === modeValue;
        const isDisabled = isResolving && modeValue !== mode;

        return (
          <button
            key={modeValue}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={isDisabled}
            onClick={() => onModeChange(modeValue)}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium
              transition-colors
              ${isActive
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
