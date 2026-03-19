// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SmartDocEditor } from '../SmartDocEditor';
import type { Editor } from '@tiptap/core';

// Minimal mock editor for component rendering tests
function createMockEditor(): Editor {
  return {
    isDestroyed: false,
    isEditable: true,
    getJSON: () => ({ type: 'doc', content: [] }),
    getHTML: () => '<p></p>',
    commands: {},
    chain: () => ({ focus: () => ({}) }),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  } as unknown as Editor;
}

// Mock EditorContent since it requires a real TipTap editor
vi.mock('@tiptap/react', () => ({
  EditorContent: ({ editor }: { editor: Editor }) => (
    <div data-testid="editor-content" data-editor={!!editor}>
      Editor content
    </div>
  ),
}));

describe('SmartDocEditor', () => {
  it('renders null when editor is null', () => {
    const { container } = render(
      <SmartDocEditor editor={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders editor content when editor is provided', () => {
    const editor = createMockEditor();
    render(<SmartDocEditor editor={editor} />);

    expect(screen.getByTestId('editor-content')).toBeDefined();
  });

  it('renders toolbar slot when renderToolbar is provided', () => {
    const editor = createMockEditor();
    render(
      <SmartDocEditor
        editor={editor}
        renderToolbar={() => <div data-testid="toolbar">Toolbar</div>}
      />,
    );

    expect(screen.getByTestId('toolbar')).toBeDefined();
    expect(screen.getByText('Toolbar')).toBeDefined();
  });

  it('does not render toolbar when renderToolbar is not provided', () => {
    const editor = createMockEditor();
    render(<SmartDocEditor editor={editor} />);

    expect(screen.queryByTestId('toolbar')).toBeNull();
  });

  it('renders sidebar slot when renderSidebar is provided', () => {
    const editor = createMockEditor();
    render(
      <SmartDocEditor
        editor={editor}
        renderSidebar={() => <div data-testid="sidebar">Sidebar</div>}
      />,
    );

    expect(screen.getByTestId('sidebar')).toBeDefined();
    expect(screen.getByText('Sidebar')).toBeDefined();
  });

  it('does not render sidebar when renderSidebar is not provided', () => {
    const editor = createMockEditor();
    render(<SmartDocEditor editor={editor} />);

    expect(screen.queryByTestId('sidebar')).toBeNull();
  });

  it('passes editor to renderToolbar callback', () => {
    const editor = createMockEditor();
    const renderToolbar = vi.fn(() => <div>Toolbar</div>);

    render(<SmartDocEditor editor={editor} renderToolbar={renderToolbar} />);

    expect(renderToolbar).toHaveBeenCalledWith(editor);
  });

  it('passes editor to renderSidebar callback', () => {
    const editor = createMockEditor();
    const renderSidebar = vi.fn(() => <div>Sidebar</div>);

    render(<SmartDocEditor editor={editor} renderSidebar={renderSidebar} />);

    expect(renderSidebar).toHaveBeenCalledWith(editor);
  });

  it('applies custom className', () => {
    const editor = createMockEditor();
    const { container } = render(
      <SmartDocEditor editor={editor} className="my-custom-class" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('my-custom-class');
  });

  it('applies prose typography classes to editor content wrapper', () => {
    const editor = createMockEditor();
    const { container } = render(<SmartDocEditor editor={editor} />);

    const proseElement = container.querySelector('.prose');
    expect(proseElement).toBeDefined();
  });
});
