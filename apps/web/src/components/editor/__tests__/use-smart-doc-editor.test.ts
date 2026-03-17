// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSmartDocEditor } from '../use-smart-doc-editor';

// Mock @tiptap/react to avoid full ProseMirror initialization
vi.mock('@tiptap/react', () => {
  const mockEditor = {
    isDestroyed: false,
    isEditable: true,
    getJSON: () => ({ type: 'doc', content: [{ type: 'paragraph' }] }),
    getHTML: () => '<p></p>',
    isEmpty: true,
    commands: {
      setContent: vi.fn(),
      clearContent: vi.fn(),
    },
    chain: () => ({
      focus: () => ({
        deleteRange: () => ({ run: vi.fn() }),
      }),
    }),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    extensionManager: {
      extensions: [],
    },
  };

  return {
    useEditor: vi.fn(() => mockEditor),
    ReactRenderer: vi.fn().mockImplementation(() => ({
      element: document.createElement('div'),
      ref: null,
      updateProps: vi.fn(),
      destroy: vi.fn(),
    })),
  };
});

describe('useSmartDocEditor', () => {
  it('returns an editor instance', () => {
    const { result } = renderHook(() => useSmartDocEditor());
    expect(result.current.editor).toBeDefined();
    expect(result.current.editor).not.toBeNull();
  });

  it('returns editor with default options', () => {
    const { result } = renderHook(() => useSmartDocEditor());
    expect(result.current.editor).toBeDefined();
  });

  it('accepts content option', () => {
    const content = { type: 'doc' as const, content: [{ type: 'paragraph' }] };
    const { result } = renderHook(() => useSmartDocEditor({ content }));
    expect(result.current.editor).toBeDefined();
  });

  it('accepts onUpdate callback', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useSmartDocEditor({ onUpdate }));
    expect(result.current.editor).toBeDefined();
  });

  it('accepts editable option', () => {
    const { result } = renderHook(() => useSmartDocEditor({ editable: false }));
    expect(result.current.editor).toBeDefined();
  });

  it('accepts placeholder option', () => {
    const { result } = renderHook(() =>
      useSmartDocEditor({ placeholder: 'Write something…' }),
    );
    expect(result.current.editor).toBeDefined();
  });

  it('passes useEditor correct config', async () => {
    const { useEditor } = await import('@tiptap/react');
    (useEditor as ReturnType<typeof vi.fn>).mockClear();

    renderHook(() =>
      useSmartDocEditor({
        editable: false,
        placeholder: 'Custom placeholder',
      }),
    );

    expect(useEditor).toHaveBeenCalled();
    const config = (useEditor as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(config.editable).toBe(false);
    expect(config.immediatelyRender).toBe(false);
  });
});
