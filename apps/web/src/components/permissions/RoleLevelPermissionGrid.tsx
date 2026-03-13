'use client';

/**
 * Role-level permission configuration grid.
 *
 * Grid layout: rows = fields, columns = roles (Team Member, Viewer; Manager if Admin).
 * Each cell shows effective state as a clickable PermissionStateBadge.
 * Click-to-cycle: read_write → read_only → hidden → read_write.
 *
 * @see docs/reference/permissions.md § Role-Level Configuration View
 */

import { useState, useCallback, useMemo, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PermissionStateBadge } from './PermissionStateBadge';
import { updateViewPermissions } from '@/actions/permission-actions';
import type {
  FieldPermissionState,
  RestrictableRole,
  ViewPermissions,
} from '@everystack/shared/auth';
import type { Field } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoleLevelPermissionGridProps {
  viewId: string;
  tableId: string;
  tenantId: string;
  workspaceId: string;
  isAdmin: boolean;
  fields: Field[];
  viewPermissions: ViewPermissions;
}

type RoleRestrictionMap = Map<string, FieldPermissionState>;
type DraftState = Map<string, RoleRestrictionMap>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CYCLE_ORDER: FieldPermissionState[] = ['read_write', 'read_only', 'hidden'];

function cycleState(current: FieldPermissionState): FieldPermissionState {
  const idx = CYCLE_ORDER.indexOf(current);
  return CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length] ?? 'read_write';
}

function buildDraftFromPermissions(
  viewPermissions: ViewPermissions,
  roles: RestrictableRole[],
  fieldIds: string[],
): DraftState {
  const draft: DraftState = new Map();

  for (const role of roles) {
    const roleMap: RoleRestrictionMap = new Map();
    for (const fieldId of fieldIds) {
      roleMap.set(fieldId, 'read_write');
    }
    draft.set(role, roleMap);
  }

  // Apply existing restrictions
  for (const restriction of viewPermissions.fieldPermissions.roleRestrictions) {
    const roleMap = draft.get(restriction.role);
    if (roleMap) {
      roleMap.set(restriction.fieldId, restriction.accessState);
    }
  }

  return draft;
}

function draftToRestrictions(
  draft: DraftState,
  tableId: string,
): ViewPermissions['fieldPermissions']['roleRestrictions'] {
  const restrictions: ViewPermissions['fieldPermissions']['roleRestrictions'] = [];

  for (const [role, roleMap] of draft) {
    for (const [fieldId, state] of roleMap) {
      // Only store non-default restrictions (read_write is the default)
      if (state !== 'read_write') {
        restrictions.push({
          tableId,
          role: role as RestrictableRole,
          fieldId,
          accessState: state,
        });
      }
    }
  }

  return restrictions;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoleLevelPermissionGrid({
  viewId,
  tableId,
  tenantId: _tenantId,
  workspaceId,
  isAdmin,
  fields: tableFields,
  viewPermissions,
}: RoleLevelPermissionGridProps) {
  const t = useTranslations('permissions');
  const [isPending, startTransition] = useTransition();

  const roles: RestrictableRole[] = useMemo(() => {
    const base: RestrictableRole[] = ['team_member', 'viewer'];
    if (isAdmin) base.unshift('manager');
    return base;
  }, [isAdmin]);

  const fieldIds = useMemo(
    () => tableFields.map((f) => f.id),
    [tableFields],
  );

  const [draft, setDraft] = useState<DraftState>(() =>
    buildDraftFromPermissions(viewPermissions, roles, fieldIds),
  );

  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleCycleCell = useCallback(
    (role: RestrictableRole, fieldId: string) => {
      setDraft((prev) => {
        const next = new Map(prev);
        const roleMap = new Map(next.get(role) ?? new Map());
        const current = roleMap.get(fieldId) ?? 'read_write';
        roleMap.set(fieldId, cycleState(current));
        next.set(role, roleMap);
        return next;
      });
      setHasChanges(true);
      setSaveError(null);
    },
    [],
  );

  const handleSetAllForRole = useCallback(
    (role: RestrictableRole, state: FieldPermissionState) => {
      setDraft((prev) => {
        const next = new Map(prev);
        const roleMap = new Map(next.get(role) ?? new Map());
        for (const fId of fieldIds) {
          roleMap.set(fId, state);
        }
        next.set(role, roleMap);
        return next;
      });
      setHasChanges(true);
      setSaveError(null);
    },
    [fieldIds],
  );

  const handleSave = useCallback(() => {
    startTransition(async () => {
      try {
        const updatedPermissions: ViewPermissions = {
          ...viewPermissions,
          fieldPermissions: {
            ...viewPermissions.fieldPermissions,
            roleRestrictions: draftToRestrictions(draft, tableId),
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
        // Revert to original state on failure
        setDraft(
          buildDraftFromPermissions(viewPermissions, roles, fieldIds),
        );
        setHasChanges(false);
      }
    });
  }, [draft, viewPermissions, viewId, workspaceId, tableId, roles, fieldIds, t]);

  const roleLabel = useCallback(
    (role: RestrictableRole): string => {
      const labels: Record<RestrictableRole, string> = {
        manager: t('roleManager'),
        team_member: t('roleTeamMember'),
        viewer: t('roleViewer'),
      };
      return labels[role];
    },
    [t],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Grid header */}
      <div
        className="grid items-center gap-2"
        style={{
          gridTemplateColumns: `minmax(180px, 1fr) ${roles.map(() => 'minmax(120px, 1fr)').join(' ')}`,
        }}
      >
        <div className="text-[13px] font-medium text-[var(--text-secondary)]">
          {t('fieldColumn')}
        </div>
        {roles.map((role) => (
          <div key={role} className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">
              {roleLabel(role)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]">
                  {t('setAll')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleSetAllForRole(role, 'read_write')}>
                  {t('fullAccess')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetAllForRole(role, 'read_only')}>
                  {t('readOnly')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetAllForRole(role, 'hidden')}>
                  {t('hidden')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {tableFields.map((field) => (
        <div
          key={field.id}
          className="grid items-center gap-2 border-t border-[var(--border-default)] pt-2"
          style={{
            gridTemplateColumns: `minmax(180px, 1fr) ${roles.map(() => 'minmax(120px, 1fr)').join(' ')}`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-[var(--text-primary)] truncate">
              {field.name}
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)]">
              {field.fieldType}
            </span>
          </div>
          {roles.map((role) => {
            const state = draft.get(role)?.get(field.id) ?? 'read_write';
            return (
              <PermissionStateBadge
                key={`${role}-${field.id}`}
                state={state}
                onClick={() => handleCycleCell(role, field.id)}
              />
            );
          })}
        </div>
      ))}

      {/* Save bar */}
      {hasChanges && (
        <div className="flex items-center gap-3 border-t border-[var(--border-default)] pt-4">
          <Button
            onClick={handleSave}
            disabled={isPending}
            size="sm"
          >
            {isPending ? t('saving') : t('saveChanges')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(
                buildDraftFromPermissions(viewPermissions, roles, fieldIds),
              );
              setHasChanges(false);
              setSaveError(null);
            }}
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
  );
}
