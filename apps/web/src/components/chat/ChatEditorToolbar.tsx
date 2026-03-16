'use client';

import { useCallback } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import {
  Bold,
  Italic,
  Underline,
  Link as LinkIcon,
  List,
  ListOrdered,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatEditorToolbarProps {
  editor: Editor;
}

interface ToolbarAction {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  isActive: () => boolean;
  toggle: () => void;
}

/**
 * ChatEditorToolbar — bubble toolbar on text selection in expanded mode.
 *
 * Six items: B | I | U | Link | Bullets | Numbers.
 * Floats above the selected text using TipTap's BubbleMenu.
 */
export function ChatEditorToolbar({ editor }: ChatEditorToolbarProps) {
  const t = useTranslations('chatEditor.toolbar');

  const handleLink = useCallback(() => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt(t('linkPrompt'));
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor, t]);

  const actions: ToolbarAction[] = [
    {
      key: 'bold',
      icon: Bold,
      labelKey: 'bold',
      isActive: () => editor.isActive('bold'),
      toggle: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      icon: Italic,
      labelKey: 'italic',
      isActive: () => editor.isActive('italic'),
      toggle: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'underline',
      icon: Underline,
      labelKey: 'underline',
      isActive: () => editor.isActive('underline'),
      toggle: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: 'link',
      icon: LinkIcon,
      labelKey: 'link',
      isActive: () => editor.isActive('link'),
      toggle: handleLink,
    },
    {
      key: 'bulletList',
      icon: List,
      labelKey: 'bulletList',
      isActive: () => editor.isActive('bulletList'),
      toggle: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: 'orderedList',
      icon: ListOrdered,
      labelKey: 'orderedList',
      isActive: () => editor.isActive('orderedList'),
      toggle: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
      }}
    >
      <div
        className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
        data-testid="chat-editor-toolbar"
        role="toolbar"
        aria-label={t('label')}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                action.isActive() && 'bg-accent text-accent-foreground',
              )}
              onClick={action.toggle}
              aria-label={t(action.labelKey)}
              aria-pressed={action.isActive()}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    </BubbleMenu>
  );
}
