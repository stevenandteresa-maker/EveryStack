'use client';

/**
 * GroupDMHeader — header for group DM conversations.
 *
 * Displays editable group name, participant avatars (3–8 cap),
 * "Add participant" button, and settings icon.
 *
 * @see docs/reference/communications.md § Group DMs
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PresenceIndicator } from '@/components/presence/PresenceIndicator';
import type { PresenceState } from '@/components/presence/use-presence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupParticipant {
  id: string;
  name: string;
  avatar?: string;
}

interface GroupDMHeaderProps {
  groupName: string;
  participants: GroupParticipant[];
  onNameChange?: (name: string) => void;
  onAddParticipant?: () => void;
  onOpenSettings?: () => void;
  /** Presence map for showing online status on participant avatars */
  presenceMap?: Record<string, PresenceState>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PARTICIPANTS = 8;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GroupDMHeader({
  groupName,
  participants,
  onNameChange,
  onAddParticipant,
  onOpenSettings,
  presenceMap,
}: GroupDMHeaderProps) {
  const t = useTranslations('chat.groupDm');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(groupName);

  const canAddParticipant = participants.length < MAX_PARTICIPANTS;

  const handleSaveName = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== groupName) {
      onNameChange?.(trimmed);
    } else {
      setEditValue(groupName);
    }
    setIsEditing(false);
  }, [editValue, groupName, onNameChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveName();
      } else if (e.key === 'Escape') {
        setEditValue(groupName);
        setIsEditing(false);
      }
    },
    [handleSaveName, groupName],
  );

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b"
      data-testid="group-dm-header"
    >
      {/* Left: group name + participant avatars */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Group name — editable */}
        {isEditing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleKeyDown}
            className="h-7 text-sm font-semibold max-w-[200px]"
            autoFocus
            data-testid="group-name-input"
          />
        ) : (
          <button
            type="button"
            className="text-sm font-semibold truncate hover:underline cursor-pointer"
            onClick={() => {
              if (onNameChange) {
                setIsEditing(true);
                setEditValue(groupName);
              }
            }}
            disabled={!onNameChange}
            data-testid="group-name-display"
          >
            {groupName}
          </button>
        )}

        {/* Participant avatars */}
        <div className="flex items-center -space-x-1.5">
          {participants.slice(0, MAX_PARTICIPANTS).map((p) => (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <div
                  className="relative h-6 w-6"
                  data-testid="participant-avatar"
                >
                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium uppercase">
                    {p.avatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span>{p.name.charAt(0)}</span>
                    )}
                  </div>
                  {presenceMap?.[p.id] && (
                    <PresenceIndicator
                      status={presenceMap[p.id]!}
                      size="small"
                      className="absolute -bottom-0.5 -right-0.5 ring-1 ring-background"
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{p.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Participant count */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {t('participantCount', { count: participants.length, max: MAX_PARTICIPANTS })}
        </span>
      </div>

      {/* Right: add participant + settings */}
      <div className="flex items-center gap-1 shrink-0">
        {canAddParticipant && onAddParticipant && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onAddParticipant}
            aria-label={t('addParticipant')}
            data-testid="add-participant-button"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        )}
        {onOpenSettings && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onOpenSettings}
            aria-label={t('settings')}
            data-testid="group-settings-button"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
