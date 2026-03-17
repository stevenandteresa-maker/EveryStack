import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { filterSlashCommands, type SlashCommandItem } from './commands';

/**
 * SlashCommand plugin key — used by the suggestion utility
 * to scope the slash command popup to this extension.
 */
export const SLASH_COMMAND_PLUGIN_KEY = new PluginKey('slashCommand');

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, 'editor'>;
}

/**
 * SlashCommand — TipTap Environment 2 extension.
 *
 * Registers the `/` trigger for the block insertion menu.
 * Uses @tiptap/suggestion to manage the popup lifecycle.
 * The `render` option must be provided by the consumer (see
 * useSmartDocEditor) to wire up the React popup component.
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: SLASH_COMMAND_PLUGIN_KEY,
        items: ({ query }: { query: string }) => filterSlashCommands(query),
        command: ({ editor, range, props }) => {
          // Delete the slash + query text, then execute the command
          editor.chain().focus().deleteRange(range).run();
          props.action(editor);
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
