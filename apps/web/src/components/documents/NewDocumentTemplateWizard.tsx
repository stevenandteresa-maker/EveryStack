'use client';

/**
 * NewDocumentTemplateWizard — Wizard Create flow for document templates.
 *
 * Two-step wizard: name → select table → create & redirect to editor.
 * Follows the "Wizard Create" pattern from design-system.md.
 *
 * @see docs/reference/smart-docs.md § Document Generation — Two Prongs
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { createDocumentTemplate } from '@/actions/document-templates';
import type { Table } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NewDocumentTemplateWizardProps {
  tables: Table[];
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewDocumentTemplateWizard({
  tables,
  workspaceId,
}: NewDocumentTemplateWizardProps) {
  const t = useTranslations('documentTemplates.wizard');
  const router = useRouter();

  const [name, setName] = useState('');
  const [tableId, setTableId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canSubmit = name.trim().length > 0 && tableId.length > 0 && !isCreating;

  const handleCreate = useCallback(async () => {
    if (!canSubmit) return;
    setIsCreating(true);

    try {
      const template = await createDocumentTemplate({
        name: name.trim(),
        tableId,
      });
      router.push(`/${workspaceId}/documents/${template.id}`);
    } catch {
      setIsCreating(false);
    }
  }, [canSubmit, name, tableId, workspaceId, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canSubmit) {
        handleCreate();
      }
    },
    [canSubmit, handleCreate],
  );

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
          <FileText className="h-5 w-5" />
        </div>
        <h1 className="text-h2 text-foreground">{t('title')}</h1>
      </div>

      <div className="space-y-4" onKeyDown={handleKeyDown}>
        {/* Template name */}
        <div className="space-y-2">
          <Label htmlFor="template-name">{t('nameLabel')}</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            autoFocus
          />
        </div>

        {/* Table selection */}
        <div className="space-y-2">
          <Label htmlFor="template-table">{t('tableLabel')}</Label>
          <p className="text-[12px] text-muted-foreground leading-[16px]">
            {t('tableDescription')}
          </p>
          {tables.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-2">
              {t('noTables')}
            </p>
          ) : (
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger id="template-table">
                <SelectValue placeholder={t('tablePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Create button */}
      <Button
        className="mt-6 w-full"
        onClick={handleCreate}
        disabled={!canSubmit}
      >
        {isCreating ? t('creating') : t('create')}
      </Button>
    </Card>
  );
}
