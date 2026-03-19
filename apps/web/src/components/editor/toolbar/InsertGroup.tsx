'use client';

import { useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { useTranslations } from 'next-intl';
import {
  Link,
  ImageIcon,
  Table,
  Code2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InsertGroupProps {
  editor: Editor;
}

export function InsertGroup({ editor }: InsertGroupProps) {
  const t = useTranslations('smartDocEditor.toolbar');

  const handleInsertLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href ?? '';
    const url = window.prompt(t('linkPrompt'), previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, t]);

  const handleInsertImage = useCallback(() => {
    const url = window.prompt(t('imagePrompt'));
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor, t]);

  const handleInsertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const handleInsertCodeBlock = useCallback(() => {
    editor.chain().focus().toggleCodeBlock().run();
  }, [editor]);

  const handleInsertCallout = useCallback(() => {
    editor.chain().focus().insertCallout().run();
  }, [editor]);

  const inserts = [
    {
      key: 'link',
      icon: Link,
      label: t('link'),
      action: handleInsertLink,
    },
    {
      key: 'image',
      icon: ImageIcon,
      label: t('image'),
      action: handleInsertImage,
    },
    {
      key: 'table',
      icon: Table,
      label: t('table'),
      action: handleInsertTable,
    },
    {
      key: 'codeBlock',
      icon: Code2,
      label: t('codeBlock'),
      action: handleInsertCodeBlock,
    },
    {
      key: 'callout',
      icon: AlertCircle,
      label: t('callout'),
      action: handleInsertCallout,
    },
  ] as const;

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t('insertGroup')}>
      {inserts.map(({ key, icon: Icon, label, action }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={action}
              aria-label={label}
              className="h-9 w-9 p-0"
            >
              <Icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
