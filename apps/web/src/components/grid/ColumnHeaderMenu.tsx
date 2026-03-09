'use client';

/**
 * ColumnHeaderMenu — right-click context menu for column headers.
 *
 * 14 items with permission gating per tables-and-views.md § Column Header
 * Right-Click Menu.
 *
 * @see docs/reference/tables-and-views.md § Column Header Right-Click Menu
 */

import { memo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { roleAtLeast, type EffectiveRole } from '@everystack/shared/auth';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { DATA_COLORS } from '@/lib/design-system/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColumnHeaderMenuProps {
  fieldId: string;
  fieldName: string;
  isPrimary: boolean;
  isFrozen: boolean;
  userRole: EffectiveRole;
  columnColors: Record<string, string>;
  onFreezeUpTo: (fieldId: string) => void;
  onUnfreeze: () => void;
  onHideField: (fieldId: string) => void;
  onSetColumnColor: (fieldId: string, colorName: string | null) => void;
  onRenameField: (fieldId: string, newName: string) => void;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Column color palette (light tones from design system)
// ---------------------------------------------------------------------------

const COLUMN_PALETTE = DATA_COLORS.map((c) => ({
  name: c.name,
  light: c.light,
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ColumnHeaderMenu = memo(function ColumnHeaderMenu({
  fieldId,
  fieldName: _fieldName,
  isPrimary,
  isFrozen,
  userRole,
  columnColors,
  onFreezeUpTo,
  onUnfreeze,
  onHideField,
  onSetColumnColor,
  onRenameField: _onRenameField,
  children,
}: ColumnHeaderMenuProps) {
  const t = useTranslations('grid.column_menu');
  const isManager = roleAtLeast(userRole, 'manager');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const currentColor = columnColors[fieldId] ?? null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* 1. Sort ascending */}
        <ContextMenuItem disabled>
          {t('sort_ascending')}
        </ContextMenuItem>

        {/* 2. Sort descending */}
        <ContextMenuItem disabled>
          {t('sort_descending')}
        </ContextMenuItem>

        {/* 3. Add filter */}
        <ContextMenuItem disabled>
          {t('add_filter')}
        </ContextMenuItem>

        {/* 4. Group by this field */}
        <ContextMenuItem disabled>
          {t('group_by')}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* 5. Edit field — Manager+ */}
        {isManager && (
          <ContextMenuItem disabled>
            {t('edit_field')}
          </ContextMenuItem>
        )}

        {/* 6. Rename field — Manager+ */}
        {isManager && !renaming && (
          <ContextMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setRenaming(true);
              setRenameValue(_fieldName);
            }}
          >
            {t('rename_field')}
          </ContextMenuItem>
        )}

        {/* 7. Duplicate field — Manager+ */}
        {isManager && (
          <ContextMenuItem disabled>
            {t('duplicate_field')}
          </ContextMenuItem>
        )}

        {/* 8. Insert field left / right — Manager+ */}
        {isManager && (
          <ContextMenuItem disabled>
            {t('insert_field_left')}
          </ContextMenuItem>
        )}
        {isManager && (
          <ContextMenuItem disabled>
            {t('insert_field_right')}
          </ContextMenuItem>
        )}

        {/* 9. Hide field */}
        {!isPrimary && (
          <ContextMenuItem onSelect={() => onHideField(fieldId)}>
            {t('hide_field')}
          </ContextMenuItem>
        )}

        {/* 10. Delete field — Manager+ */}
        {isManager && !isPrimary && (
          <ContextMenuItem disabled className="text-red-600">
            {t('delete_field')}
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* 12. Freeze up to here / Unfreeze */}
        {!isFrozen && (
          <ContextMenuItem onSelect={() => onFreezeUpTo(fieldId)}>
            {t('freeze_up_to')}
          </ContextMenuItem>
        )}
        {isFrozen && !isPrimary && (
          <ContextMenuItem onSelect={() => onUnfreeze()}>
            {t('unfreeze')}
          </ContextMenuItem>
        )}

        {/* 13. Set column color — sub-menu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>{t('set_column_color')}</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {/* Clear color */}
            {currentColor && (
              <ContextMenuItem onSelect={() => onSetColumnColor(fieldId, null)}>
                {t('clear_color')}
              </ContextMenuItem>
            )}
            {/* Color palette */}
            {COLUMN_PALETTE.map((color) => (
              <ContextMenuItem
                key={color.name}
                onSelect={() => onSetColumnColor(fieldId, color.name)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm border border-slate-200"
                    style={{ backgroundColor: color.light }}
                  />
                  <span>{color.name}</span>
                </span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* 14. Edit permissions — Manager+ */}
        {isManager && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem disabled>
              {t('edit_permissions')}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>

      {/* Inline rename dialog (controlled via state) */}
      {renaming && (
        <InlineRename
          initialValue={_fieldName}
          value={renameValue}
          onChange={setRenameValue}
          onConfirm={(name) => {
            _onRenameField(fieldId, name);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      )}
    </ContextMenu>
  );
});

// ---------------------------------------------------------------------------
// InlineRename helper (renders a floating input)
// ---------------------------------------------------------------------------

interface InlineRenameProps {
  initialValue: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function InlineRename({
  initialValue: _initialValue,
  value,
  onChange,
  onConfirm,
  onCancel,
}: InlineRenameProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div
        className="absolute inset-0"
        onClick={onCancel}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
        role="presentation"
      />
      <div className="relative bg-white rounded-md shadow-lg border p-3 min-w-[240px]">
        <input
          type="text"
          className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              onConfirm(value.trim());
            }
            if (e.key === 'Escape') {
              onCancel();
            }
          }}
          autoFocus
        />
      </div>
    </div>
  );
}
