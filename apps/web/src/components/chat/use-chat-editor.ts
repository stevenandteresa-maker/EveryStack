import { useState, useCallback, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { createChatEditorExtensions } from './extensions';
import type {
  ChatEditorConfig,
  ChatEditorInstance,
  ChatEditorState,
} from './types';

/**
 * Creates a keyboard handler extension for chat editor state management.
 *
 * Behavior per state:
 * - Compact/Focused: Enter sends, Shift+Enter expands
 * - Expanded: Enter inserts newline, Cmd+Enter sends, Escape collapses
 * - Arrow Up in empty editor triggers edit-last-message callback
 */
function createChatKeyboardExtension(handlers: {
  getState: () => ChatEditorState;
  onSend: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onEditLastMessage?: () => void;
}) {
  return Extension.create({
    name: 'chatKeyboard',

    addKeyboardShortcuts() {
      return {
        Enter: () => {
          const state = handlers.getState();
          if (state === 'compact' || state === 'focused') {
            handlers.onSend();
            return true;
          }
          // In expanded: Enter inserts newline (default TipTap behavior)
          return false;
        },

        'Shift-Enter': () => {
          const state = handlers.getState();
          if (state === 'compact' || state === 'focused') {
            handlers.onExpand();
            // Insert the newline after expanding
            return false;
          }
          // In expanded, Shift+Enter also just inserts newline
          return false;
        },

        'Mod-Enter': () => {
          const state = handlers.getState();
          if (state === 'expanded') {
            handlers.onSend();
            return true;
          }
          return false;
        },

        Escape: () => {
          const state = handlers.getState();
          if (state === 'expanded') {
            handlers.onCollapse();
            return true;
          }
          return false;
        },

        ArrowUp: () => {
          const state = handlers.getState();
          if (
            (state === 'focused' || state === 'compact') &&
            this.editor.isEmpty &&
            handlers.onEditLastMessage
          ) {
            handlers.onEditLastMessage();
            return true;
          }
          return false;
        },
      };
    },
  });
}

export function useChatEditor(config: ChatEditorConfig): ChatEditorInstance {
  const [state, setState] = useState<ChatEditorState>('compact');
  const stateRef = useRef<ChatEditorState>('compact');

  // Keep ref in sync for keyboard handler closure
  const updateState = useCallback((next: ChatEditorState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const handleSend = useCallback(() => {
    if (!editor) return;
    if (editor.isEmpty) return;

    const content = editor.getJSON();
    config.onSend(content);
    editor.commands.clearContent(true);
    updateState('compact');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.onSend]);

  const handleExpand = useCallback(() => {
    updateState('expanded');
  }, [updateState]);

  const handleCollapse = useCallback(() => {
    updateState(editor?.isEmpty ? 'compact' : 'focused');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateState]);

  const extensions = [
    ...createChatEditorExtensions({
      placeholder: config.placeholder,
      mentionSuggestion: config.mentionSuggestion,
    }),
    createChatKeyboardExtension({
      getState: () => stateRef.current,
      onSend: () => handleSend(),
      onExpand: handleExpand,
      onCollapse: handleCollapse,
      onEditLastMessage: config.onEditLastMessage,
    }),
  ];

  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
    },
    onFocus: () => {
      if (stateRef.current === 'compact') {
        updateState('focused');
      }
    },
    onBlur: () => {
      if (stateRef.current === 'focused' && editor?.isEmpty) {
        updateState('compact');
      }
    },
    // Detect multi-line paste → expand
    onUpdate: ({ editor: e }) => {
      if (stateRef.current !== 'expanded') {
        const content = e.getJSON();
        const blockCount = content.content?.length ?? 0;
        if (blockCount > 1) {
          updateState('expanded');
        }
      }
    },
  });

  const isEmpty = editor?.isEmpty ?? true;

  const send = useCallback(() => {
    handleSend();
  }, [handleSend]);

  return {
    editor,
    state,
    send,
    isEmpty,
  };
}
