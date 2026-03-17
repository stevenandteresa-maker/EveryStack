// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { BubbleToolbar } from '../menus/BubbleToolbar';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      bold: 'Bold',
      italic: 'Italic',
      underline: 'Underline',
      strikethrough: 'Strikethrough',
      code: 'Inline code',
      highlight: 'Highlight',
      link: 'Link',
      linkPrompt: 'Enter URL',
      bubbleToolbar: 'Formatting',
    };
    return map[key] ?? key;
  },
}));

// Mock TipTap BubbleMenu — renders children directly for testing
vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bubble-menu">{children}</div>
  ),
}));

function createMockEditor(): Editor {
  const chain: Record<string, unknown> = {};
  const methods = [
    'focus', 'toggleBold', 'toggleItalic', 'toggleUnderline',
    'toggleStrike', 'toggleCode', 'toggleHighlight',
    'extendMarkRange', 'setLink', 'unsetLink', 'run',
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }

  return {
    isDestroyed: false,
    isEditable: true,
    isActive: vi.fn(() => false),
    chain: vi.fn(() => chain),
    commands: {},
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  } as unknown as Editor;
}

describe('BubbleToolbar', () => {
  it('renders within a BubbleMenu', () => {
    const editor = createMockEditor();
    const { getByTestId } = render(<BubbleToolbar editor={editor} />);

    expect(getByTestId('bubble-menu')).toBeDefined();
  });

  it('renders all inline formatting toggles', () => {
    const editor = createMockEditor();
    const { getByRole } = render(<BubbleToolbar editor={editor} />);

    const toolbar = getByRole('toolbar', { name: 'Formatting' });
    expect(toolbar).toBeDefined();

    const labels = ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Inline code', 'Highlight', 'Link'];
    for (const label of labels) {
      expect(getByRole('button', { name: label })).toBeDefined();
    }
  });

  it('renders 7 toggle buttons', () => {
    const editor = createMockEditor();
    const { getAllByRole } = render(<BubbleToolbar editor={editor} />);

    const buttons = getAllByRole('button');
    expect(buttons.length).toBe(7);
  });

  it('reflects active state on toggles', () => {
    const editor = createMockEditor();
    (editor.isActive as ReturnType<typeof vi.fn>).mockImplementation(
      (name: string) => name === 'bold' || name === 'link'
    );

    const { getByRole } = render(<BubbleToolbar editor={editor} />);

    expect(getByRole('button', { name: 'Bold' }).getAttribute('data-state')).toBe('on');
    expect(getByRole('button', { name: 'Italic' }).getAttribute('data-state')).toBe('off');
    expect(getByRole('button', { name: 'Link' }).getAttribute('data-state')).toBe('on');
  });
});
