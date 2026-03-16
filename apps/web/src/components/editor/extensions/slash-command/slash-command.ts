import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';

/**
 * SlashCommand plugin key — used by the suggestion utility
 * to scope the slash command popup to this extension.
 */
export const SLASH_COMMAND_PLUGIN_KEY = new PluginKey('slashCommand');

/**
 * SlashCommand — TipTap Environment 2 extension shell.
 *
 * Registers the `/` trigger for the block insertion menu.
 * The actual suggestion popup, command list, and filtering
 * are wired in Unit 5 (Template Management UI). This shell
 * provides the extension identity and plugin key so the
 * extension bundle is complete.
 */
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      /** Suggestion config — injected when the popup component is ready (Unit 5). */
      suggestion: {
        char: '/',
        pluginKey: SLASH_COMMAND_PLUGIN_KEY,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: { chain: () => { focus: () => { deleteRange: (r: unknown) => { run: () => void } } } };
          range: unknown;
          props: { command: (opts: { editor: unknown; range: unknown }) => void };
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },
});
