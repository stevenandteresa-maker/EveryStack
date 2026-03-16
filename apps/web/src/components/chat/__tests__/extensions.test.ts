// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import {
  createChatEditorExtensions,
  CHAT_EDITOR_EXTENSION_NAMES,
  CHAT_EDITOR_EXCLUDED_EXTENSIONS,
} from '../extensions';

function createTestEditor(placeholder?: string) {
  return new Editor({
    extensions: createChatEditorExtensions({ placeholder }),
    content: '',
  });
}

describe('chatEditorExtensions', () => {
  it('creates an editor with required extensions loaded (no headings/tables/code blocks)', () => {
    const editor = createTestEditor();
    const extensionNames = editor.extensionManager.extensions.map(
      (ext) => ext.name
    );

    // Core chat extensions must be present
    const requiredExtensions = [
      'bold',
      'italic',
      'underline',
      'strike',
      'code',
      'bulletList',
      'orderedList',
      'blockquote',
      'link',
      'mention',
      'placeholder',
      'undoRedo',
    ];

    for (const name of requiredExtensions) {
      expect(extensionNames, `Missing extension: ${name}`).toContain(name);
    }

    editor.destroy();
  });

  it('does NOT include headings, tables, codeBlock, image, or horizontalRule', () => {
    const editor = createTestEditor();
    const extensionNames = editor.extensionManager.extensions.map(
      (ext) => ext.name
    );

    for (const excluded of CHAT_EDITOR_EXCLUDED_EXTENSIONS) {
      expect(extensionNames, `Should not include: ${excluded}`).not.toContain(
        excluded
      );
    }

    editor.destroy();
  });

  it('configures link with autolink enabled', () => {
    const editor = createTestEditor();
    const linkExt = editor.extensionManager.extensions.find(
      (ext) => ext.name === 'link'
    );

    expect(linkExt).toBeDefined();
    expect(linkExt?.options.autolink).toBe(true);

    editor.destroy();
  });

  it('configures mention with teal pill HTML attributes', () => {
    const editor = createTestEditor();
    const mentionExt = editor.extensionManager.extensions.find(
      (ext) => ext.name === 'mention'
    );

    expect(mentionExt).toBeDefined();
    expect(mentionExt?.options.HTMLAttributes.class).toContain('bg-teal-100');
    expect(mentionExt?.options.HTMLAttributes.class).toContain('text-teal-800');
    expect(mentionExt?.options.HTMLAttributes.class).toContain('rounded-full');

    editor.destroy();
  });

  it('uses custom placeholder text when provided', () => {
    const editor = createTestEditor('Write something…');
    const placeholderExt = editor.extensionManager.extensions.find(
      (ext) => ext.name === 'placeholder'
    );

    expect(placeholderExt).toBeDefined();
    expect(placeholderExt?.options.placeholder).toBe('Write something…');

    editor.destroy();
  });

  it('uses default placeholder when none provided', () => {
    const editor = createTestEditor();
    const placeholderExt = editor.extensionManager.extensions.find(
      (ext) => ext.name === 'placeholder'
    );

    expect(placeholderExt?.options.placeholder).toBe('Type a message…');

    editor.destroy();
  });

  it('exports CHAT_EDITOR_EXTENSION_NAMES with all expected names', () => {
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('bold');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('italic');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('underline');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('strike');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('code');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('bulletList');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('orderedList');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('blockquote');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('link');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('mention');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('placeholder');
    expect(CHAT_EDITOR_EXTENSION_NAMES).toContain('undoRedo');
  });

  it('supports bold mark command', () => {
    const editor = createTestEditor();

    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    editor.commands.setBold();
    expect(editor.isActive('bold')).toBe(true);

    editor.destroy();
  });

  it('supports italic mark command', () => {
    const editor = createTestEditor();

    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    editor.commands.setItalic();
    expect(editor.isActive('italic')).toBe(true);

    editor.destroy();
  });

  it('supports strikethrough mark command', () => {
    const editor = createTestEditor();

    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    editor.commands.setStrike();
    expect(editor.isActive('strike')).toBe(true);

    editor.destroy();
  });

  it('supports inline code mark command', () => {
    const editor = createTestEditor();

    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    editor.commands.setCode();
    expect(editor.isActive('code')).toBe(true);

    editor.destroy();
  });

  it('supports bullet list creation', () => {
    const editor = createTestEditor();

    editor.commands.toggleBulletList();
    expect(editor.isActive('bulletList')).toBe(true);

    editor.destroy();
  });

  it('supports ordered list creation', () => {
    const editor = createTestEditor();

    editor.commands.toggleOrderedList();
    expect(editor.isActive('orderedList')).toBe(true);

    editor.destroy();
  });

  it('supports blockquote toggle', () => {
    const editor = createTestEditor();

    // Insert content first, then wrap in blockquote
    editor.commands.setContent('<p>quote text</p>');
    editor.commands.focus();
    editor.commands.selectAll();
    const result = editor.commands.toggleBlockquote();
    expect(result).toBe(true);

    // Verify the JSON output contains blockquote node
    const json = editor.getJSON();
    const hasBlockquote = json.content?.some((n) => n.type === 'blockquote');
    expect(hasBlockquote).toBe(true);

    editor.destroy();
  });
});
