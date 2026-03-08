'use client';

/**
 * KeyboardShortcutsDialog — modal showing all available grid keyboard shortcuts,
 * grouped by category. Opened via Cmd+/ (or Ctrl+/).
 *
 * @see docs/reference/tables-and-views.md § Keyboard Shortcuts
 * @see docs/Playbooks/playbook-phase-3a-i.md § Prompt 7
 */

import { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Platform detection for modifier key label
// ---------------------------------------------------------------------------

function getModLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘' : 'Ctrl';
}

// ---------------------------------------------------------------------------
// Shortcut definitions
// ---------------------------------------------------------------------------

interface ShortcutItem {
  keys: string;
  labelKey: string;
}

interface ShortcutGroup {
  titleKey: string;
  items: ShortcutItem[];
}

function getGroups(mod: string): ShortcutGroup[] {
  return [
    {
      titleKey: 'navigation',
      items: [
        { keys: '↑ ↓ ← →', labelKey: 'nav_arrows' },
        { keys: 'Tab / Shift+Tab', labelKey: 'nav_tab' },
        { keys: 'Enter', labelKey: 'nav_enter' },
        { keys: 'Escape', labelKey: 'nav_escape' },
        { keys: 'Home / End', labelKey: 'nav_home_end' },
        { keys: `${mod}+Home / ${mod}+End`, labelKey: 'nav_cmd_home_end' },
        { keys: 'Page Up / Page Down', labelKey: 'nav_page' },
      ],
    },
    {
      titleKey: 'selection',
      items: [
        { keys: 'Shift+↑↓←→', labelKey: 'sel_extend' },
        { keys: `${mod}+A`, labelKey: 'sel_all' },
      ],
    },
    {
      titleKey: 'editing',
      items: [
        { keys: 'F2', labelKey: 'edit_f2' },
        { keys: 'Delete / Backspace', labelKey: 'edit_delete' },
        { keys: 'Space', labelKey: 'edit_space' },
        { keys: `${mod}+Z / ${mod}+Shift+Z`, labelKey: 'edit_undo_redo' },
        { keys: `${mod}+C / ${mod}+V`, labelKey: 'edit_copy_paste' },
        { keys: `${mod}+D`, labelKey: 'edit_fill_down' },
      ],
    },
    {
      titleKey: 'grid_actions',
      items: [
        { keys: `${mod}+Shift+N`, labelKey: 'action_new_record' },
        { keys: `${mod}+/`, labelKey: 'action_shortcuts' },
        { keys: `${mod}+Shift+F`, labelKey: 'action_filter' },
        { keys: `${mod}+Shift+S`, labelKey: 'action_sort' },
        { keys: `${mod}+K`, labelKey: 'action_command_bar' },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const KeyboardShortcutsDialog = memo(function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const t = useTranslations('grid.shortcuts');
  const mod = useMemo(() => getModLabel(), []);
  const groups = useMemo(() => getGroups(mod), [mod]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('title')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {groups.map((group) => (
            <div key={group.titleKey}>
              <h3 className="text-sm font-semibold mb-2 text-slate-700">
                {t(group.titleKey)}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.labelKey}
                    className="flex items-center justify-between py-1 text-sm"
                  >
                    <span className="text-slate-600">{t(item.labelKey)}</span>
                    <kbd className="text-xs font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});
