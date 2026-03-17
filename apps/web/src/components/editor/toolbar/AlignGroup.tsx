'use client';

import type { Editor } from '@tiptap/core';
import { useTranslations } from 'next-intl';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AlignGroupProps {
  editor: Editor;
}

export function AlignGroup({ editor }: AlignGroupProps) {
  const t = useTranslations('smartDocEditor.toolbar');

  const alignments = [
    {
      key: 'left',
      icon: AlignLeft,
      label: t('alignLeft'),
      value: 'left' as const,
    },
    {
      key: 'center',
      icon: AlignCenter,
      label: t('alignCenter'),
      value: 'center' as const,
    },
    {
      key: 'right',
      icon: AlignRight,
      label: t('alignRight'),
      value: 'right' as const,
    },
    {
      key: 'justify',
      icon: AlignJustify,
      label: t('alignJustify'),
      value: 'justify' as const,
    },
  ] as const;

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t('alignGroup')}>
      {alignments.map(({ key, icon: Icon, label, value }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive({ textAlign: value })}
              onPressedChange={() =>
                editor.chain().focus().setTextAlign(value).run()
              }
              aria-label={label}
            >
              <Icon className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
