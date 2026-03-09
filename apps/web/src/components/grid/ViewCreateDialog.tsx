'use client';

/**
 * ViewCreateDialog — dialog for creating a new view.
 *
 * Name input, type selector (Grid/Card), "Copy current view config" toggle,
 * and optional "Make shared" toggle for Manager+.
 *
 * @see docs/reference/tables-and-views.md § My Views & Shared Views
 */

import { memo, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Grid3X3, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { EffectiveRole } from '@everystack/shared/auth';
import { roleAtLeast } from '@everystack/shared/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: EffectiveRole;
  currentViewConfig: Record<string, unknown> | null;
  onSubmit: (data: {
    name: string;
    viewType: 'grid' | 'card';
    isShared: boolean;
    config: Record<string, unknown>;
  }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ViewCreateDialog = memo(function ViewCreateDialog({
  open,
  onOpenChange,
  userRole,
  currentViewConfig,
  onSubmit,
}: ViewCreateDialogProps) {
  const t = useTranslations('grid.views');

  const [name, setName] = useState('');
  const [viewType, setViewType] = useState<'grid' | 'card'>('grid');
  const [copyConfig, setCopyConfig] = useState(true);
  const [makeShared, setMakeShared] = useState(false);

  const isManagerPlus = roleAtLeast(userRole, 'manager');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;

      onSubmit({
        name: name.trim(),
        viewType,
        isShared: makeShared && isManagerPlus,
        config: copyConfig && currentViewConfig ? { ...currentViewConfig } : {},
      });

      // Reset form
      setName('');
      setViewType('grid');
      setCopyConfig(true);
      setMakeShared(false);
      onOpenChange(false);
    },
    [name, viewType, copyConfig, makeShared, isManagerPlus, currentViewConfig, onSubmit, onOpenChange],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        // Reset on close
        setName('');
        setViewType('grid');
        setCopyConfig(true);
        setMakeShared(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('create_view')}</DialogTitle>
            <DialogDescription>{t('create_view_description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name input */}
            <div className="space-y-2">
              <Label htmlFor="view-name">{t('view_name')}</Label>
              <Input
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('view_name_placeholder')}
                maxLength={255}
                autoFocus
              />
            </div>

            {/* View type selector */}
            <div className="space-y-2">
              <Label>{t('view_type')}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={viewType === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => setViewType('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                  {t('type_grid')}
                </Button>
                <Button
                  type="button"
                  variant={viewType === 'card' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => setViewType('card')}
                >
                  <LayoutGrid className="h-4 w-4" />
                  {t('type_card')}
                </Button>
              </div>
            </div>

            {/* Copy current view config toggle */}
            {currentViewConfig && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="copy-config"
                  checked={copyConfig}
                  onCheckedChange={(checked) => setCopyConfig(checked === true)}
                />
                <Label htmlFor="copy-config" className="text-sm font-normal cursor-pointer">
                  {t('copy_current_config')}
                </Label>
              </div>
            )}

            {/* Make shared toggle — Manager+ only */}
            {isManagerPlus && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="make-shared"
                  checked={makeShared}
                  onCheckedChange={(checked) => setMakeShared(checked === true)}
                />
                <Label htmlFor="make-shared" className="text-sm font-normal cursor-pointer">
                  {t('make_shared')}
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
