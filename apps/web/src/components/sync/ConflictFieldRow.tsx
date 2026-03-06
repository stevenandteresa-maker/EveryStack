'use client';

// ---------------------------------------------------------------------------
// ConflictFieldRow — renders a single field's conflict with local, remote,
// and base values side-by-side, plus Keep/Keep/Edit action buttons.
//
// Used standalone (single-field modal) or in a list (multi-field modal).
// Field values are formatted via FieldTypeRegistry when a transform exists,
// falling back to JSON.stringify for unsupported types.
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { fieldTypeRegistry } from '@everystack/shared/sync';
import type { PlatformFieldConfig, CanonicalValue } from '@everystack/shared/sync';
import type {
  ConflictItem,
  ConflictResolution,
} from './conflict-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConflictFieldRowProps {
  conflict: ConflictItem;
  resolution: ConflictResolution | null;
  onResolve: (resolution: ConflictResolution) => void;
}

// ---------------------------------------------------------------------------
// Value formatter — uses FieldTypeRegistry display when available
// ---------------------------------------------------------------------------

function formatFieldValue(
  value: unknown,
  platform: string,
  platformFieldType: string,
): string {
  if (value === null || value === undefined) {
    return '—';
  }

  // Attempt registry-based formatting: convert canonical → platform-native
  // string representation for display purposes.
  if (fieldTypeRegistry.has(platform, platformFieldType)) {
    try {
      const transform = fieldTypeRegistry.get(platform, platformFieldType);
      const fieldConfig: PlatformFieldConfig = {
        externalFieldId: '',
        name: '',
        platformFieldType,
      };
      const nativeValue = transform.fromCanonical(
        value as CanonicalValue,
        fieldConfig,
      );
      if (typeof nativeValue === 'string') return nativeValue;
      if (typeof nativeValue === 'number' || typeof nativeValue === 'boolean') {
        return String(nativeValue);
      }
      // Arrays/objects: present as readable string
      return JSON.stringify(nativeValue);
    } catch {
      // Fall through to default formatting
    }
  }

  // Default: render primitives directly, objects as JSON
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConflictFieldRow({
  conflict,
  resolution,
  onResolve,
}: ConflictFieldRowProps) {
  const t = useTranslations('sync_conflicts');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const isResolved = resolution !== null;

  const localDisplay = formatFieldValue(
    conflict.localValue,
    conflict.platform,
    conflict.platformFieldType,
  );
  const remoteDisplay = formatFieldValue(
    conflict.remoteValue,
    conflict.platform,
    conflict.platformFieldType,
  );
  const baseDisplay = formatFieldValue(
    conflict.baseValue,
    conflict.platform,
    conflict.platformFieldType,
  );

  const platformLabel = conflict.platform.charAt(0).toUpperCase() + conflict.platform.slice(1);

  const handleKeepLocal = useCallback(() => {
    setIsEditing(false);
    onResolve({ conflictId: conflict.id, choice: 'keep_local' });
  }, [conflict.id, onResolve]);

  const handleKeepRemote = useCallback(() => {
    setIsEditing(false);
    onResolve({ conflictId: conflict.id, choice: 'keep_remote' });
  }, [conflict.id, onResolve]);

  const handleStartEdit = useCallback(() => {
    setEditValue(localDisplay === '—' ? '' : localDisplay);
    setIsEditing(true);
  }, [localDisplay]);

  const handleConfirmEdit = useCallback(() => {
    setIsEditing(false);
    onResolve({
      conflictId: conflict.id,
      choice: 'edit',
      editedValue: editValue,
    });
  }, [conflict.id, editValue, onResolve]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Determine which value was chosen for the resolved badge
  const resolvedDisplay =
    resolution?.choice === 'keep_local'
      ? localDisplay
      : resolution?.choice === 'keep_remote'
        ? remoteDisplay
        : resolution?.choice === 'edit'
          ? formatFieldValue(
              resolution.editedValue,
              conflict.platform,
              conflict.platformFieldType,
            )
          : null;

  return (
    <div
      className="rounded-lg border p-4"
      data-testid={`conflict-row-${conflict.fieldId}`}
    >
      {/* Field name header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold">{conflict.fieldName}</span>
        {isResolved && (
          <Badge
            className="gap-1 border border-green-200 bg-green-50 text-green-700"
            data-testid={`conflict-resolved-badge-${conflict.fieldId}`}
          >
            <Check className="h-3 w-3" />
            {t('resolved')}
          </Badge>
        )}
      </div>

      {/* Resolved state — show chosen value */}
      {isResolved && resolvedDisplay !== null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-green-600" />
          <span>{resolvedDisplay}</span>
        </div>
      ) : (
        <>
          {/* Side-by-side value comparison */}
          <div className="mb-3 grid grid-cols-2 gap-3">
            {/* Local (EveryStack) value */}
            <div
              className="rounded-md border bg-muted/30 p-3"
              data-testid={`conflict-local-${conflict.fieldId}`}
            >
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('local_label')}
              </span>
              <span className="block text-sm">{localDisplay}</span>
              {conflict.localChangedBy && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t('changed_by', { name: conflict.localChangedBy })}
                  {conflict.localChangedAt && ` (${conflict.localChangedAt})`}
                </span>
              )}
            </div>

            {/* Remote (Platform) value */}
            <div
              className="rounded-md border bg-muted/30 p-3"
              data-testid={`conflict-remote-${conflict.fieldId}`}
            >
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('remote_label', { platform: platformLabel })}
              </span>
              <span className="block text-sm">{remoteDisplay}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {t('changed_in_platform', { platform: platformLabel })}
              </span>
            </div>
          </div>

          {/* Base value */}
          <p className="mb-3 text-xs text-muted-foreground">
            {t('base_value', { value: baseDisplay })}
          </p>

          {/* Edit mode — inline input */}
          {isEditing ? (
            <div className="flex items-center gap-2" data-testid={`conflict-edit-${conflict.fieldId}`}>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-10 flex-1"
                data-testid={`conflict-edit-input-${conflict.fieldId}`}
                autoFocus
              />
              <Button
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                onClick={handleConfirmEdit}
                data-testid={`conflict-edit-confirm-${conflict.fieldId}`}
              >
                {t('confirm')}
              </Button>
              <Button
                size="sm"
                variant="default"
                className="min-h-[44px] min-w-[44px]"
                onClick={handleCancelEdit}
                data-testid={`conflict-edit-cancel-${conflict.fieldId}`}
              >
                {t('cancel_edit')}
              </Button>
            </div>
          ) : (
            /* Action buttons */
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="default"
                className="min-h-[44px]"
                onClick={handleKeepLocal}
                data-testid={`conflict-keep-local-${conflict.fieldId}`}
              >
                {t('keep_local')}
              </Button>
              <Button
                size="sm"
                variant="default"
                className="min-h-[44px]"
                onClick={handleKeepRemote}
                data-testid={`conflict-keep-remote-${conflict.fieldId}`}
              >
                {t('keep_remote', { platform: platformLabel })}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-[44px] gap-1"
                onClick={handleStartEdit}
                data-testid={`conflict-edit-btn-${conflict.fieldId}`}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('edit')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
