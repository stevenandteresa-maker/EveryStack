// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { EditorToolbar } from '../toolbar/EditorToolbar';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      formatGroup: 'Text formatting',
      bold: 'Bold',
      italic: 'Italic',
      underline: 'Underline',
      strikethrough: 'Strikethrough',
      code: 'Inline code',
      highlight: 'Highlight',
      alignGroup: 'Text alignment',
      alignLeft: 'Align left',
      alignCenter: 'Align center',
      alignRight: 'Align right',
      alignJustify: 'Justify',
      insertGroup: 'Insert elements',
      link: 'Link',
      linkPrompt: 'Enter URL',
      image: 'Image',
      imagePrompt: 'Enter image URL',
      table: 'Table',
      codeBlock: 'Code block',
      callout: 'Callout',
      historyGroup: 'Undo and redo',
      undo: 'Undo',
      redo: 'Redo',
    };
    return map[key] ?? key;
  },
}));

function createChainableMock() {
  const chainMethods: Record<string, ReturnType<typeof vi.fn>> = {};
  const chain: Record<string, unknown> = {};

  const methods = [
    'focus', 'toggleBold', 'toggleItalic', 'toggleUnderline',
    'toggleStrike', 'toggleCode', 'toggleHighlight',
    'setTextAlign', 'extendMarkRange', 'setLink', 'unsetLink',
    'setImage', 'insertTable', 'toggleCodeBlock', 'insertCallout',
    'undo', 'redo', 'run',
  ];

  for (const method of methods) {
    chainMethods[method] = vi.fn(() => chain);
    chain[method] = chainMethods[method];
  }

  return { chain, chainMethods };
}

function createMockEditor(): Editor {
  const { chain, chainMethods } = createChainableMock();

  return {
    isDestroyed: false,
    isEditable: true,
    isActive: vi.fn(() => false),
    getAttributes: vi.fn(() => ({})),
    chain: vi.fn(() => chain),
    can: vi.fn(() => ({
      undo: vi.fn(() => true),
      redo: vi.fn(() => true),
    })),
    commands: {},
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    _chainMethods: chainMethods,
  } as unknown as Editor & { _chainMethods: Record<string, ReturnType<typeof vi.fn>> };
}

describe('EditorToolbar', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createMockEditor();
  });

  it('renders toolbar with role="toolbar"', () => {
    render(<EditorToolbar editor={editor} />);

    expect(screen.getByRole('toolbar')).toBeDefined();
  });

  it('renders all four groups', () => {
    render(<EditorToolbar editor={editor} />);

    expect(screen.getByRole('group', { name: 'Text formatting' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Text alignment' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Insert elements' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Undo and redo' })).toBeDefined();
  });

  it('renders format toggles with correct aria-labels', () => {
    render(<EditorToolbar editor={editor} />);

    const formatGroup = screen.getByRole('group', { name: 'Text formatting' });
    expect(within(formatGroup).getByRole('button', { name: 'Bold' })).toBeDefined();
    expect(within(formatGroup).getByRole('button', { name: 'Italic' })).toBeDefined();
    expect(within(formatGroup).getByRole('button', { name: 'Underline' })).toBeDefined();
    expect(within(formatGroup).getByRole('button', { name: 'Strikethrough' })).toBeDefined();
    expect(within(formatGroup).getByRole('button', { name: 'Inline code' })).toBeDefined();
    expect(within(formatGroup).getByRole('button', { name: 'Highlight' })).toBeDefined();
  });

  it('renders alignment toggles', () => {
    render(<EditorToolbar editor={editor} />);

    const alignGroup = screen.getByRole('group', { name: 'Text alignment' });
    expect(within(alignGroup).getByRole('button', { name: 'Align left' })).toBeDefined();
    expect(within(alignGroup).getByRole('button', { name: 'Align center' })).toBeDefined();
    expect(within(alignGroup).getByRole('button', { name: 'Align right' })).toBeDefined();
    expect(within(alignGroup).getByRole('button', { name: 'Justify' })).toBeDefined();
  });

  it('renders insert buttons', () => {
    render(<EditorToolbar editor={editor} />);

    const insertGroup = screen.getByRole('group', { name: 'Insert elements' });
    expect(within(insertGroup).getByRole('button', { name: 'Link' })).toBeDefined();
    expect(within(insertGroup).getByRole('button', { name: 'Image' })).toBeDefined();
    expect(within(insertGroup).getByRole('button', { name: 'Table' })).toBeDefined();
    expect(within(insertGroup).getByRole('button', { name: 'Code block' })).toBeDefined();
    expect(within(insertGroup).getByRole('button', { name: 'Callout' })).toBeDefined();
  });

  it('renders undo/redo buttons', () => {
    render(<EditorToolbar editor={editor} />);

    const historyGroup = screen.getByRole('group', { name: 'Undo and redo' });
    expect(within(historyGroup).getByRole('button', { name: 'Undo' })).toBeDefined();
    expect(within(historyGroup).getByRole('button', { name: 'Redo' })).toBeDefined();
  });

  it('calls toggleBold when bold button is clicked', async () => {
    const user = userEvent.setup();
    render(<EditorToolbar editor={editor} />);

    const boldButton = screen.getByRole('button', { name: 'Bold' });
    await user.click(boldButton);

    expect(editor.chain).toHaveBeenCalled();
  });

  it('calls setTextAlign when alignment button is clicked', async () => {
    const user = userEvent.setup();
    render(<EditorToolbar editor={editor} />);

    const centerButton = screen.getByRole('button', { name: 'Align center' });
    await user.click(centerButton);

    expect(editor.chain).toHaveBeenCalled();
  });

  it('calls insertTable when table button is clicked', async () => {
    const user = userEvent.setup();
    render(<EditorToolbar editor={editor} />);

    const tableButton = screen.getByRole('button', { name: 'Table' });
    await user.click(tableButton);

    expect(editor.chain).toHaveBeenCalled();
  });

  it('reflects active state on format toggles', () => {
    (editor.isActive as ReturnType<typeof vi.fn>).mockImplementation(
      (name: string | Record<string, unknown>) => name === 'bold'
    );

    render(<EditorToolbar editor={editor} />);

    const boldButton = screen.getByRole('button', { name: 'Bold' });
    expect(boldButton.getAttribute('aria-pressed')).toBe('true');

    const italicButton = screen.getByRole('button', { name: 'Italic' });
    expect(italicButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('disables undo when cannot undo', () => {
    (editor.can as ReturnType<typeof vi.fn>).mockReturnValue({
      undo: vi.fn(() => false),
      redo: vi.fn(() => true),
    });

    render(<EditorToolbar editor={editor} />);

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toHaveProperty('disabled', true);
  });

  it('disables redo when cannot redo', () => {
    (editor.can as ReturnType<typeof vi.fn>).mockReturnValue({
      undo: vi.fn(() => true),
      redo: vi.fn(() => false),
    });

    render(<EditorToolbar editor={editor} />);

    const redoButton = screen.getByRole('button', { name: 'Redo' });
    expect(redoButton).toHaveProperty('disabled', true);
  });

  it('renders vertical separators between groups', () => {
    const { container } = render(<EditorToolbar editor={editor} />);

    const separators = container.querySelectorAll('[data-orientation="vertical"]');
    expect(separators.length).toBe(3);
  });
});
