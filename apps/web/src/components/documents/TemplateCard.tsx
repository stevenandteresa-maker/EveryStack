'use client';

/**
 * TemplateCard — displays a document template summary in the list grid.
 *
 * Shows name, table badge, last updated date, creator, version,
 * and a dropdown with Duplicate / Delete actions.
 *
 * @see docs/reference/smart-docs.md § Document Generation — Two Prongs
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, MoreHorizontal, Copy, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DocumentTemplateListItem } from '@/data/document-templates';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateCardProps {
  template: DocumentTemplateListItem;
  onNavigate: (templateId: string) => void;
  onDuplicate: (templateId: string) => Promise<void>;
  onDelete: (templateId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateCard({
  template,
  onNavigate,
  onDuplicate,
  onDelete,
}: TemplateCardProps) {
  const t = useTranslations('documentTemplates');
  const tCommon = useTranslations('common');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const formattedDate = new Date(template.updatedAt).toLocaleDateString(
    undefined,
    { month: 'short', day: 'numeric', year: 'numeric' },
  );

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDuplicating(true);
    try {
      await onDuplicate(template.id);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(template.id);
      setShowDeleteDialog(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('existing generated documents')) {
        setDeleteError(t('deleteBlocked'));
      } else {
        setDeleteError(message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card
        className="group relative flex flex-col gap-3 p-4 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onNavigate(template.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate(template.id);
          }
        }}
      >
        {/* Icon + name */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold leading-[20px] text-foreground truncate">
              {template.name}
            </h3>
            <Badge variant="default" className="mt-1 text-[11px] font-normal">
              {template.tableName}
            </Badge>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => e.stopPropagation()}
                aria-label={tCommon('edit')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleDuplicate}
                disabled={isDuplicating}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t('duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tCommon('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 text-[12px] leading-[16px] text-muted-foreground">
          <span>{t('cardUpdated', { date: formattedDate })}</span>
          <span className="text-border">|</span>
          <span>{t('cardCreatedBy', { name: template.creatorName })}</span>
          <span className="ml-auto text-[11px]">
            {t('cardVersion', { version: String(template.version) })}
          </span>
        </div>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteDescription', { name: template.name })}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-[13px] text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? tCommon('loading') : tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
