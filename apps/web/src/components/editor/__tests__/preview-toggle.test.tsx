// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PreviewToggle, usePreviewToggle } from '../toolbar/PreviewToggle';
import type { Editor, JSONContent } from '@tiptap/core';
import { renderHook } from '@testing-library/react';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      label: 'Document view mode',
      edit: 'Edit',
      preview: 'Preview',
      raw: 'Raw',
    };
    return translations[key] ?? key;
  },
}));

function createMockEditor(): Editor {
  return {
    isDestroyed: false,
    isEditable: true,
    getJSON: vi.fn(() => ({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'mergeTag',
              attrs: { tableId: 't1', fieldId: 'f1', fallback: 'Name' },
            },
          ],
        },
      ],
    })),
    commands: {
      setContent: vi.fn(),
    },
    setEditable: vi.fn(),
    chain: () => ({ focus: () => ({}) }),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  } as unknown as Editor;
}

// ---------------------------------------------------------------------------
// PreviewToggle component tests
// ---------------------------------------------------------------------------

describe('PreviewToggle', () => {
  it('renders three mode buttons', () => {
    const editor = createMockEditor();
    render(
      <PreviewToggle
        editor={editor}
        mode="edit"
        onModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Edit')).toBeDefined();
    expect(screen.getByText('Preview')).toBeDefined();
    expect(screen.getByText('Raw')).toBeDefined();
  });

  it('highlights the active mode', () => {
    const editor = createMockEditor();
    render(
      <PreviewToggle
        editor={editor}
        mode="preview"
        onModeChange={vi.fn()}
      />,
    );

    const previewBtn = screen.getByText('Preview').closest('button')!;
    expect(previewBtn.getAttribute('aria-checked')).toBe('true');

    const editBtn = screen.getByText('Edit').closest('button')!;
    expect(editBtn.getAttribute('aria-checked')).toBe('false');
  });

  it('calls onModeChange when a different mode is clicked', () => {
    const editor = createMockEditor();
    const onModeChange = vi.fn();
    render(
      <PreviewToggle
        editor={editor}
        mode="edit"
        onModeChange={onModeChange}
      />,
    );

    fireEvent.click(screen.getByText('Preview'));
    expect(onModeChange).toHaveBeenCalledWith('preview');

    fireEvent.click(screen.getByText('Raw'));
    expect(onModeChange).toHaveBeenCalledWith('raw');
  });

  it('disables non-active buttons when resolving', () => {
    const editor = createMockEditor();
    render(
      <PreviewToggle
        editor={editor}
        mode="preview"
        onModeChange={vi.fn()}
        isResolving={true}
      />,
    );

    const editBtn = screen.getByText('Edit').closest('button')!;
    expect(editBtn.disabled).toBe(true);

    const rawBtn = screen.getByText('Raw').closest('button')!;
    expect(rawBtn.disabled).toBe(true);

    // Active mode button should not be disabled
    const previewBtn = screen.getByText('Preview').closest('button')!;
    expect(previewBtn.disabled).toBe(false);
  });

  it('has proper aria role and label', () => {
    const editor = createMockEditor();
    render(
      <PreviewToggle
        editor={editor}
        mode="edit"
        onModeChange={vi.fn()}
      />,
    );

    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toBeDefined();
    expect(radioGroup.getAttribute('aria-label')).toBe('Document view mode');
  });
});

// ---------------------------------------------------------------------------
// usePreviewToggle hook tests
// ---------------------------------------------------------------------------

describe('usePreviewToggle', () => {
  it('starts in edit mode', () => {
    const editor = createMockEditor();
    const { result } = renderHook(() =>
      usePreviewToggle({ editor, tenantId: 'tenant-1' }),
    );

    expect(result.current.mode).toBe('edit');
    expect(result.current.isResolving).toBe(false);
  });

  it('switches to raw mode and converts merge tags to {field} text', async () => {
    const editor = createMockEditor();
    const { result } = renderHook(() =>
      usePreviewToggle({ editor, tenantId: 'tenant-1' }),
    );

    await act(async () => {
      await result.current.setMode('raw');
    });

    expect(result.current.mode).toBe('raw');
    expect(editor.setEditable).toHaveBeenCalledWith(false);

    // Verify setContent was called with converted content
    const setContent = (editor.commands as unknown as { setContent: ReturnType<typeof vi.fn> }).setContent;
    expect(setContent).toHaveBeenCalled();

    const rawContent = setContent.mock.calls[0]![0] as JSONContent;
    // The mergeTag node should have been replaced with {Name} text
    const paragraph = rawContent.content?.[1];
    const textNode = paragraph?.content?.[0];
    expect(textNode?.type).toBe('text');
    expect(textNode?.text).toBe('{Name}');
  });

  it('restores edit content when returning to edit mode', async () => {
    const editor = createMockEditor();
    const { result } = renderHook(() =>
      usePreviewToggle({ editor, tenantId: 'tenant-1' }),
    );

    const originalContent = editor.getJSON();

    // Switch to raw
    await act(async () => {
      await result.current.setMode('raw');
    });

    // Switch back to edit
    await act(async () => {
      await result.current.setMode('edit');
    });

    expect(result.current.mode).toBe('edit');
    expect(editor.setEditable).toHaveBeenCalledWith(true);

    const setContent = (editor.commands as unknown as { setContent: ReturnType<typeof vi.fn> }).setContent;
    // Last setContent call should restore the original content
    const lastCall = setContent.mock.calls[setContent.mock.calls.length - 1]![0];
    expect(lastCall).toEqual(originalContent);
  });

  it('calls resolver function in preview mode', async () => {
    const editor = createMockEditor();
    const resolvedContent: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'John Doe' }] },
      ],
    };

    const resolveMergeTags = vi.fn().mockResolvedValue(resolvedContent);

    const { result } = renderHook(() =>
      usePreviewToggle({
        editor,
        tenantId: 'tenant-1',
        recordId: 'record-1',
        resolveMergeTags,
      }),
    );

    await act(async () => {
      await result.current.setMode('preview');
    });

    expect(resolveMergeTags).toHaveBeenCalledWith(
      expect.anything(),
      'record-1',
      'tenant-1',
    );
    expect(result.current.mode).toBe('preview');
    expect(editor.setEditable).toHaveBeenCalledWith(false);
  });

  it('does not change mode when setting same mode', async () => {
    const editor = createMockEditor();
    const { result } = renderHook(() =>
      usePreviewToggle({ editor, tenantId: 'tenant-1' }),
    );

    // Clear calls from initial useEffect (sets editable on mount)
    (editor.setEditable as ReturnType<typeof vi.fn>).mockClear();

    await act(async () => {
      await result.current.setMode('edit');
    });

    // setEditable should not be called again for same mode
    expect(editor.setEditable).not.toHaveBeenCalled();
  });
});
