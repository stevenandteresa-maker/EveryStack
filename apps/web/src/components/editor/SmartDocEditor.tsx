'use client';

import type { ReactNode } from 'react';
import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/core';

export interface SmartDocEditorProps {
  /** TipTap editor instance from useSmartDocEditor */
  editor: Editor | null;
  /** Render slot for the toolbar (displayed above the content area) */
  renderToolbar?: (editor: Editor) => ReactNode;
  /** Render slot for the sidebar (displayed to the right of content) */
  renderSidebar?: (editor: Editor) => ReactNode;
  /** Additional className for the outer wrapper */
  className?: string;
}

/**
 * SmartDocEditor — TipTap Environment 2 wrapper component.
 *
 * Provides the layout shell with render slots for toolbar (top)
 * and sidebar (right). The content area uses Tailwind prose
 * typography for document-style rendering.
 */
export function SmartDocEditor({
  editor,
  renderToolbar,
  renderSidebar,
  className,
}: SmartDocEditorProps) {
  if (!editor) {
    return null;
  }

  const hasSidebar = !!renderSidebar;

  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      {/* Toolbar slot */}
      {renderToolbar && (
        <div className="shrink-0 border-b border-border bg-white px-4 py-2">
          {renderToolbar(editor)}
        </div>
      )}

      {/* Content + sidebar */}
      <div className={`flex flex-1 min-h-0 ${hasSidebar ? 'gap-0' : ''}`}>
        {/* Document content area */}
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-4">
          <EditorContent
            editor={editor}
            className="
              prose prose-sm max-w-none
              prose-headings:font-semibold
              prose-h1:text-[24px] prose-h1:leading-[32px] prose-h1:font-bold
              prose-h2:text-[20px] prose-h2:leading-[28px]
              prose-h3:text-[18px] prose-h3:leading-[24px]
              prose-h4:text-[16px] prose-h4:leading-[24px]
              prose-p:text-[14px] prose-p:leading-[20px]
              prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5
              prose-pre:bg-slate-900 prose-pre:text-slate-50
              prose-blockquote:border-l-[3px] prose-blockquote:border-muted-foreground/30
              prose-table:border-collapse
              prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2
              prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2
              [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]
            "
          />
        </div>

        {/* Sidebar slot */}
        {renderSidebar && (
          <div className="w-[280px] shrink-0 border-l border-border bg-muted/30 overflow-y-auto p-4">
            {renderSidebar(editor)}
          </div>
        )}
      </div>
    </div>
  );
}
