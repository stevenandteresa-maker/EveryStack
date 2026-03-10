'use client';

/**
 * ImportFieldMapping — Step 3: map CSV columns to EveryStack fields.
 *
 * Fuzzy auto-mapping on mount. Primary field mapping required.
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Field } from '@everystack/shared/db';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, ArrowRight, SkipForward } from 'lucide-react';
import type { FieldMapping } from './CsvImportWizard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportFieldMappingProps {
  csvHeaders: string[];
  fields: Field[];
  onConfirm: (mappings: FieldMapping[]) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Fuzzy matching helper
// ---------------------------------------------------------------------------

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-\s]+/g, '')
    .trim();
}

function fuzzyMatch(csvHeader: string, fieldName: string): boolean {
  const normalizedCsv = normalizeForMatch(csvHeader);
  const normalizedField = normalizeForMatch(fieldName);
  return normalizedCsv === normalizedField || normalizedCsv.includes(normalizedField) || normalizedField.includes(normalizedCsv);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SKIP_VALUE = '__skip__';

export function ImportFieldMapping({
  csvHeaders,
  fields,
  onConfirm,
  onBack,
}: ImportFieldMappingProps) {
  const t = useTranslations('import');

  // Mappable fields: exclude read-only and system fields
  const mappableFields = useMemo(
    () => fields.filter((f) => !f.readOnly && !f.isSystem),
    [fields],
  );

  const primaryField = useMemo(
    () => fields.find((f) => f.isPrimary),
    [fields],
  );

  // Initialize mappings with auto-matching
  const [mappings, setMappings] = useState<FieldMapping[]>(() => {
    const usedFieldIds = new Set<string>();
    return csvHeaders.map((header, index) => {
      // Try fuzzy match
      const match = mappableFields.find(
        (f) => !usedFieldIds.has(f.id) && fuzzyMatch(header, f.name),
      );
      if (match) {
        usedFieldIds.add(match.id);
        return { csvColumnIndex: index, csvColumnName: header, fieldId: match.id };
      }
      return { csvColumnIndex: index, csvColumnName: header, fieldId: null };
    });
  });

  const handleMappingChange = (csvIndex: number, fieldId: string | null) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.csvColumnIndex === csvIndex ? { ...m, fieldId } : m,
      ),
    );
  };

  // Validation: primary field must be mapped
  const isPrimaryMapped = primaryField
    ? mappings.some((m) => m.fieldId === primaryField.id)
    : true;

  const mappedFieldIds = new Set(
    mappings.filter((m) => m.fieldId !== null).map((m) => m.fieldId),
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{t('mapping_title')}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t('mapping_description')}</p>
      </div>

      {/* Mapping rows */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {mappings.map((mapping) => (
          <div
            key={mapping.csvColumnIndex}
            className="flex items-center gap-3 rounded-md border px-3 py-2"
          >
            {/* CSV column name */}
            <span className="text-xs font-medium w-1/3 truncate" title={mapping.csvColumnName}>
              {mapping.csvColumnName}
            </span>

            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

            {/* Field selector */}
            <div className="w-1/2">
              <Select
                value={mapping.fieldId ?? SKIP_VALUE}
                onValueChange={(val) =>
                  handleMappingChange(
                    mapping.csvColumnIndex,
                    val === SKIP_VALUE ? null : val,
                  )
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t('mapping_select_field')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SKIP_VALUE}>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <SkipForward className="h-3 w-3" />
                      {t('mapping_skip')}
                    </span>
                  </SelectItem>
                  {mappableFields.map((field) => {
                    const isUsed = mappedFieldIds.has(field.id) && mapping.fieldId !== field.id;
                    return (
                      <SelectItem
                        key={field.id}
                        value={field.id}
                        disabled={isUsed}
                      >
                        <span className="flex items-center gap-1.5">
                          {field.name}
                          <span className="text-muted-foreground text-[10px]">
                            {field.fieldType}
                          </span>
                          {field.isPrimary && (
                            <span className="text-[10px] font-medium text-primary">
                              {t('mapping_primary')}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      {/* Primary field warning */}
      {!isPrimaryMapped && primaryField && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">
            {t('mapping_primary_required', { fieldName: primaryField.name })}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t('back')}
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm(mappings)}
          disabled={!isPrimaryMapped}
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
