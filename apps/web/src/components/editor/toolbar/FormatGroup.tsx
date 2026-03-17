'use client';

import type { Editor } from '@tiptap/core';
import { useTranslations } from 'next-intl';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FormatGroupProps {
  editor: Editor;
}

export function FormatGroup({ editor }: FormatGroupProps) {
  const t = useTranslations('smartDocEditor.toolbar');

  const formats = [
    {
      key: 'bold',
      icon: Bold,
      label: t('bold'),
      shortcut: '⌘B',
      isActive: () => editor.isActive('bold'),
      toggle: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      icon: Italic,
      label: t('italic'),
      shortcut: '⌘I',
      isActive: () => editor.isActive('italic'),
      toggle: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'underline',
      icon: Underline,
      label: t('underline'),
      shortcut: '⌘U',
      isActive: () => editor.isActive('underline'),
      toggle: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: 'strike',
      icon: Strikethrough,
      label: t('strikethrough'),
      shortcut: '⌘⇧X',
      isActive: () => editor.isActive('strike'),
      toggle: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      key: 'code',
      icon: Code,
      label: t('code'),
      shortcut: '⌘E',
      isActive: () => editor.isActive('code'),
      toggle: () => editor.chain().focus().toggleCode().run(),
    },
    {
      key: 'highlight',
      icon: Highlighter,
      label: t('highlight'),
      shortcut: '⌘⇧H',
      isActive: () => editor.isActive('highlight'),
      toggle: () => editor.chain().focus().toggleHighlight().run(),
    },
  ] as const;

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t('formatGroup')}>
      {formats.map(({ key, icon: Icon, label, shortcut, isActive, toggle }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={isActive()}
              onPressedChange={() => toggle()}
              aria-label={label}
            >
              <Icon className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {label} <kbd className="ml-1 text-xs text-muted-foreground">{shortcut}</kbd>
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
