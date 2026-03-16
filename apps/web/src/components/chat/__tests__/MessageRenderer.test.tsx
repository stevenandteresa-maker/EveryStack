// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { JSONContent } from '@tiptap/core';
import { MessageRenderer } from '../MessageRenderer';

function renderContent(content: JSONContent) {
  return render(<MessageRenderer content={content} />);
}

function doc(...nodes: JSONContent[]): JSONContent {
  return { type: 'doc', content: nodes };
}

function paragraph(...children: JSONContent[]): JSONContent {
  return { type: 'paragraph', content: children };
}

function text(t: string, marks?: JSONContent['marks']): JSONContent {
  return { type: 'text', text: t, marks };
}

describe('MessageRenderer', () => {
  it('renders plain text', () => {
    renderContent(doc(paragraph(text('Hello world'))));
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders bold text', () => {
    renderContent(
      doc(paragraph(text('bold text', [{ type: 'bold' }]))),
    );
    const el = screen.getByText('bold text');
    expect(el.closest('strong')).toBeInTheDocument();
  });

  it('renders italic text', () => {
    renderContent(
      doc(paragraph(text('italic text', [{ type: 'italic' }]))),
    );
    const el = screen.getByText('italic text');
    expect(el.closest('em')).toBeInTheDocument();
  });

  it('renders underline text', () => {
    renderContent(
      doc(paragraph(text('underline text', [{ type: 'underline' }]))),
    );
    const el = screen.getByText('underline text');
    expect(el.closest('u')).toBeInTheDocument();
  });

  it('renders strikethrough text', () => {
    renderContent(
      doc(paragraph(text('struck text', [{ type: 'strike' }]))),
    );
    const el = screen.getByText('struck text');
    expect(el.closest('s')).toBeInTheDocument();
  });

  it('renders inline code', () => {
    renderContent(
      doc(paragraph(text('const x = 1', [{ type: 'code' }]))),
    );
    const el = screen.getByText('const x = 1');
    expect(el.closest('code')).toBeInTheDocument();
  });

  it('renders links with href', () => {
    renderContent(
      doc(
        paragraph(
          text('click me', [
            { type: 'link', attrs: { href: 'https://example.com' } },
          ]),
        ),
      ),
    );
    const el = screen.getByText('click me');
    const link = el.closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders bullet list', () => {
    renderContent(
      doc({
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph(text('Item 1'))] },
          { type: 'listItem', content: [paragraph(text('Item 2'))] },
        ],
      }),
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    const container = screen.getByTestId('message-renderer');
    expect(container.querySelector('ul')).toBeInTheDocument();
  });

  it('renders ordered list', () => {
    renderContent(
      doc({
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [paragraph(text('Step 1'))] },
        ],
      }),
    );
    const container = screen.getByTestId('message-renderer');
    expect(container.querySelector('ol')).toBeInTheDocument();
  });

  it('renders blockquote', () => {
    renderContent(
      doc({
        type: 'blockquote',
        content: [paragraph(text('quoted text'))],
      }),
    );
    const container = screen.getByTestId('message-renderer');
    expect(container.querySelector('blockquote')).toBeInTheDocument();
    expect(screen.getByText('quoted text')).toBeInTheDocument();
  });

  it('renders mention pill with teal @Name', () => {
    renderContent(
      doc(
        paragraph({
          type: 'mention',
          attrs: { id: 'user-1', label: 'Alice' },
        }),
      ),
    );
    const pill = screen.getByTestId('mention-pill');
    expect(pill).toHaveTextContent('@Alice');
    expect(pill).toHaveClass('bg-teal-100', 'text-teal-800');
  });

  it('renders mention with id fallback when label is missing', () => {
    renderContent(
      doc(
        paragraph({
          type: 'mention',
          attrs: { id: 'user-42' },
        }),
      ),
    );
    expect(screen.getByTestId('mention-pill')).toHaveTextContent('@user-42');
  });

  it('renders combined marks (bold + italic)', () => {
    renderContent(
      doc(
        paragraph(
          text('bold italic', [{ type: 'bold' }, { type: 'italic' }]),
        ),
      ),
    );
    const el = screen.getByText('bold italic');
    expect(el.closest('strong')).toBeInTheDocument();
    expect(el.closest('em')).toBeInTheDocument();
  });

  it('renders hard break', () => {
    renderContent(
      doc(paragraph(text('line 1'), { type: 'hardBreak' }, text('line 2'))),
    );
    const container = screen.getByTestId('message-renderer');
    expect(container.querySelector('br')).toBeInTheDocument();
  });

  it('does not create editor instances (no contenteditable)', () => {
    const { container } = renderContent(doc(paragraph(text('test'))));
    expect(container.querySelector('[contenteditable]')).toBeNull();
  });

  it('handles empty doc gracefully', () => {
    renderContent(doc());
    expect(screen.getByTestId('message-renderer')).toBeInTheDocument();
  });
});
