// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import {
  createSmartDocExtensions,
  SMART_DOC_EXTENSION_NAMES,
} from '../extensions';

function createTestEditor(options?: Parameters<typeof createSmartDocExtensions>[0]) {
  return new Editor({
    extensions: createSmartDocExtensions(options),
    content: '',
  });
}

describe('smartDocExtensions', () => {
  it('creates an editor with all required extensions loaded', () => {
    const editor = createTestEditor();
    const extensionNames = editor.extensionManager.extensions.map(
      (ext) => ext.name
    );

    const required = [
      'bold',
      'italic',
      'strike',
      'code',
      'heading',
      'bulletList',
      'orderedList',
      'blockquote',
      'horizontalRule',
      'underline',
      'highlight',
      'textStyle',
      'color',
      'link',
      'image',
      'table',
      'tableRow',
      'tableCell',
      'tableHeader',
      'codeBlock',
      'taskList',
      'taskItem',
      'placeholder',
      'typography',
      'characterCount',
      'textAlign',
      'mergeTag',
      'recordRef',
      'callout',
      'slashCommand',
    ];

    for (const name of required) {
      expect(extensionNames, `Missing extension: ${name}`).toContain(name);
    }

    editor.destroy();
  });

  it('exports SMART_DOC_EXTENSION_NAMES with all expected names', () => {
    for (const name of [
      'bold', 'italic', 'heading', 'table', 'codeBlock',
      'mergeTag', 'recordRef', 'callout', 'slashCommand',
    ]) {
      expect(SMART_DOC_EXTENSION_NAMES).toContain(name);
    }
  });

  it('includes heading extension (unlike chat editor)', () => {
    const editor = createTestEditor();
    const extensionNames = editor.extensionManager.extensions.map(
      (ext) => ext.name
    );

    expect(extensionNames).toContain('heading');
    expect(extensionNames).toContain('image');
    expect(extensionNames).toContain('table');

    editor.destroy();
  });

  it('uses custom placeholder text when provided', () => {
    const editor = createTestEditor({ placeholder: 'Write your template…' });
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === 'placeholder'
    );

    expect(ext?.options.placeholder).toBe('Write your template…');

    editor.destroy();
  });

  it('uses default placeholder when none provided', () => {
    const editor = createTestEditor();
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === 'placeholder'
    );

    expect(ext?.options.placeholder).toBe(
      'Start typing, or press "/" for commands…'
    );

    editor.destroy();
  });

  it('configures link with autolink enabled', () => {
    const editor = createTestEditor();
    const linkExt = editor.extensionManager.extensions.find(
      (e) => e.name === 'link'
    );

    expect(linkExt?.options.autolink).toBe(true);

    editor.destroy();
  });

  it('configures text alignment for headings and paragraphs', () => {
    const editor = createTestEditor();
    const alignExt = editor.extensionManager.extensions.find(
      (e) => e.name === 'textAlign'
    );

    expect(alignExt?.options.types).toContain('heading');
    expect(alignExt?.options.types).toContain('paragraph');

    editor.destroy();
  });

  it('configures table as resizable', () => {
    const editor = createTestEditor();
    const tableExt = editor.extensionManager.extensions.find(
      (e) => e.name === 'table'
    );

    expect(tableExt?.options.resizable).toBe(true);

    editor.destroy();
  });

  it('configures highlight as multicolor', () => {
    const editor = createTestEditor();
    const highlightExt = editor.extensionManager.extensions.find(
      (e) => e.name === 'highlight'
    );

    expect(highlightExt?.options.multicolor).toBe(true);

    editor.destroy();
  });

  it('configures task items as nestable', () => {
    const editor = createTestEditor();
    const taskItemExt = editor.extensionManager.extensions.find(
      (e) => e.name === 'taskItem'
    );

    expect(taskItemExt?.options.nested).toBe(true);

    editor.destroy();
  });

  // -- MergeTag custom node --

  describe('mergeTag', () => {
    it('inserts a merge tag via command', () => {
      const editor = createTestEditor();

      editor.commands.insertMergeTag({
        tableId: 'tbl-1',
        fieldId: 'fld-1',
        fallback: 'Company Name',
      });

      const json = editor.getJSON();
      const mergeTagNode = json.content?.flatMap(
        (block) => block.content ?? []
      ).find((n) => n.type === 'mergeTag') as Record<string, unknown> | undefined;

      expect(mergeTagNode).toBeDefined();
      const mergeAttrs = mergeTagNode?.attrs as Record<string, unknown> | undefined;
      expect(mergeAttrs?.tableId).toBe('tbl-1');
      expect(mergeAttrs?.fieldId).toBe('fld-1');
      expect(mergeAttrs?.fallback).toBe('Company Name');

      editor.destroy();
    });

    it('renders merge tag as HTML with data attributes', () => {
      const editor = createTestEditor();

      editor.commands.insertMergeTag({
        tableId: 'tbl-1',
        fieldId: 'fld-1',
        fallback: 'Name',
      });

      const html = editor.getHTML();
      expect(html).toContain('data-merge-tag');
      expect(html).toContain('{{Name}}');

      editor.destroy();
    });

    it('parses merge tag from HTML', () => {
      const editor = createTestEditor();

      editor.commands.setContent(
        '<p>Hello <span data-merge-tag data-table-id="tbl-2" data-field-id="fld-2" data-fallback="Email">{{Email}}</span></p>'
      );

      const json = editor.getJSON();
      const mergeTagNode = json.content?.flatMap(
        (block) => block.content ?? []
      ).find((n) => n.type === 'mergeTag');

      expect(mergeTagNode).toBeDefined();

      editor.destroy();
    });
  });

  // -- RecordRef custom node --

  describe('recordRef', () => {
    it('inserts a record ref via command', () => {
      const editor = createTestEditor();

      editor.commands.insertRecordRef({
        tableId: 'tbl-1',
        recordId: 'rec-1',
        displayText: 'Acme Corp',
      });

      const json = editor.getJSON();
      const refNode = json.content?.flatMap(
        (block) => block.content ?? []
      ).find((n) => n.type === 'recordRef') as Record<string, unknown> | undefined;

      expect(refNode).toBeDefined();
      const refAttrs = refNode?.attrs as Record<string, unknown> | undefined;
      expect(refAttrs?.tableId).toBe('tbl-1');
      expect(refAttrs?.recordId).toBe('rec-1');
      expect(refAttrs?.displayText).toBe('Acme Corp');

      editor.destroy();
    });

    it('renders record ref as HTML with data attributes', () => {
      const editor = createTestEditor();

      editor.commands.insertRecordRef({
        tableId: 'tbl-1',
        recordId: 'rec-1',
        displayText: 'Acme Corp',
      });

      const html = editor.getHTML();
      expect(html).toContain('data-record-ref');
      expect(html).toContain('Acme Corp');

      editor.destroy();
    });

    it('parses record ref from HTML', () => {
      const editor = createTestEditor();

      editor.commands.setContent(
        '<p>See <span data-record-ref data-table-id="tbl-1" data-record-id="rec-1">Invoice #42</span></p>'
      );

      const json = editor.getJSON();
      const refNode = json.content?.flatMap(
        (block) => block.content ?? []
      ).find((n) => n.type === 'recordRef');

      expect(refNode).toBeDefined();

      editor.destroy();
    });
  });

  // -- Callout custom node --

  describe('callout', () => {
    it('inserts a callout via command', () => {
      const editor = createTestEditor();

      editor.commands.insertCallout({ color: 'warning' });

      const json = editor.getJSON();
      const calloutNode = json.content?.find((n) => n.type === 'callout');

      expect(calloutNode).toBeDefined();
      expect(calloutNode?.attrs?.color).toBe('warning');
      expect(calloutNode?.attrs?.emoji).toBe('⚠️');

      editor.destroy();
    });

    it('defaults to info variant when no color specified', () => {
      const editor = createTestEditor();

      editor.commands.insertCallout();

      const json = editor.getJSON();
      const calloutNode = json.content?.find((n) => n.type === 'callout');

      expect(calloutNode?.attrs?.color).toBe('info');
      expect(calloutNode?.attrs?.emoji).toBe('ℹ️');

      editor.destroy();
    });

    it('renders callout as HTML with data attributes', () => {
      const editor = createTestEditor();

      editor.commands.insertCallout({ color: 'success' });

      const html = editor.getHTML();
      expect(html).toContain('data-callout');
      expect(html).toContain('data-callout-variant="success"');

      editor.destroy();
    });

    it('supports all four variants', () => {
      const variants = ['info', 'warning', 'success', 'error'] as const;

      for (const variant of variants) {
        const editor = createTestEditor();
        editor.commands.insertCallout({ color: variant });

        const json = editor.getJSON();
        const calloutNode = json.content?.find((n) => n.type === 'callout');
        expect(calloutNode?.attrs?.color).toBe(variant);

        editor.destroy();
      }
    });

    it('parses callout from HTML', () => {
      const editor = createTestEditor();

      editor.commands.setContent(
        '<div data-callout data-callout-variant="error"><span>🚫</span><div><p>Something failed</p></div></div>'
      );

      const json = editor.getJSON();
      const calloutNode = json.content?.find((n) => n.type === 'callout');

      expect(calloutNode).toBeDefined();

      editor.destroy();
    });
  });

  // -- Formatting commands inherited from StarterKit --

  it('supports heading commands', () => {
    const editor = createTestEditor();

    editor.commands.setContent('<p>Title</p>');
    editor.commands.focus();
    editor.commands.setHeading({ level: 1 });

    const json = editor.getJSON();
    const hasHeading = json.content?.some(
      (n) => n.type === 'heading' && n.attrs?.level === 1
    );
    expect(hasHeading).toBe(true);

    editor.destroy();
  });

  it('supports bold mark command', () => {
    const editor = createTestEditor();

    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    editor.commands.setBold();
    expect(editor.isActive('bold')).toBe(true);

    editor.destroy();
  });

  it('supports underline mark command', () => {
    const editor = createTestEditor();

    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    editor.commands.setUnderline();
    expect(editor.isActive('underline')).toBe(true);

    editor.destroy();
  });

  it('supports task list creation', () => {
    const editor = createTestEditor();

    editor.commands.toggleTaskList();
    expect(editor.isActive('taskList')).toBe(true);

    editor.destroy();
  });
});
