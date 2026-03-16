'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Pin,
  Bookmark,
  Reply,
} from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageRenderer } from './MessageRenderer';
import { EmojiReactions, type ReactionsMap } from './EmojiReactions';
import { ChatEditor } from './ChatEditor';

/** Thread message shape consumed by MessageItem */
export interface ThreadMessage {
  id: string;
  thread_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  content: JSONContent;
  message_type: string; // known values: 'user', 'system'
  reactions: ReactionsMap;
  is_edited: boolean;
  is_deleted: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface MessageItemProps {
  message: ThreadMessage;
  currentUserId: string;
  onEdit?: (messageId: string, content: JSONContent) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onSave?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
}

/**
 * MessageItem — single message in a thread or DM.
 *
 * Handles: user messages (avatar, name, timestamp, content, reactions, hover menu),
 * system messages (centered muted text), deleted placeholder, edit mode.
 */
export function MessageItem({
  message,
  currentUserId,
  onEdit,
  onDelete,
  onPin,
  onSave,
  onReply,
  onReactionToggle,
}: MessageItemProps) {
  const t = useTranslations('chat.messageItem');
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isOwnMessage = message.author_id === currentUserId;
  const isSystem = message.message_type === 'system';

  const handleEditSave = useCallback(
    (content: JSONContent) => {
      onEdit?.(message.id, content);
      setIsEditing(false);
    },
    [message.id, onEdit],
  );

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  // System messages: centered, muted, no interactions
  if (isSystem) {
    return (
      <div
        className="flex justify-center px-4 py-1"
        data-testid="system-message"
      >
        <span className="text-xs text-muted-foreground">
          <MessageRenderer content={message.content} className="inline" />
        </span>
      </div>
    );
  }

  // Deleted messages: placeholder
  if (message.is_deleted) {
    return (
      <div
        className="flex items-start gap-3 px-4 py-2"
        data-testid="deleted-message"
      >
        <MessageAvatar name={message.author_name} avatar={message.author_avatar} />
        <div className="min-w-0 flex-1">
          <MessageHeader
            name={message.author_name}
            timestamp={message.created_at}
          />
          <p className="text-sm italic text-muted-foreground">
            {t('deleted')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 px-4 py-2 transition-colors',
        isHovered && 'bg-muted/50',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="message-item"
      data-message-id={message.id}
    >
      <MessageAvatar name={message.author_name} avatar={message.author_avatar} />

      <div className="min-w-0 flex-1">
        <MessageHeader
          name={message.author_name}
          timestamp={message.created_at}
          isEdited={message.is_edited}
        />

        {isEditing ? (
          <div className="mt-1" data-testid="message-edit-mode">
            <ChatEditor
              onSend={handleEditSave}
              placeholder={t('editPlaceholder')}
            />
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t('editHintSave')}</span>
              <span>·</span>
              <button
                type="button"
                className="text-muted-foreground underline hover:text-foreground"
                onClick={handleEditCancel}
              >
                {t('editHintCancel')}
              </button>
            </div>
          </div>
        ) : (
          <MessageRenderer content={message.content} />
        )}

        {/* Emoji reactions */}
        {!isEditing && onReactionToggle && (
          <EmojiReactions
            reactions={message.reactions}
            currentUserId={currentUserId}
            onToggle={(emoji) => onReactionToggle(message.id, emoji)}
            className="mt-1"
          />
        )}
      </div>

      {/* Hover action menu */}
      {isHovered && !isEditing && (
        <div
          className="absolute -top-3 right-2 z-10"
          data-testid="message-hover-menu"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded border bg-background shadow-sm',
                  'text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                )}
                aria-label={t('moreActions')}
                data-testid="message-menu-trigger"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {isOwnMessage && onEdit && (
                <DropdownMenuItem
                  onClick={() => setIsEditing(true)}
                  data-testid="message-action-edit"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('edit')}
                </DropdownMenuItem>
              )}
              {onReply && (
                <DropdownMenuItem
                  onClick={() => onReply(message.id)}
                  data-testid="message-action-reply"
                >
                  <Reply className="mr-2 h-4 w-4" />
                  {t('reply')}
                </DropdownMenuItem>
              )}
              {onPin && (
                <DropdownMenuItem
                  onClick={() => onPin(message.id)}
                  data-testid="message-action-pin"
                >
                  <Pin className="mr-2 h-4 w-4" />
                  {message.is_pinned ? t('unpin') : t('pin')}
                </DropdownMenuItem>
              )}
              {onSave && (
                <DropdownMenuItem
                  onClick={() => onSave(message.id)}
                  data-testid="message-action-save"
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  {t('save')}
                </DropdownMenuItem>
              )}
              {isOwnMessage && onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(message.id)}
                  className="text-destructive focus:text-destructive"
                  data-testid="message-action-delete"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// --- Internal sub-components ---

function MessageAvatar({
  name,
  avatar,
}: {
  name: string;
  avatar?: string;
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
      data-testid="message-avatar"
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt={name}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );
}

function MessageHeader({
  name,
  timestamp,
  isEdited,
}: {
  name: string;
  timestamp: string;
  isEdited?: boolean;
}) {
  const t = useTranslations('chat.messageItem');

  const formatted = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(timestamp));

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-semibold" data-testid="message-author">
        {name}
      </span>
      <span
        className="text-xs text-muted-foreground"
        data-testid="message-timestamp"
      >
        {formatted}
      </span>
      {isEdited && (
        <span
          className="text-xs text-muted-foreground"
          data-testid="message-edited"
        >
          {t('edited')}
        </span>
      )}
    </div>
  );
}
