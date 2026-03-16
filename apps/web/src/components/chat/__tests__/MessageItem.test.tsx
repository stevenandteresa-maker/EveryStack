// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import type { ThreadMessage } from '../MessageItem';

// Mock TipTap editor for ChatEditor in edit mode
const mockEditor = {
  isEmpty: true,
  isActive: vi.fn().mockReturnValue(false),
  getJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] }),
  commands: {
    clearContent: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
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

vi.mock('../use-chat-editor', () => ({
  useChatEditor: vi.fn(() => ({
    editor: mockEditor,
    state: 'compact',
    send: vi.fn(),
    isEmpty: true,
  })),
}));

vi.mock('@tiptap/react', () => ({
  EditorContent: (_props: { editor: unknown }) => (
    <div data-testid="editor-content">editor</div>
  ),
}));

vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: () => null,
}));

// Must import after mocks
const { MessageItem } = await import('../MessageItem');

function createMessage(overrides?: Partial<ThreadMessage>): ThreadMessage {
  return {
    id: 'msg-1',
    thread_id: 'thread-1',
    author_id: 'user-1',
    author_name: 'Alice Smith',
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ],
    },
    message_type: 'user',
    reactions: {},
    is_edited: false,
    is_deleted: false,
    is_pinned: false,
    created_at: '2026-03-13T10:00:00Z',
    updated_at: '2026-03-13T10:00:00Z',
    ...overrides,
  };
}

function renderMessage(
  message: ThreadMessage,
  props?: Partial<React.ComponentProps<typeof MessageItem>>,
) {
  return render(
    <IntlWrapper>
      <MessageItem
        message={message}
        currentUserId="user-1"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onPin={vi.fn()}
        onSave={vi.fn()}
        onReply={vi.fn()}
        onReactionToggle={vi.fn()}
        {...props}
      />
    </IntlWrapper>,
  );
}

describe('MessageItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders avatar, name, timestamp, and content', () => {
    renderMessage(createMessage());
    expect(screen.getByTestId('message-avatar')).toHaveTextContent('AS');
    expect(screen.getByTestId('message-author')).toHaveTextContent('Alice Smith');
    expect(screen.getByTestId('message-timestamp')).toBeInTheDocument();
    expect(screen.getByTestId('message-renderer')).toBeInTheDocument();
  });

  it('shows hover menu on mouse enter', () => {
    renderMessage(createMessage());
    const item = screen.getByTestId('message-item');
    fireEvent.mouseEnter(item);
    expect(screen.getByTestId('message-hover-menu')).toBeInTheDocument();
  });

  it('hides hover menu on mouse leave', () => {
    renderMessage(createMessage());
    const item = screen.getByTestId('message-item');
    fireEvent.mouseEnter(item);
    expect(screen.getByTestId('message-hover-menu')).toBeInTheDocument();
    fireEvent.mouseLeave(item);
    expect(screen.queryByTestId('message-hover-menu')).not.toBeInTheDocument();
  });

  it('shows edit action only for own messages', async () => {
    const user = userEvent.setup();
    renderMessage(createMessage());
    const item = screen.getByTestId('message-item');
    fireEvent.mouseEnter(item);
    await user.click(screen.getByTestId('message-menu-trigger'));
    expect(await screen.findByTestId('message-action-edit')).toBeInTheDocument();
  });

  it('hides edit and delete for other users messages', async () => {
    const user = userEvent.setup();
    renderMessage(createMessage({ author_id: 'other-user' }));
    const item = screen.getByTestId('message-item');
    fireEvent.mouseEnter(item);
    await user.click(screen.getByTestId('message-menu-trigger'));
    // Wait for menu to open, then check items don't exist
    await waitFor(() => {
      expect(screen.queryByTestId('message-action-reply')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('message-action-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-action-delete')).not.toBeInTheDocument();
  });

  it('enters edit mode when edit is clicked', async () => {
    const user = userEvent.setup();
    renderMessage(createMessage());
    const item = screen.getByTestId('message-item');
    fireEvent.mouseEnter(item);
    await user.click(screen.getByTestId('message-menu-trigger'));
    const editBtn = await screen.findByTestId('message-action-edit');
    fireEvent.click(editBtn);
    await waitFor(() => {
      expect(screen.getByTestId('message-edit-mode')).toBeInTheDocument();
    });
  });

  it('shows "(edited)" for edited messages', () => {
    renderMessage(createMessage({ is_edited: true }));
    expect(screen.getByTestId('message-edited')).toHaveTextContent('(edited)');
  });

  it('renders deleted message placeholder', () => {
    renderMessage(createMessage({ is_deleted: true }));
    expect(screen.getByTestId('deleted-message')).toBeInTheDocument();
    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
  });

  it('renders system message centered without hover menu', () => {
    renderMessage(createMessage({ message_type: 'system' }));
    expect(screen.getByTestId('system-message')).toBeInTheDocument();
    expect(screen.queryByTestId('message-hover-menu')).not.toBeInTheDocument();
  });

  it('system message has no edit/reply actions', () => {
    renderMessage(createMessage({ message_type: 'system' }));
    expect(screen.queryByTestId('message-item')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-menu-trigger')).not.toBeInTheDocument();
  });

  it('calls onReply when reply action is clicked', async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();
    renderMessage(createMessage(), { onReply });
    const item = screen.getByTestId('message-item');
    fireEvent.mouseEnter(item);
    await user.click(screen.getByTestId('message-menu-trigger'));
    const replyBtn = await screen.findByTestId('message-action-reply');
    fireEvent.click(replyBtn);
    expect(onReply).toHaveBeenCalledWith('msg-1');
  });

  it('calls onDelete when delete action is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderMessage(createMessage(), { onDelete });
    const item = screen.getByTestId('message-item');
    fireEvent.mouseEnter(item);
    await user.click(screen.getByTestId('message-menu-trigger'));
    const deleteBtn = await screen.findByTestId('message-action-delete');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('msg-1');
  });

  it('calls onPin when pin action is clicked', async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    renderMessage(createMessage(), { onPin });
    const item = screen.getByTestId('message-item');
    fireEvent.mouseEnter(item);
    await user.click(screen.getByTestId('message-menu-trigger'));
    const pinBtn = await screen.findByTestId('message-action-pin');
    fireEvent.click(pinBtn);
    expect(onPin).toHaveBeenCalledWith('msg-1');
  });

  it('shows "Unpin" text when message is pinned', async () => {
    const user = userEvent.setup();
    renderMessage(createMessage({ is_pinned: true }));
    const item = screen.getByTestId('message-item');
    fireEvent.mouseEnter(item);
    await user.click(screen.getByTestId('message-menu-trigger'));
    const pinBtn = await screen.findByTestId('message-action-pin');
    expect(pinBtn).toHaveTextContent('Unpin');
  });

  it('renders initials from multi-word name', () => {
    renderMessage(createMessage({ author_name: 'Bob Jones' }));
    expect(screen.getByTestId('message-avatar')).toHaveTextContent('BJ');
  });
});
