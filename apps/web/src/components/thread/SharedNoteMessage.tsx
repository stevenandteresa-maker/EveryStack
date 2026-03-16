'use client';

/**
 * SharedNoteMessage — visual wrapper for messages where source_note_id
 * is set (shared from Personal Notes via Share to Thread action).
 *
 * Visual distinction: note icon badge, ws-accent left border, inset container.
 *
 * @see docs/reference/communications.md § source_note_id
 */

import type { ReactNode } from 'react';

interface SharedNoteMessageProps {
  children: ReactNode;
}

export function SharedNoteMessage({ children }: SharedNoteMessageProps) {
  return (
    <div
      className="border-l-[3px] border-teal-500 bg-muted/40 pl-3 rounded-r-md"
      data-testid="shared-note-message"
    >
      <div className="flex items-start gap-1.5 py-0.5">
        <span className="text-sm shrink-0" aria-hidden="true">
          📝
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
