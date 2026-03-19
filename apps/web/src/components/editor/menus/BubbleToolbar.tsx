'use client';

import { useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import { useTranslations } from 'next-intl';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  Link,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { TooltipProvider } from '@/components/ui/tooltip';

interface BubbleToolbarProps {
  editor: Editor;
}

/**
 * BubbleToolbar — floating toolbar shown on text selection.
 *
 * Provides inline formatting controls via TipTap's BubbleMenu.
 * Only visible when text is selected (not on node selections like images).
 */
export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  const t = useTranslations('smartDocEditor.toolbar');

  const handleToggleLink = useCallback(() => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt(t('linkPrompt'));
    if (!url) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, t]);

  const formats = [
    {
      key: 'bold',
      icon: Bold,
      label: t('bold'),
      isActive: () => editor.isActive('bold'),
      toggle: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      icon: Italic,
      label: t('italic'),
      isActive: () => editor.isActive('italic'),
      toggle: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'underline',
      icon: Underline,
      label: t('underline'),
      isActive: () => editor.isActive('underline'),
      toggle: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: 'strike',
      icon: Strikethrough,
      label: t('strikethrough'),
      isActive: () => editor.isActive('strike'),
      toggle: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      key: 'code',
      icon: Code,
      label: t('code'),
      isActive: () => editor.isActive('code'),
      toggle: () => editor.chain().focus().toggleCode().run(),
    },
    {
      key: 'highlight',
      icon: Highlighter,
      label: t('highlight'),
      isActive: () => editor.isActive('highlight'),
      toggle: () => editor.chain().focus().toggleHighlight().run(),
    },
    {
      key: 'link',
      icon: Link,
      label: t('link'),
      isActive: () => editor.isActive('link'),
      toggle: handleToggleLink,
    },
  ] as const;

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
      }}
      shouldShow={({ editor: e, state }: { editor: Editor; state: EditorState }) => {
        // Only show for text selections, not node selections (images, etc.)
        const { from, to } = state.selection;
        if (from === to) return false;
        // Don't show in code blocks
        if (e.isActive('codeBlock')) return false;
        return true;
      }}
    >
      <TooltipProvider delayDuration={300}>
        <div
          className="flex items-center gap-0.5 rounded-lg border border-border bg-background px-1 py-1 shadow-md"
          role="toolbar"
          aria-label={t('bubbleToolbar')}
        >
          {formats.map(({ key, icon: Icon, label, isActive, toggle }) => (
            <Toggle
              key={key}
              size="sm"
              pressed={isActive()}
              onPressedChange={() => toggle()}
              aria-label={label}
              className="h-8 w-8 p-0"
            >
              <Icon className="h-3.5 w-3.5" />
            </Toggle>
          ))}
        </div>
      </TooltipProvider>
    </BubbleMenu>
  );
}
