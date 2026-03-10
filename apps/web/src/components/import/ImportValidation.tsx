'use client';

/**
 * ImportValidation — Step 4: dry-run validation on first 100 rows.
 *
 * Shows per-column pass/fail with expandable details.
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Field } from '@everystack/shared/db';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { FieldMapping } from './CsvImportWizard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportValidationProps {
  csvHeaders: string[];
  csvRows: string[][];
  mappings: FieldMapping[];
  fields: Field[];
  onConfirm: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

interface ColumnValidation {
  fieldId: string;
  fieldName: string;
  csvColumnName: string;
  totalChecked: number;
  passCount: number;
  issues: { row: number; value: string; reason: string }[];
}

// ---------------------------------------------------------------------------
// Basic type validation
// ---------------------------------------------------------------------------

function validateValue(value: string, fieldType: string): string | null {
  if (value === '' || value === null || value === undefined) {
    return null; // Empty is allowed — skip
  }

  switch (fieldType) {
    case 'number':
    case 'currency':
    case 'percent': {
      const cleaned = value.replace(/[$,%\s]/g, '');
      if (isNaN(Number(cleaned))) {
        return 'type_mismatch_number';
      }
      return null;
    }
    case 'checkbox': {
      const lower = value.toLowerCase();
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lower)) {
        return 'type_mismatch_checkbox';
      }
      return null;
    }
    case 'email': {
      if (!value.includes('@') || !value.includes('.')) {
        return 'invalid_email';
      }
      return null;
    }
    case 'url': {
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return 'invalid_url';
      }
      return null;
    }
    case 'date':
    case 'datetime': {
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return 'invalid_date';
      }
      return null;
    }
    case 'rating': {
      const num = Number(value);
      if (isNaN(num) || num < 0 || num > 10 || !Number.isInteger(num)) {
        return 'invalid_rating';
      }
      return null;
    }
    default:
      return null; // Text-like types accept anything
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportValidation({
  csvHeaders: _csvHeaders,
  csvRows,
  mappings,
  fields,
  onConfirm,
  onBack,
}: ImportValidationProps) {
  const t = useTranslations('import');
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());

  // Run validation on first 100 rows
  const validations = useMemo(() => {
    const rowsToCheck = csvRows.slice(0, 100);
    const activeMappings = mappings.filter((m) => m.fieldId !== null);

    return activeMappings.map((mapping): ColumnValidation => {
      const field = fields.find((f) => f.id === mapping.fieldId);
      const fieldName = field?.name ?? '';
      const fieldType = field?.fieldType ?? 'text';
      const issues: ColumnValidation['issues'] = [];

      for (let rowIdx = 0; rowIdx < rowsToCheck.length; rowIdx++) {
        const row = rowsToCheck[rowIdx]!;
        const value = row[mapping.csvColumnIndex] ?? '';
        const reason = validateValue(value, fieldType);
        if (reason) {
          issues.push({
            row: rowIdx + 1,
            value: value.length > 50 ? value.slice(0, 50) + '…' : value,
            reason,
          });
        }
      }

      return {
        fieldId: mapping.fieldId!,
        fieldName,
        csvColumnName: mapping.csvColumnName,
        totalChecked: rowsToCheck.length,
        passCount: rowsToCheck.length - issues.length,
        issues,
      };
    });
  }, [csvRows, mappings, fields]);

  const totalIssues = validations.reduce((sum, v) => sum + v.issues.length, 0);

  const toggleExpand = (fieldId: string) => {
    setExpandedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{t('validation_title')}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t('validation_description', { rows: Math.min(csvRows.length, 100) })}
        </p>
      </div>

      {/* Column validation results */}
      <div className="space-y-1 max-h-[350px] overflow-y-auto">
        {validations.map((v) => {
          const hasIssues = v.issues.length > 0;
          const isExpanded = expandedColumns.has(v.fieldId);

          return (
            <div key={v.fieldId} className="rounded-md border">
              <button
                className="flex items-center gap-2 w-full px-3 py-2 text-left"
                onClick={() => hasIssues && toggleExpand(v.fieldId)}
                disabled={!hasIssues}
                type="button"
              >
                {hasIssues ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                )}
                <span className="text-xs font-medium flex-1 truncate">
                  {v.csvColumnName}
                  <span className="text-muted-foreground font-normal ml-1">→ {v.fieldName}</span>
                </span>
                {hasIssues && (
                  <>
                    <span className="text-xs text-amber-600">
                      {t('validation_issues_count', { count: v.issues.length })}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </>
                )}
                {!hasIssues && (
                  <span className="text-xs text-green-600">{t('validation_all_valid')}</span>
                )}
              </button>

              {/* Expanded issue list */}
              {isExpanded && hasIssues && (
                <div className="border-t px-3 py-2 bg-muted/30 space-y-1">
                  {v.issues.slice(0, 20).map((issue, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground w-12 shrink-0">
                        {t('validation_row', { row: issue.row })}
                      </span>
                      <span className="font-mono truncate flex-1">{issue.value || t('validation_empty')}</span>
                      <span className="text-amber-600 shrink-0">{t(`validation_reason_${issue.reason}`)}</span>
                    </div>
                  ))}
                  {v.issues.length > 20 && (
                    <p className="text-[11px] text-muted-foreground">
                      {t('validation_more_issues', { count: v.issues.length - 20 })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {totalIssues > 0 && (
        <p className="text-xs text-amber-600">
          {t('validation_warning', { count: totalIssues })}
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t('back')}
        </Button>
        <Button size="sm" onClick={onConfirm}>
          {totalIssues > 0 ? t('proceed_with_issues') : t('next')}
        </Button>
      </div>
    </div>
  );
}
