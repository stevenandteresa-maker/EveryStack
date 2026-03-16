'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { EditorContent } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useChatEditor } from './use-chat-editor';
import { ChatEditorToolbar } from './ChatEditorToolbar';
import {
  MentionDropdown,
  createMentionSuggestion,
  type MentionDropdownRef,
} from './MentionDropdown';
import { ChatAttachmentButton } from './ChatAttachmentButton';
import type { JSONContent } from '@tiptap/core';
import type { MentionSuggestion, MentionDropdownState } from './types';

interface ChatEditorProps {
  onSend: (content: JSONContent) => void;
  mentionSuggestions?: MentionSuggestion[];
  onAttach?: (files: File[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * ChatEditor — lightweight TipTap chat input with progressive disclosure.
 *
 * Three visual states:
 * - Compact: single-line, Enter to send, minimal border
 * - Focused: teal border, action icons (attach, expand, emoji)
 * - Expanded: multi-line 80–240px, Cancel/Send buttons, bubble toolbar on selection
 */
export function ChatEditor({
  onSend,
  mentionSuggestions = [],
  onAttach,
  placeholder,
  className,
}: ChatEditorProps) {
  const t = useTranslations('chatEditor');
  const containerRef = useRef<HTMLDivElement>(null);
  const mentionKeyDownRef = useRef<((event: KeyboardEvent) => boolean) | null>(
    null,
  );

  // Mention state bridged from TipTap suggestion plugin
  const [mentionState, setMentionState] =
    useState<MentionDropdownState | null>(null);

  // Keep suggestions in a ref so the TipTap suggestion config stays stable
  const suggestionsRef = useRef<MentionSuggestion[]>(mentionSuggestions);
  suggestionsRef.current = mentionSuggestions;

  // Ref for MentionDropdown imperative handle
  const mentionDropdownRef = useRef<MentionDropdownRef>(null);

  // Sync MentionDropdown's onKeyDown handler to the ref
  // This is read by the suggestion plugin's onKeyDown callback
  const updateMentionKeyDown = useCallback(() => {
    mentionKeyDownRef.current = (event: KeyboardEvent) =>
      mentionDropdownRef.current?.onKeyDown(event) ?? false;
  }, []);

  // Create stable mention suggestion config (created once, uses refs for dynamic data)
  const mentionSuggestion = useMemo(() => {
    updateMentionKeyDown();
    return createMentionSuggestion({
      suggestionsRef,
      onStateChange: setMentionState,
      keyDownRef: mentionKeyDownRef,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { editor, state, send, isEmpty } = useChatEditor({
    onSend,
    placeholder,
    onAttach,
    mentionSuggestion,
  });

  // Expand toggle handler
  const handleExpandToggle = useCallback(() => {
    if (!editor) return;
    if (state === 'expanded') {
      // Collapse: if empty → compact, else → focused
      editor.commands.focus();
    } else {
      // Force expanded state by dispatching to the keyboard handler
      editor.commands.focus();
      // Simulate Shift+Enter to expand
      const tr = editor.state.tr;
      editor.view.dispatch(tr);
    }
  }, [editor, state]);

  // Cancel handler
  const handleCancel = useCallback(() => {
    if (!editor) return;
    editor.commands.clearContent(true);
    editor.commands.blur();
  }, [editor]);

  // Drag-drop handler
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onAttach && e.dataTransfer.files.length > 0) {
        onAttach(Array.from(e.dataTransfer.files));
      }
    },
    [onAttach],
  );

  if (!editor) return null;

  const isCompact = state === 'compact';
  const isFocused = state === 'focused';
  const isExpanded = state === 'expanded';

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-lg border transition-colors',
        isCompact && 'border-border',
        (isFocused || isExpanded) &&
          'border-teal-500 ring-1 ring-teal-500/20',
        className,
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-testid="chat-editor"
      data-state={state}
    >
      {/* Editor content area */}
      <div
        className={cn(
          'overflow-y-auto px-3 py-2',
          isCompact && 'max-h-[36px]',
          isExpanded && 'min-h-[80px] max-h-[240px]',
        )}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Bubble toolbar — only in expanded mode */}
      {isExpanded && <ChatEditorToolbar editor={editor} />}

      {/* Action bar — visible in focused and expanded states */}
      {(isFocused || isExpanded) && (
        <div className="flex items-center justify-between border-t px-2 py-1">
          <div className="flex items-center gap-1">
            {onAttach && <ChatAttachmentButton onAttach={onAttach} />}
            {/* Expand/collapse toggle */}
            <button
              type="button"
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
              onClick={handleExpandToggle}
              aria-label={isExpanded ? t('collapse') : t('expand')}
              data-testid="chat-expand-toggle"
            >
              <ChevronsUpDown className="h-4 w-4" />
            </button>
          </div>

          {isExpanded ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                {t('cancel')}
              </Button>
              <Button size="sm" onClick={send} disabled={isEmpty}>
                {t('send')}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded transition-colors',
                isEmpty
                  ? 'text-muted-foreground'
                  : 'text-teal-600 hover:bg-teal-50',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
              onClick={send}
              disabled={isEmpty}
              aria-label={t('send')}
              data-testid="chat-send-button"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Mention dropdown */}
      {mentionState && (
        <MentionDropdown
          ref={mentionDropdownRef}
          items={mentionState.items}
          command={mentionState.command}
          clientRect={mentionState.clientRect}
          query={mentionState.query}
        />
      )}
    </div>
  );
}
