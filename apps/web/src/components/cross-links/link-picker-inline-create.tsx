'use client';

/**
 * LinkPickerInlineCreate — compact form for creating a new record
 * and linking it in one action.
 *
 * Rendered at the bottom of the Link Picker. Shows card_fields from the
 * cross-link definition as form inputs. Creates the record on the target
 * table and links it to the source record.
 *
 * @see docs/reference/cross-linking.md § Inline Create
 */

import { useCallback, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createRecord } from '@/actions/record-actions';
import { linkRecords } from '@/actions/cross-link-actions';
import type { Field, CrossLink } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkPickerInlineCreateProps {
  /** The cross-link definition */
  definition: CrossLink;
  /** Card fields to show in the compact form */
  cardFields: Field[];
  /** Source record ID to link the new record to */
  sourceRecordId: string;
  /** Tenant ID */
  tenantId: string;
  /** Called after successful create+link with the new record ID */
  onCreated: (recordId: string, displayValue: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkPickerInlineCreate({
  definition,
  cardFields,
  sourceRecordId,
  tenantId: _tenantId,
  onCreated,
}: LinkPickerInlineCreateProps) {
  const t = useTranslations('link_picker');
  const [isExpanded, setIsExpanded] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const targetTableName = definition.name ?? t('new_record');

  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleCreate = useCallback(() => {
    // Build canonical data from field values
    const canonicalData: Record<string, unknown> = {};
    for (const field of cardFields) {
      const val = fieldValues[field.id];
      if (val !== undefined && val !== '') {
        canonicalData[field.id] = val;
      }
    }

    // Check that at least one field has a value
    if (Object.keys(canonicalData).length === 0) return;

    const crossLinkId = definition.id;
    const targetTableId = definition.targetTableId;
    const displayFieldId = definition.targetDisplayFieldId;

    startTransition(async () => {
      // Create the record on the target table
      const newRecord = await createRecord({
        tableId: targetTableId,
        canonicalData,
      });

      // Link it to the source record
      await linkRecords({
        crossLinkId,
        sourceRecordId,
        targetRecordIds: [newRecord.id],
      });

      // Determine display value for the new record
      const displayValue = String(
        canonicalData[displayFieldId] ?? newRecord.id,
      );

      onCreated(newRecord.id, displayValue);

      // Reset form
      setFieldValues({});
      setIsExpanded(false);
    });
  }, [
    cardFields,
    fieldValues,
    definition.id,
    definition.targetTableId,
    definition.targetDisplayFieldId,
    sourceRecordId,
    onCreated,
    startTransition,
  ]);

  const handleCancel = useCallback(() => {
    setFieldValues({});
    setIsExpanded(false);
  }, []);

  if (!isExpanded) {
    return (
      <div className="border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-1.5 text-xs text-muted-foreground"
          onClick={() => setIsExpanded(true)}
          data-testid="inline-create-trigger"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('inline_create_new', { tableName: targetTableName })}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t px-3 py-3 space-y-3" data-testid="inline-create-form">
      <p className="text-xs font-medium text-muted-foreground">
        {t('inline_create_new', { tableName: targetTableName })}
      </p>

      {cardFields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={`inline-create-${field.id}`} className="text-xs">
            {field.name}
          </Label>
          <Input
            id={`inline-create-${field.id}`}
            value={fieldValues[field.id] ?? ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.name}
            className="h-8 text-sm"
            disabled={isPending}
          />
        </div>
      ))}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isPending}
        >
          {t('cancel')}
        </Button>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={isPending || Object.values(fieldValues).every((v) => !v)}
          data-testid="inline-create-submit"
        >
          {isPending ? t('inline_create_creating') : t('inline_create_submit')}
        </Button>
      </div>
    </div>
  );
}
