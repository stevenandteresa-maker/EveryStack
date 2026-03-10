'use client';

/**
 * RecordViewConfigPicker — dropdown to switch between saved Record View configs.
 *
 * Shows all saved configs for the current table with a "Save as new config" option.
 *
 * @see docs/reference/tables-and-views.md § Record View
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfigOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface RecordViewConfigPickerProps {
  configs: ConfigOption[];
  activeConfigId: string | null;
  onSelectConfig: (configId: string) => void;
  onSaveAsNew: (name: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordViewConfigPicker({
  configs,
  activeConfigId,
  onSelectConfig,
  onSaveAsNew,
}: RecordViewConfigPickerProps) {
  const t = useTranslations('record_view');
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');

  const activeConfig = configs.find((c) => c.id === activeConfigId);
  const displayName = activeConfig?.name ?? t('config_name_default');

  const handleSaveSubmit = useCallback(() => {
    const trimmed = newName.trim();
    if (trimmed) {
      onSaveAsNew(trimmed);
    }
    setNewName('');
    setIsSaving(false);
  }, [newName, onSaveAsNew]);

  const handleSaveKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsSaving(false);
        setNewName('');
      }
    },
    [handleSaveSubmit],
  );

  if (configs.length <= 1 && !isSaving) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          aria-label={t('config_picker_label')}
        >
          {displayName}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {configs.map((config) => (
          <DropdownMenuItem
            key={config.id}
            onClick={() => onSelectConfig(config.id)}
            className={cn(
              'flex items-center gap-2',
              config.id === activeConfigId && 'font-medium',
            )}
          >
            {config.id === activeConfigId && (
              <Check className="h-3.5 w-3.5" />
            )}
            <span className={config.id !== activeConfigId ? 'ml-5' : ''}>
              {config.name}
            </span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {isSaving ? (
          <div className="px-2 py-1.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleSaveSubmit}
              onKeyDown={handleSaveKeyDown}
              placeholder={t('config_new_name_placeholder')}
              className="h-7 text-xs"
              autoFocus
              aria-label={t('config_new_name')}
            />
          </div>
        ) : (
          <DropdownMenuItem onClick={() => setIsSaving(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" />
            {t('config_save_as_new')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
