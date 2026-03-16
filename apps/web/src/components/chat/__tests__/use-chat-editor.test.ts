// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { useChatEditor } from '../use-chat-editor';
import type { ChatEditorConfig } from '../types';

/** Emit focus/blur on a TipTap editor in tests (transaction not needed for state callbacks) */
function emitFocus(editor: Editor) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (editor as any).emit('focus', { editor, event: new FocusEvent('focus') });
}
function emitBlur(editor: Editor) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (editor as any).emit('blur', { editor, event: new FocusEvent('blur') });
}

function createConfig(
  overrides?: Partial<ChatEditorConfig>
): ChatEditorConfig {
  return {
    onSend: vi.fn(),
    ...overrides,
  };
}

describe('useChatEditor', () => {
  describe('initialization', () => {
    it('starts in compact state', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      expect(result.current.state).toBe('compact');
    });

    it('creates an editor instance', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      expect(result.current.editor).not.toBeNull();
    });

    it('reports isEmpty as true initially', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      expect(result.current.isEmpty).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('transitions from compact to focused on editor focus', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      const editor = result.current.editor!;

      // TipTap onFocus callback triggers state change
      act(() => {
        emitFocus(editor);
      });

      expect(result.current.state).toBe('focused');
    });

    it('transitions from focused to compact on blur when empty', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      const editor = result.current.editor!;

      act(() => {
        emitFocus(editor);
      });
      expect(result.current.state).toBe('focused');

      act(() => {
        emitBlur(editor);
      });
      expect(result.current.state).toBe('compact');
    });

    it('stays focused on blur when content is present', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      const editor = result.current.editor!;

      act(() => {
        editor.commands.insertContent('hello');
        emitFocus(editor);
      });
      expect(result.current.state).toBe('focused');

      act(() => {
        emitBlur(editor);
      });
      // Content prevents collapse to compact
      expect(result.current.state).toBe('focused');
    });

    it('transitions to expanded when multi-line content is set', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      const editor = result.current.editor!;

      act(() => {
        emitFocus(editor);
      });

      act(() => {
        // Insert multi-block content to trigger expand via onUpdate
        editor.commands.setContent([
          { type: 'paragraph', content: [{ type: 'text', text: 'line 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'line 2' }] },
        ]);
      });

      expect(result.current.state).toBe('expanded');
    });
  });

  describe('send behavior', () => {
    it('calls onSend with editor JSON content', () => {
      const onSend = vi.fn();
      const { result } = renderHook(() =>
        useChatEditor(createConfig({ onSend }))
      );
      const editor = result.current.editor!;

      act(() => {
        editor.commands.insertContent('hello world');
      });

      act(() => {
        result.current.send();
      });

      expect(onSend).toHaveBeenCalledTimes(1);
      const content = onSend.mock.calls[0]![0];
      expect(content.type).toBe('doc');
    });

    it('clears editor after send', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      const editor = result.current.editor!;

      act(() => {
        editor.commands.insertContent('hello');
      });

      // Verify content was inserted
      expect(editor.isEmpty).toBe(false);

      act(() => {
        result.current.send();
      });

      expect(editor.isEmpty).toBe(true);
    });

    it('resets state to compact after send', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      const editor = result.current.editor!;

      act(() => {
        editor.commands.insertContent('hello');
        emitFocus(editor);
      });
      expect(result.current.state).toBe('focused');

      act(() => {
        result.current.send();
      });

      expect(result.current.state).toBe('compact');
    });

    it('does not send when editor is empty', () => {
      const onSend = vi.fn();
      const { result } = renderHook(() =>
        useChatEditor(createConfig({ onSend }))
      );

      act(() => {
        result.current.send();
      });

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('keyboard behavior', () => {
    it('has chatKeyboard extension registered', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));
      const editor = result.current.editor!;
      const extNames = editor.extensionManager.extensions.map((e) => e.name);
      expect(extNames).toContain('chatKeyboard');
    });
  });

  describe('types export', () => {
    it('exposes ChatEditorInstance shape', () => {
      const { result } = renderHook(() => useChatEditor(createConfig()));

      expect(result.current).toHaveProperty('editor');
      expect(result.current).toHaveProperty('state');
      expect(result.current).toHaveProperty('send');
      expect(result.current).toHaveProperty('isEmpty');
    });
  });
});
