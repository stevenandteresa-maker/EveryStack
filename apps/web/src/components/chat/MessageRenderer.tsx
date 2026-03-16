'use client';

import type { JSONContent } from '@tiptap/core';
import { cn } from '@/lib/utils';

interface MessageRendererProps {
  content: JSONContent;
  className?: string;
}

/**
 * MessageRenderer — read-only TipTap JSON → styled HTML.
 *
 * Renders all chat-supported marks and nodes WITHOUT creating
 * TipTap editor instances. Pure React element tree.
 */
export function MessageRenderer({ content, className }: MessageRendererProps) {
  return (
    <div
      className={cn('prose prose-sm max-w-none break-words', className)}
      data-testid="message-renderer"
    >
      {renderNode(content)}
    </div>
  );
}

function renderNode(node: JSONContent, key?: string | number): React.ReactNode {
  if (!node) return null;

  switch (node.type) {
    case 'doc':
      return renderChildren(node);

    case 'paragraph':
      return (
        <p key={key} className="mb-1 last:mb-0">
          {renderChildren(node)}
        </p>
      );

    case 'text':
      return renderTextWithMarks(node, key);

    case 'bulletList':
      return (
        <ul key={key} className="mb-1 list-disc pl-4 last:mb-0">
          {renderChildren(node)}
        </ul>
      );

    case 'orderedList':
      return (
        <ol key={key} className="mb-1 list-decimal pl-4 last:mb-0">
          {renderChildren(node)}
        </ol>
      );

    case 'listItem':
      return <li key={key}>{renderChildren(node)}</li>;

    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="mb-1 border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground last:mb-0"
        >
          {renderChildren(node)}
        </blockquote>
      );

    case 'mention':
      return (
        <span
          key={key}
          className="inline-flex items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-800"
          data-mention-id={node.attrs?.id}
          data-testid="mention-pill"
        >
          @{node.attrs?.label ?? node.attrs?.id}
        </span>
      );

    case 'hardBreak':
      return <br key={key} />;

    default:
      // Fallback: render children if present
      return renderChildren(node);
  }
}

function renderChildren(node: JSONContent): React.ReactNode {
  if (!node.content || node.content.length === 0) return null;
  return node.content.map((child, i) => renderNode(child, i));
}

function renderTextWithMarks(
  node: JSONContent,
  key?: string | number,
): React.ReactNode {
  const text = node.text;
  if (!text) return null;

  if (!node.marks || node.marks.length === 0) {
    return <span key={key}>{text}</span>;
  }

  let element: React.ReactNode = text;

  for (const mark of node.marks) {
    switch (mark.type) {
      case 'bold':
        element = <strong>{element}</strong>;
        break;
      case 'italic':
        element = <em>{element}</em>;
        break;
      case 'underline':
        element = <u>{element}</u>;
        break;
      case 'strike':
        element = <s>{element}</s>;
        break;
      case 'code':
        element = (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            {element}
          </code>
        );
        break;
      case 'link':
        element = (
          <a
            href={mark.attrs?.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 underline"
          >
            {element}
          </a>
        );
        break;
      default:
        break;
    }
  }

  return <span key={key}>{element}</span>;
}
