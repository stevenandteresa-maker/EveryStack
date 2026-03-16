// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import type { MentionSuggestion } from '../types';
import type { Editor } from '@tiptap/core';

// Mock TipTap — JSDOM doesn't support full contentEditable behavior
const mockEditor = {
  isEmpty: true,
  isActive: vi.fn().mockReturnValue(false),
  getJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] }),
  commands: {
    clearContent: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
    toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
    toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
    toggleUnderline: vi.fn().mockReturnValue({ run: vi.fn() }),
    setLink: vi.fn().mockReturnValue({ run: vi.fn() }),
    unsetLink: vi.fn().mockReturnValue({ run: vi.fn() }),
    toggleBulletList: vi.fn().mockReturnValue({ run: vi.fn() }),
    toggleOrderedList: vi.fn().mockReturnValue({ run: vi.fn() }),
  },
  chain: vi.fn().mockReturnValue({
    focus: vi.fn().mockReturnValue({
      toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleUnderline: vi.fn().mockReturnValue({ run: vi.fn() }),
      setLink: vi.fn().mockReturnValue({ run: vi.fn() }),
      unsetLink: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBulletList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleOrderedList: vi.fn().mockReturnValue({ run: vi.fn() }),
    }),
  }),
  state: { tr: {} },
  view: { dispatch: vi.fn() },
  on: vi.fn(),
  off: vi.fn(),
  destroy: vi.fn(),
};

let mockState = 'compact';
const mockSend = vi.fn();

vi.mock('../use-chat-editor', () => ({
  useChatEditor: vi.fn(() => ({
    editor: mockEditor,
    state: mockState,
    send: mockSend,
    isEmpty: mockEditor.isEmpty,
  })),
}));

vi.mock('@tiptap/react', () => ({
  EditorContent: (_props: { editor: unknown }) => (
    <div data-testid="editor-content" />
  ),
  useEditor: vi.fn(() => mockEditor),
}));

vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({
    children,
  }: {
    children: React.ReactNode;
    editor: unknown;
  }) => <div data-testid="bubble-menu">{children}</div>,
}));

// Need to re-import after mocks
const { ChatEditor } = await import('../ChatEditor');
const { MentionDropdown, filterMentionSuggestions } = await import(
  '../MentionDropdown'
);
const { ChatAttachmentButton } = await import('../ChatAttachmentButton');
const { ChatEditorToolbar } = await import('../ChatEditorToolbar');

const defaultProps = {
  onSend: vi.fn(),
  mentionSuggestions: [] as MentionSuggestion[],
};

function renderChatEditor(
  props: Partial<React.ComponentProps<typeof ChatEditor>> = {},
) {
  return render(
    <IntlWrapper>
      <ChatEditor {...defaultProps} {...props} />
    </IntlWrapper>,
  );
}

describe('ChatEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = 'compact';
    mockEditor.isEmpty = true;
  });

  describe('Compact state', () => {
    it('renders in compact state with minimal border', () => {
      renderChatEditor();
      const editor = screen.getByTestId('chat-editor');
      expect(editor).toBeInTheDocument();
      expect(editor.dataset.state).toBe('compact');
    });

    it('does not show action bar in compact state', () => {
      renderChatEditor();
      expect(screen.queryByTestId('chat-attachment-button')).toBeNull();
      expect(screen.queryByTestId('chat-expand-toggle')).toBeNull();
    });

    it('does not show toolbar in compact state', () => {
      renderChatEditor();
      expect(screen.queryByTestId('chat-editor-toolbar')).toBeNull();
    });
  });

  describe('Focused state', () => {
    beforeEach(() => {
      mockState = 'focused';
    });

    it('renders with teal border and action icons', () => {
      renderChatEditor({ onAttach: vi.fn() });
      const editor = screen.getByTestId('chat-editor');
      expect(editor.dataset.state).toBe('focused');
      expect(screen.getByTestId('chat-attachment-button')).toBeInTheDocument();
      expect(screen.getByTestId('chat-expand-toggle')).toBeInTheDocument();
    });

    it('shows send button in focused state', () => {
      renderChatEditor();
      expect(screen.getByTestId('chat-send-button')).toBeInTheDocument();
    });
  });

  describe('Expanded state', () => {
    beforeEach(() => {
      mockState = 'expanded';
    });

    it('renders with multi-line area and Cancel/Send buttons', () => {
      renderChatEditor();
      const editor = screen.getByTestId('chat-editor');
      expect(editor.dataset.state).toBe('expanded');
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Send')).toBeInTheDocument();
    });

    it('renders bubble toolbar in expanded mode', () => {
      renderChatEditor();
      expect(screen.getByTestId('bubble-menu')).toBeInTheDocument();
    });

    it('Send button is disabled when editor is empty', () => {
      renderChatEditor();
      const sendBtn = screen.getByText('Send');
      expect(sendBtn).toBeDisabled();
    });

    it('Send button calls send when editor has content', () => {
      mockEditor.isEmpty = false;
      renderChatEditor();
      const sendBtn = screen.getByText('Send');
      expect(sendBtn).not.toBeDisabled();
      fireEvent.click(sendBtn);
      expect(mockSend).toHaveBeenCalled();
    });

    it('Cancel clears content', () => {
      renderChatEditor();
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockEditor.commands.clearContent).toHaveBeenCalledWith(true);
    });
  });

  describe('Drag and drop', () => {
    it('calls onAttach when files are dropped', () => {
      const onAttach = vi.fn();
      renderChatEditor({ onAttach });

      const editor = screen.getByTestId('chat-editor');
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      fireEvent.drop(editor, {
        dataTransfer: { files: [file] },
      });

      expect(onAttach).toHaveBeenCalledWith([file]);
    });
  });
});

describe('ChatEditorToolbar', () => {
  it('renders six toolbar buttons', () => {
    render(
      <IntlWrapper>
        <ChatEditorToolbar editor={mockEditor as unknown as Editor} />
      </IntlWrapper>,
    );

    const toolbar = screen.getByTestId('chat-editor-toolbar');
    expect(toolbar).toBeInTheDocument();
    // 6 buttons: B, I, U, Link, Bullets, Numbers
    const buttons = toolbar.querySelectorAll('button');
    expect(buttons).toHaveLength(6);
  });

  it('buttons have correct aria-labels', () => {
    render(
      <IntlWrapper>
        <ChatEditorToolbar editor={mockEditor as unknown as Editor} />
      </IntlWrapper>,
    );

    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Underline')).toBeInTheDocument();
    expect(screen.getByLabelText('Link')).toBeInTheDocument();
    expect(screen.getByLabelText('Bullet list')).toBeInTheDocument();
    expect(screen.getByLabelText('Numbered list')).toBeInTheDocument();
  });
});

describe('MentionDropdown', () => {
  const mockCommand = vi.fn();
  const suggestions: MentionSuggestion[] = [
    { id: 'u1', label: 'Alice Smith', role: 'Admin' },
    { id: 'u2', label: 'Bob Jones', role: 'Member' },
    { id: 'u3', label: 'Charlie Brown' },
    { id: 'here', label: 'here', type: 'group', role: 'All participants' },
    {
      id: 'channel',
      label: 'channel',
      type: 'group',
      role: 'Manager+ only',
    },
  ];

  it('renders people and group sections', () => {
    render(
      <IntlWrapper>
        <MentionDropdown
          items={suggestions}
          command={mockCommand}
          query=""
        />
      </IntlWrapper>,
    );

    const dropdown = screen.getByTestId('mention-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('@here')).toBeInTheDocument();
    expect(screen.getByText('@channel')).toBeInTheDocument();
  });

  it('renders role badges', () => {
    render(
      <IntlWrapper>
        <MentionDropdown
          items={suggestions}
          command={mockCommand}
          query=""
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('calls command with correct item on click', () => {
    render(
      <IntlWrapper>
        <MentionDropdown
          items={suggestions}
          command={mockCommand}
          query=""
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByText('Alice Smith'));
    expect(mockCommand).toHaveBeenCalledWith({
      id: 'u1',
      label: 'Alice Smith',
    });
  });

  it('renders nothing when items array is empty', () => {
    const { container } = render(
      <IntlWrapper>
        <MentionDropdown items={[]} command={mockCommand} query="" />
      </IntlWrapper>,
    );

    expect(container.innerHTML).toBe('');
  });

  it('shows divider between people and groups', () => {
    render(
      <IntlWrapper>
        <MentionDropdown
          items={suggestions}
          command={mockCommand}
          query=""
        />
      </IntlWrapper>,
    );

    const dropdown = screen.getByTestId('mention-dropdown');
    const divider = dropdown.querySelector('.border-t');
    expect(divider).toBeInTheDocument();
  });
});

describe('filterMentionSuggestions', () => {
  const suggestions: MentionSuggestion[] = [
    { id: 'u1', label: 'Alice Smith' },
    { id: 'u2', label: 'Bob Jones' },
    { id: 'u3', label: 'Charlie Brown' },
  ];

  it('returns all suggestions for empty query', () => {
    const result = filterMentionSuggestions(suggestions, '');
    expect(result).toHaveLength(3);
  });

  it('filters by substring match (case-insensitive)', () => {
    const result = filterMentionSuggestions(suggestions, 'ali');
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('Alice Smith');
  });

  it('returns empty array when no match', () => {
    const result = filterMentionSuggestions(suggestions, 'xyz');
    expect(result).toHaveLength(0);
  });

  it('matches partial names', () => {
    const result = filterMentionSuggestions(suggestions, 'own');
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('Charlie Brown');
  });
});

describe('ChatAttachmentButton', () => {
  it('renders paperclip button', () => {
    render(
      <IntlWrapper>
        <ChatAttachmentButton onAttach={vi.fn()} />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('chat-attachment-button')).toBeInTheDocument();
  });

  it('triggers file picker on click', async () => {
    const user = userEvent.setup();
    const onAttach = vi.fn();
    render(
      <IntlWrapper>
        <ChatAttachmentButton onAttach={onAttach} />
      </IntlWrapper>,
    );

    const button = screen.getByTestId('chat-attachment-button');
    const input = screen.getByTestId('chat-attachment-input');

    // Verify hidden file input exists
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'file');

    // Simulate click (triggers hidden input click)
    const clickSpy = vi.spyOn(input, 'click');
    await user.click(button);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('calls onAttach with selected files', () => {
    const onAttach = vi.fn();
    render(
      <IntlWrapper>
        <ChatAttachmentButton onAttach={onAttach} />
      </IntlWrapper>,
    );

    const input = screen.getByTestId('chat-attachment-input');
    const file = new File(['test content'], 'document.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(input, { target: { files: [file] } });
    expect(onAttach).toHaveBeenCalledWith([file]);
  });

  it('shows file preview after selection', () => {
    const onAttach = vi.fn();
    render(
      <IntlWrapper>
        <ChatAttachmentButton onAttach={onAttach} />
      </IntlWrapper>,
    );

    const input = screen.getByTestId('chat-attachment-input');
    const file = new File(['test'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByTestId('chat-attachment-previews')).toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
  });

  it('shows image thumbnail for image files', () => {
    const onAttach = vi.fn();
    // Mock URL.createObjectURL
    const mockUrl = 'blob:mock-url';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);

    render(
      <IntlWrapper>
        <ChatAttachmentButton onAttach={onAttach} />
      </IntlWrapper>,
    );

    const input = screen.getByTestId('chat-attachment-input');
    const file = new File(['img'], 'photo.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    const img = screen.getByAltText('photo.png');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockUrl);
  });

  it('removes preview on X click', async () => {
    const user = userEvent.setup();
    const onAttach = vi.fn();
    render(
      <IntlWrapper>
        <ChatAttachmentButton onAttach={onAttach} />
      </IntlWrapper>,
    );

    const input = screen.getByTestId('chat-attachment-input');
    const file = new File(['test'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('notes.txt')).toBeInTheDocument();

    const removeButton = screen.getByLabelText('Remove attachment');
    await user.click(removeButton);

    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
  });
});
