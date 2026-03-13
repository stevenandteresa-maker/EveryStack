'use client';

/**
 * Permission configuration panel with tab switcher.
 *
 * Tab 1: "By Role" → RoleLevelPermissionGrid
 * Tab 2: "By Person" → placeholder for IndividualOverrideView (Prompt 11)
 *
 * Access gated to Manager+ via roleAtLeast().
 *
 * @see docs/reference/permissions.md § Permission Configuration UI
 */

import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RoleLevelPermissionGrid } from './RoleLevelPermissionGrid';
import { IndividualOverrideView } from './IndividualOverrideView';
import type { WorkspaceMemberInfo } from './IndividualOverrideView';
import type { ViewPermissions } from '@everystack/shared/auth';
import type { Field } from '@everystack/shared/db';

export interface PermissionConfigPanelProps {
  viewId: string;
  tableId: string;
  tenantId: string;
  workspaceId: string;
  isAdmin: boolean;
  fields: Field[];
  viewPermissions: ViewPermissions;
  /** Workspace members who have access to this view (for "By Person" tab). */
  members: WorkspaceMemberInfo[];
  /** Field ID → fields.permissions JSONB (global defaults). */
  fieldPermissions: Record<string, Record<string, unknown>>;
}

export function PermissionConfigPanel({
  viewId,
  tableId,
  tenantId,
  workspaceId,
  isAdmin,
  fields,
  viewPermissions,
  members,
  fieldPermissions,
}: PermissionConfigPanelProps) {
  const t = useTranslations('permissions');

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-[20px] font-semibold">
        {t('configTitle')}
      </h2>

      <Tabs defaultValue="by-role">
        <TabsList>
          <TabsTrigger value="by-role">{t('tabByRole')}</TabsTrigger>
          <TabsTrigger value="by-person">{t('tabByPerson')}</TabsTrigger>
        </TabsList>

        <TabsContent value="by-role">
          <RoleLevelPermissionGrid
            viewId={viewId}
            tableId={tableId}
            tenantId={tenantId}
            workspaceId={workspaceId}
            isAdmin={isAdmin}
            fields={fields}
            viewPermissions={viewPermissions}
          />
        </TabsContent>

        <TabsContent value="by-person">
          <IndividualOverrideView
            viewId={viewId}
            tableId={tableId}
            tenantId={tenantId}
            workspaceId={workspaceId}
            fields={fields}
            viewPermissions={viewPermissions}
            members={members}
            fieldPermissions={fieldPermissions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
