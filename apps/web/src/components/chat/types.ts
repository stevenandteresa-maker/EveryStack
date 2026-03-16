import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/core';

export type ChatEditorState = 'compact' | 'focused' | 'expanded';

export interface MentionSuggestion {
  id: string;
  label: string;
  avatar?: string;
  role?: string;
  /** 'person' (default) or 'group' for @here / @channel */
  type?: string; // known values: 'person', 'group'
}

/** State passed from TipTap suggestion plugin to MentionDropdown */
export interface MentionDropdownState {
  items: MentionSuggestion[];
  command: (item: { id: string; label: string }) => void;
  clientRect?: (() => DOMRect | null) | null;
  query: string;
}

/** TipTap suggestion config shape (subset used by chat editor) */
export interface ChatMentionSuggestionConfig {
  char?: string;
  items: (props: { query: string }) => MentionSuggestion[];
  render: () => {
    onStart: (props: MentionDropdownState) => void;
    onUpdate: (props: MentionDropdownState) => void;
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
    onExit: () => void;
  };
}

export interface ChatEditorConfig {
  placeholder?: string;
  onSend: (content: JSONContent) => void;
  onAttach?: (files: File[]) => void;
  onEditLastMessage?: () => void;
  mentionSuggestions?: MentionSuggestion[];
  mentionSuggestion?: ChatMentionSuggestionConfig;
  maxHeight?: number;
}

export interface ChatEditorInstance {
  editor: Editor | null;
  state: ChatEditorState;
  send: () => void;
  isEmpty: boolean;
}
