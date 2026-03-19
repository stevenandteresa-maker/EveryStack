'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useTranslations } from 'next-intl';
import { GripVertical, Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BlockHandleProps {
  editor: Editor;
}

interface HandlePosition {
  top: number;
  blockPos: number;
}

/**
 * BlockHandle — hover handle shown to the left of blocks.
 *
 * Provides drag-reorder (via drag start) and a context menu
 * with delete, duplicate, and move up/down actions.
 */
export function BlockHandle({ editor }: BlockHandleProps) {
  const t = useTranslations('smartDocEditor.blockHandle');
  const [handle, setHandle] = useState<HandlePosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editorElement = editor.view.dom;

    const handleMouseMove = (event: MouseEvent) => {
      if (isDragging) return;

      const editorRect = editorElement.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;

      // Only show handle when hovering near the left edge of the editor
      if (x < editorRect.left - 40 || x > editorRect.left + 20) {
        setHandle(null);
        return;
      }

      // Find the block node at the cursor position
      const pos = editor.view.posAtCoords({ left: editorRect.left + 10, top: y });
      if (!pos) {
        setHandle(null);
        return;
      }

      const resolvedPos = editor.state.doc.resolve(pos.pos);
      // Get the top-level block (depth 1)
      const blockDepth = Math.min(resolvedPos.depth, 1);
      const blockStart = resolvedPos.before(blockDepth + 1);

      try {
        const domNode = editor.view.nodeDOM(blockStart);
        if (!domNode || !(domNode instanceof HTMLElement)) {
          setHandle(null);
          return;
        }

        const blockRect = domNode.getBoundingClientRect();
        const parentRect = containerRef.current?.parentElement?.getBoundingClientRect();

        if (parentRect) {
          setHandle({
            top: blockRect.top - parentRect.top,
            blockPos: blockStart,
          });
        }
      } catch {
        setHandle(null);
      }
    };

    const handleMouseLeave = () => {
      if (!isDragging) {
        setHandle(null);
      }
    };

    editorElement.addEventListener('mousemove', handleMouseMove);
    editorElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      editorElement.removeEventListener('mousemove', handleMouseMove);
      editorElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [editor, isDragging]);

  const getBlockNode = useCallback(() => {
    if (handle === null) return null;
    try {
      return editor.state.doc.nodeAt(handle.blockPos);
    } catch {
      return null;
    }
  }, [editor, handle]);

  const handleDelete = useCallback(() => {
    const node = getBlockNode();
    if (!node || handle === null) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: handle.blockPos, to: handle.blockPos + node.nodeSize })
      .run();
    setHandle(null);
  }, [editor, handle, getBlockNode]);

  const handleDuplicate = useCallback(() => {
    const node = getBlockNode();
    if (!node || handle === null) return;
    const endPos = handle.blockPos + node.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(endPos, node.toJSON())
      .run();
  }, [editor, handle, getBlockNode]);

  const handleMoveUp = useCallback(() => {
    const node = getBlockNode();
    if (!node || handle === null || handle.blockPos === 0) return;
    const resolvedPos = editor.state.doc.resolve(handle.blockPos);
    if (resolvedPos.index(0) === 0) return;

    const prevNode = editor.state.doc.child(resolvedPos.index(0) - 1);
    const prevStart = handle.blockPos - prevNode.nodeSize;

    editor
      .chain()
      .focus()
      .deleteRange({ from: handle.blockPos, to: handle.blockPos + node.nodeSize })
      .insertContentAt(prevStart, node.toJSON())
      .run();
  }, [editor, handle, getBlockNode]);

  const handleMoveDown = useCallback(() => {
    const node = getBlockNode();
    if (!node || handle === null) return;
    const resolvedPos = editor.state.doc.resolve(handle.blockPos);
    const parentChildCount = editor.state.doc.childCount;
    if (resolvedPos.index(0) >= parentChildCount - 1) return;

    const nextNode = editor.state.doc.child(resolvedPos.index(0) + 1);
    const endPos = handle.blockPos + node.nodeSize;
    const insertPos = endPos + nextNode.nodeSize;

    editor
      .chain()
      .focus()
      .deleteRange({ from: handle.blockPos, to: endPos })
      .insertContentAt(insertPos - node.nodeSize, node.toJSON())
      .run();
  }, [editor, handle, getBlockNode]);

  const handleDragStart = useCallback(
    (event: React.DragEvent) => {
      if (handle === null) return;
      const node = getBlockNode();
      if (!node) return;

      setIsDragging(true);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-everystack-block', JSON.stringify({
        pos: handle.blockPos,
        nodeSize: node.nodeSize,
      }));
    },
    [handle, getBlockNode],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!handle) return null;

  return (
    <div ref={containerRef}>
      <div
        className="absolute -left-8 flex items-center"
        style={{ top: handle.top }}
        data-testid="block-handle"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              aria-label={t('dragHandle')}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="left">
            <DropdownMenuItem onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('delete')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              {t('duplicate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMoveUp}>
              <ArrowUp className="mr-2 h-4 w-4" />
              {t('moveUp')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMoveDown}>
              <ArrowDown className="mr-2 h-4 w-4" />
              {t('moveDown')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
