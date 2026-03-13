'use client';

/**
 * Individual override view — "By Person" tab in the permission config panel.
 *
 * Shows a person selector (workspace members with view access), then displays
 * the effective (fully resolved) permission per field for the selected person.
 * Fields with active individual overrides are visually distinguished and can
 * be added, changed, or removed.
 *
 * Override ceiling: individual overrides cannot exceed the field-level ceiling
 * (e.g. if member_edit=false, cannot set read_write for that field).
 *
 * @see docs/reference/permissions.md § Individual Override View
 */

import { useState, useCallback, useMemo, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PermissionStateBadge } from './PermissionStateBadge';
import { updateViewPermissions } from '@/actions/permission-actions';
import { resolveFieldPermission } from '@everystack/shared/auth';
import type {
  FieldPermissionState,
  IndividualOverride,
  ViewPermissions,
  ResolvedPermissionContext,
} from '@everystack/shared/auth';
import type { EffectiveRole } from '@everystack/shared/auth';
import type { Field } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceMemberInfo {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: EffectiveRole;
}

export interface IndividualOverrideViewProps {
  viewId: string;
  tableId: string;
  tenantId: string;
  workspaceId: string;
  fields: Field[];
  viewPermissions: ViewPermissions;
  /** Workspace members who have access to this view. */
  members: WorkspaceMemberInfo[];
  /** Field ID → fields.permissions JSONB (global defaults). */
  fieldPermissions: Record<string, Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATES: FieldPermissionState[] = ['read_write', 'read_only', 'hidden'];

const STATE_LABEL_KEY: Record<FieldPermissionState, string> = {
  read_write: 'fullAccess',
  read_only: 'readOnly',
  hidden: 'hidden',
};

/**
 * Compute the field-level ceiling for a given field + role.
 * This is the maximum permission the field's global settings allow.
 */
function getFieldCeiling(
  fieldPerms: Record<string, unknown> | undefined,
  role: EffectiveRole,
): FieldPermissionState {
  if (!fieldPerms) return 'read_write';

  if (
    fieldPerms.member_edit === false &&
    (role === 'team_member' || role === 'manager')
  ) {
    return 'read_only';
  }

  if (fieldPerms.viewer_visible === false && role === 'viewer') {
    return 'hidden';
  }

  return 'read_write';
}

/**
 * Resolve what the role-level state would be for a user on a given field
 * (without individual overrides applied). This is steps 1–5 of the cascade.
 */
function resolveRoleLevelState(
  fieldId: string,
  context: ResolvedPermissionContext,
): FieldPermissionState {
  // Build a context without individual overrides
  const contextWithoutOverrides: ResolvedPermissionContext = {
    ...context,
    viewPermissions: {
      ...context.viewPermissions,
      fieldPermissions: {
        ...context.viewPermissions.fieldPermissions,
        individualOverrides: [],
      },
    },
  };
  return resolveFieldPermission(fieldId, contextWithoutOverrides);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IndividualOverrideView({
  viewId,
  tableId,
  tenantId: _tenantId,
  workspaceId,
  fields: tableFields,
  viewPermissions,
  members,
  fieldPermissions,
}: IndividualOverrideViewProps) {
  const t = useTranslations('permissions');
  const [isPending, startTransition] = useTransition();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local draft of individual overrides (mutable copy)
  const [draftOverrides, setDraftOverrides] = useState<IndividualOverride[]>(
    () => [...viewPermissions.fieldPermissions.individualOverrides],
  );

  const selectedMember = useMemo(
    () => members.find((m) => m.userId === selectedUserId) ?? null,
    [members, selectedUserId],
  );

  const fieldIds = useMemo(
    () => tableFields.map((f) => f.id),
    [tableFields],
  );

  // Build the resolution context for the selected user
  const resolutionContext = useMemo((): ResolvedPermissionContext | null => {
    if (!selectedMember) return null;

    return {
      userId: selectedMember.userId,
      effectiveRole: selectedMember.role,
      tableId,
      viewId,
      fieldIds,
      viewFieldOverrides: fieldIds, // All fields exposed in this view
      viewPermissions: {
        ...viewPermissions,
        fieldPermissions: {
          ...viewPermissions.fieldPermissions,
          individualOverrides: draftOverrides,
        },
      },
      fieldPermissions,
    };
  }, [selectedMember, tableId, viewId, fieldIds, viewPermissions, draftOverrides, fieldPermissions]);

  // Compute effective permission per field for the selected user
  const effectivePermissions = useMemo((): Map<string, FieldPermissionState> => {
    if (!resolutionContext) return new Map();

    const result = new Map<string, FieldPermissionState>();
    for (const fieldId of fieldIds) {
      result.set(fieldId, resolveFieldPermission(fieldId, resolutionContext));
    }
    return result;
  }, [resolutionContext, fieldIds]);

  // Compute role-level states (without individual overrides) for comparison
  const roleLevelStates = useMemo((): Map<string, FieldPermissionState> => {
    if (!resolutionContext) return new Map();

    const result = new Map<string, FieldPermissionState>();
    for (const fieldId of fieldIds) {
      result.set(fieldId, resolveRoleLevelState(fieldId, resolutionContext));
    }
    return result;
  }, [resolutionContext, fieldIds]);

  // Get override for the selected user + field
  const getOverride = useCallback(
    (fieldId: string): IndividualOverride | undefined => {
      if (!selectedUserId) return undefined;
      return draftOverrides.find(
        (o) => o.fieldId === fieldId && o.userId === selectedUserId && o.tableId === tableId,
      );
    },
    [draftOverrides, selectedUserId, tableId],
  );

  const handleAddOverride = useCallback(
    (fieldId: string, state: FieldPermissionState) => {
      if (!selectedUserId) return;

      setDraftOverrides((prev) => {
        // Remove existing override for this field+user if any
        const filtered = prev.filter(
          (o) => !(o.fieldId === fieldId && o.userId === selectedUserId && o.tableId === tableId),
        );
        return [
          ...filtered,
          { tableId, userId: selectedUserId, fieldId, accessState: state },
        ];
      });
      setHasChanges(true);
      setSaveError(null);
    },
    [selectedUserId, tableId],
  );

  const handleRemoveOverride = useCallback(
    (fieldId: string) => {
      if (!selectedUserId) return;

      setDraftOverrides((prev) =>
        prev.filter(
          (o) => !(o.fieldId === fieldId && o.userId === selectedUserId && o.tableId === tableId),
        ),
      );
      setHasChanges(true);
      setSaveError(null);
    },
    [selectedUserId, tableId],
  );

  const handleSave = useCallback(() => {
    startTransition(async () => {
      try {
        const updatedPermissions: ViewPermissions = {
          ...viewPermissions,
          fieldPermissions: {
            ...viewPermissions.fieldPermissions,
            individualOverrides: draftOverrides,
          },
        };

        await updateViewPermissions({
          viewId,
          workspaceId,
          tableId,
          permissions: updatedPermissions,
        });

        setHasChanges(false);
        setSaveError(null);
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : t('saveError'),
        );
      }
    });
  }, [draftOverrides, viewPermissions, viewId, workspaceId, tableId, t]);

  const handleDiscard = useCallback(() => {
    setDraftOverrides([...viewPermissions.fieldPermissions.individualOverrides]);
    setHasChanges(false);
    setSaveError(null);
  }, [viewPermissions]);

  const roleLabel = useCallback(
    (role: EffectiveRole): string => {
      const labels: Record<string, string> = {
        owner: 'Owner',
        admin: 'Admin',
        manager: t('roleManager'),
        team_member: t('roleTeamMember'),
        viewer: t('roleViewer'),
      };
      return labels[role] ?? role;
    },
    [t],
  );

  // ----------- Render -----------

  if (members.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">
        {t('personNoAccess')}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {/* Person selector */}
        <div className="flex items-center gap-3">
          <Select
            value={selectedUserId ?? ''}
            onValueChange={(value) => {
              setSelectedUserId(value || null);
              // Reset draft when switching users
              setDraftOverrides([...viewPermissions.fieldPermissions.individualOverrides]);
              setHasChanges(false);
              setSaveError(null);
            }}
          >
            <SelectTrigger className="w-[280px]" aria-label={t('personSelect')}>
              <SelectValue placeholder={t('personSelect')} />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  <div className="flex items-center gap-2">
                    {member.avatarUrl ? (
                      <Image
                        src={member.avatarUrl}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 rounded-full"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--muted)] text-[11px] font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-[14px]">{member.name}</span>
                    <Badge variant="outline" className="ml-1 text-[11px]">
                      {roleLabel(member.role)}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Field list with effective permissions */}
        {selectedMember && (
          <div className="flex flex-col gap-1">
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_auto] items-center gap-2 pb-2">
              <div className="text-[13px] font-medium text-[var(--text-secondary)]">
                {t('fieldColumn')}
              </div>
              <div className="text-[13px] font-medium text-[var(--text-secondary)]">
                {t('stateEffective')}
              </div>
              <div className="w-[140px]" />
            </div>

            {tableFields.map((field) => {
              const override = getOverride(field.id);
              const hasOverride = !!override;
              const effectiveState = effectivePermissions.get(field.id) ?? 'hidden';
              const roleLevelState = roleLevelStates.get(field.id) ?? 'hidden';
              const ceiling = getFieldCeiling(
                fieldPermissions[field.id],
                selectedMember.role,
              );

              return (
                <div
                  key={field.id}
                  className={`grid grid-cols-[1fr_120px_auto] items-center gap-2 border-t border-[var(--border-default)] py-2 ${
                    hasOverride ? 'bg-blue-50/60' : ''
                  }`}
                  data-testid={`field-row-${field.id}`}
                >
                  {/* Field name */}
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-[var(--text-primary)] truncate">
                      {field.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      {field.fieldType}
                    </span>
                  </div>

                  {/* Effective permission badge + override indicator */}
                  <div className="flex items-center gap-1">
                    <PermissionStateBadge state={effectiveState} />
                    {hasOverride && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="text-[10px] text-blue-600 border-blue-300"
                          >
                            {t('overrideLabel')}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {t('overrideRoleLevelState', {
                              state: t(STATE_LABEL_KEY[roleLevelState]),
                            })}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Override actions */}
                  <div className="flex w-[140px] items-center gap-1">
                    {hasOverride ? (
                      <>
                        <OverrideDropdown
                          currentState={override.accessState}
                          ceiling={ceiling}
                          onSelect={(state) => handleAddOverride(field.id, state)}
                          t={t}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => handleRemoveOverride(field.id)}
                          aria-label={t('overrideRemove')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <OverrideDropdown
                        currentState={null}
                        ceiling={ceiling}
                        onSelect={(state) => handleAddOverride(field.id, state)}
                        t={t}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Save bar */}
        {hasChanges && (
          <div className="flex items-center gap-3 border-t border-[var(--border-default)] pt-4">
            <Button
              onClick={handleSave}
              disabled={isPending}
              size="sm"
            >
              {isPending ? t('saving') : t('configSave')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
            >
              {t('discardChanges')}
            </Button>
            {saveError && (
              <span className="text-[13px] text-[var(--error)]">
                {saveError}
              </span>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Override dropdown
// ---------------------------------------------------------------------------

interface OverrideDropdownProps {
  currentState: FieldPermissionState | null;
  ceiling: FieldPermissionState;
  onSelect: (state: FieldPermissionState) => void;
  t: ReturnType<typeof useTranslations<'permissions'>>;
}

const CEILING_RANK: Record<FieldPermissionState, number> = {
  hidden: 0,
  read_only: 1,
  read_write: 2,
};

function OverrideDropdown({ currentState, ceiling, onSelect, t }: OverrideDropdownProps) {
  const ceilingRank = CEILING_RANK[ceiling];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]">
          {currentState === null ? t('overrideAdd') : t('stateReadWrite').substring(0, 0) + t(STATE_LABEL_KEY[currentState])}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATES.map((state) => {
          const stateRank = CEILING_RANK[state];
          const blocked = stateRank > ceilingRank;

          return (
            <DropdownMenuItem
              key={state}
              disabled={blocked}
              onClick={() => {
                if (!blocked) onSelect(state);
              }}
            >
              <span className="flex items-center gap-2">
                {state === 'read_write' && <Check className="h-3 w-3" />}
                {state === 'read_only' && <Eye className="h-3 w-3" />}
                {state === 'hidden' && <EyeOff className="h-3 w-3" />}
                {t(STATE_LABEL_KEY[state])}
                {blocked && (
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    ({t('overrideCeilingBlocked')})
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
