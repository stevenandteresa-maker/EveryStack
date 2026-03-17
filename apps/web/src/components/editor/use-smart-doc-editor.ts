'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import type { Editor, JSONContent } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import {
  createSmartDocExtensions,
  SlashCommand,
  type SlashCommandItem,
} from './extensions';
import {
  SlashCommandList,
  type SlashCommandListRef,
} from './extensions/slash-command/slash-command-list';

export interface SmartDocEditorOptions {
  /** Initial document content (TipTap JSON) */
  content?: JSONContent;
  /** Called when the document changes */
  onUpdate?: (content: JSONContent) => void;
  /** Whether the editor is editable (default: true) */
  editable?: boolean;
  /** Placeholder text for empty editor */
  placeholder?: string;
  /** Maximum character count (0 = unlimited) */
  characterLimit?: number;
}

export interface SmartDocEditorInstance {
  /** The TipTap editor instance */
  editor: Editor | null;
}

/**
 * useSmartDocEditor — initializes TipTap Environment 2 (Smart Doc Editor).
 *
 * Wires up the full extension set including the slash command popup.
 * Returns the editor instance for consumption by SmartDocEditor component.
 */
export function useSmartDocEditor(options: SmartDocEditorOptions = {}): SmartDocEditorInstance {
  const {
    content,
    onUpdate,
    editable = true,
    placeholder,
    characterLimit,
  } = options;

  // Stable ref so the onUpdate callback doesn't re-create extensions
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const slashCommandRender = useCallback(() => {
    let component: ReactRenderer<SlashCommandListRef> | null = null;
    let popup: HTMLDivElement | null = null;

    return {
      onStart: (props: {
        items: SlashCommandItem[];
        command: (item: SlashCommandItem) => void;
        clientRect?: (() => DOMRect | null) | null;
      }) => {
        component = new ReactRenderer(SlashCommandList, {
          props: {
            items: props.items,
            command: props.command,
          },
          editor: props as unknown as Editor,
        });

        popup = document.createElement('div');
        popup.style.position = 'absolute';
        popup.style.zIndex = '50';
        document.body.appendChild(popup);

        if (component.element) {
          popup.appendChild(component.element);
        }

        const rect = props.clientRect?.();
        if (rect && popup) {
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 4}px`;
        }
      },

      onUpdate: (props: {
        items: SlashCommandItem[];
        command: (item: SlashCommandItem) => void;
        clientRect?: (() => DOMRect | null) | null;
      }) => {
        component?.updateProps({
          items: props.items,
          command: props.command,
        });

        const rect = props.clientRect?.();
        if (rect && popup) {
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 4}px`;
        }
      },

      onKeyDown: (props: { event: KeyboardEvent }) => {
        if (props.event.key === 'Escape') {
          popup?.remove();
          component?.destroy();
          popup = null;
          component = null;
          return true;
        }

        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        popup?.remove();
        component?.destroy();
        popup = null;
        component = null;
      },
    };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    content: content ?? undefined,
    extensions: [
      ...createSmartDocExtensions({ placeholder, characterLimit }),
      // Override default SlashCommand with wired-up render
      SlashCommand.configure({
        suggestion: {
          render: slashCommandRender,
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[200px]',
      },
    },
    onUpdate: ({ editor: e }) => {
      onUpdateRef.current?.(e.getJSON());
    },
  });

  return { editor };
}
