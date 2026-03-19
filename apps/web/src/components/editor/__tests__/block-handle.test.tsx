// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { BlockHandle } from '../extensions/block-handle/BlockHandle';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      dragHandle: 'Drag to reorder block',
      delete: 'Delete',
      duplicate: 'Duplicate',
      moveUp: 'Move up',
      moveDown: 'Move down',
    };
    return map[key] ?? key;
  },
}));

function createMockEditorView() {
  const dom = document.createElement('div');
  return {
    dom,
    posAtCoords: vi.fn(() => null),
    nodeDOM: vi.fn(() => null),
  };
}

function createMockEditor(): Editor {
  const view = createMockEditorView();
  const chain: Record<string, unknown> = {};
  const methods = [
    'focus', 'deleteRange', 'insertContentAt', 'run',
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }

  return {
    isDestroyed: false,
    isEditable: true,
    view,
    state: {
      doc: {
        resolve: vi.fn(() => ({ depth: 1, before: vi.fn(() => 0), index: vi.fn(() => 0) })),
        nodeAt: vi.fn(() => null),
        childCount: 1,
        child: vi.fn(() => ({ nodeSize: 10 })),
      },
      selection: { from: 0, to: 0 },
    },
    chain: vi.fn(() => chain),
    commands: {},
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  } as unknown as Editor;
}

describe('BlockHandle', () => {
  it('renders without crashing', () => {
    const editor = createMockEditor();
    const { container } = render(<BlockHandle editor={editor} />);

    // Handle is hidden by default (no hovered block)
    expect(container.querySelector('[data-testid="block-handle"]')).toBeNull();
  });

  it('attaches mousemove listener to editor DOM', () => {
    const editor = createMockEditor();
    const addEventSpy = vi.spyOn(editor.view.dom, 'addEventListener');

    render(<BlockHandle editor={editor} />);

    expect(addEventSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addEventSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });

  it('cleans up event listeners on unmount', () => {
    const editor = createMockEditor();
    const removeEventSpy = vi.spyOn(editor.view.dom, 'removeEventListener');

    const { unmount } = render(<BlockHandle editor={editor} />);
    unmount();

    expect(removeEventSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeEventSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });
});
