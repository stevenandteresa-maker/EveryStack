'use client';

import type { Editor } from '@tiptap/core';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { FormatGroup } from './FormatGroup';
import { AlignGroup } from './AlignGroup';
import { InsertGroup } from './InsertGroup';
import { HistoryGroup } from './HistoryGroup';

interface EditorToolbarProps {
  editor: Editor;
}

/**
 * EditorToolbar — fixed top toolbar for Smart Doc Editor (TipTap Env 2).
 *
 * Four groups separated by vertical dividers:
 * 1. Format (bold, italic, underline, strike, code, highlight)
 * 2. Align (left, center, right, justify)
 * 3. Insert (link, image, table, code block, callout)
 * 4. History (undo, redo)
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="flex items-center gap-1 flex-wrap"
        role="toolbar"
        aria-label="Editor toolbar"
      >
        <FormatGroup editor={editor} />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <AlignGroup editor={editor} />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <InsertGroup editor={editor} />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <HistoryGroup editor={editor} />
      </div>
    </TooltipProvider>
  );
}
