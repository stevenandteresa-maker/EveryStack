'use client';

import type { Editor } from '@tiptap/core';
import { useTranslations } from 'next-intl';
import { Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HistoryGroupProps {
  editor: Editor;
}

export function HistoryGroup({ editor }: HistoryGroupProps) {
  const t = useTranslations('smartDocEditor.toolbar');

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t('historyGroup')}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            aria-label={t('undo')}
            className="h-9 w-9 p-0"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {t('undo')} <kbd className="ml-1 text-xs text-muted-foreground">{t('undoShortcut')}</kbd>
          </p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            aria-label={t('redo')}
            className="h-9 w-9 p-0"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {t('redo')} <kbd className="ml-1 text-xs text-muted-foreground">{t('redoShortcut')}</kbd>
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
