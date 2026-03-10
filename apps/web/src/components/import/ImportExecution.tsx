'use client';

/**
 * ImportExecution — Step 5: batch import with progress bar.
 *
 * Calls importRecords server action, shows progress, and
 * provides a downloadable error report on completion.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { Field } from '@everystack/shared/db';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { importRecords } from '@/actions/import-actions';
import type { ImportResult, ImportRowError } from '@/actions/import-actions';
import type { FieldMapping } from './CsvImportWizard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportExecutionProps {
  tableId: string;
  tableName: string;
  csvRows: string[][];
  mappings: FieldMapping[];
  fields: Field[];
  onComplete: () => void;
  onClose: () => void;
  isComplete: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_BATCH_SIZE = 500; // Send 500 rows per server action call

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCanonicalRows(
  csvRows: string[][],
  mappings: FieldMapping[],
  fields: Field[],
): Record<string, unknown>[] {
  const activeMappings = mappings.filter((m) => m.fieldId !== null);

  return csvRows.map((row) => {
    const canonicalData: Record<string, unknown> = {};

    for (const mapping of activeMappings) {
      const rawValue = row[mapping.csvColumnIndex] ?? '';
      const field = fields.find((f) => f.id === mapping.fieldId);
      if (!field || rawValue === '') continue;

      // Basic type coercion
      canonicalData[mapping.fieldId!] = coerceValue(rawValue, field.fieldType);
    }

    return canonicalData;
  });
}

function coerceValue(value: string, fieldType: string): unknown {
  switch (fieldType) {
    case 'number':
    case 'currency':
    case 'percent': {
      const cleaned = value.replace(/[$,%\s]/g, '');
      const num = Number(cleaned);
      return isNaN(num) ? value : num;
    }
    case 'checkbox': {
      const lower = value.toLowerCase();
      return ['true', '1', 'yes'].includes(lower);
    }
    case 'rating': {
      const num = parseInt(value, 10);
      return isNaN(num) ? 0 : num;
    }
    default:
      return value;
  }
}

function generateErrorCsv(errors: ImportRowError[]): string {
  const header = 'Row,Field,Error';
  const rows = errors.map(
    (e) => `${e.row},"${e.field.replace(/"/g, '""')}","${e.error.replace(/"/g, '""')}"`,
  );
  return [header, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportExecution({
  tableId,
  tableName,
  csvRows,
  mappings,
  fields,
  onComplete,
  onClose,
  isComplete: _isComplete,
}: ImportExecutionProps) {
  const t = useTranslations('import');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const totalRows = csvRows.length;

  const runImport = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setIsRunning(true);
    setError(null);

    const canonicalRows = buildCanonicalRows(csvRows, mappings, fields);

    let totalImported = 0;
    let totalFailed = 0;
    const allErrors: ImportRowError[] = [];

    // Send in batches to the server action
    for (let i = 0; i < canonicalRows.length; i += CLIENT_BATCH_SIZE) {
      const batch = canonicalRows.slice(i, i + CLIENT_BATCH_SIZE);

      try {
        const batchResult = await importRecords({
          tableId,
          rows: batch,
        });

        totalImported += batchResult.imported;
        totalFailed += batchResult.failed;

        // Offset error row numbers to account for batch position
        const offsetErrors = batchResult.errors.map((e) => ({
          ...e,
          row: e.row + i,
        }));
        allErrors.push(...offsetErrors);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Import batch failed';
        setError(message);
        // Mark remaining rows in this batch as failed
        for (let j = 0; j < batch.length; j++) {
          allErrors.push({ row: i + j + 1, field: '', error: message });
        }
        totalFailed += batch.length;
      }

      setProgress(Math.min(i + batch.length, canonicalRows.length));
    }

    setResult({ imported: totalImported, failed: totalFailed, errors: allErrors });
    setIsRunning(false);
    onComplete();
  }, [csvRows, mappings, fields, tableId, onComplete]);

  useEffect(() => {
    // Async import triggered on mount
    void runImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadErrors = useCallback(() => {
    if (!result?.errors.length) return;
    const csv = generateErrorCsv(result.errors);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${tableName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, tableName]);

  const progressPercent = totalRows > 0 ? Math.round((progress / totalRows) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{t('execution_title')}</h3>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs">
              {t('execution_progress', { current: progress, total: totalRows })}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Result */}
      {result && !isRunning && (
        <div className="space-y-3">
          {/* Success */}
          {result.imported > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-green-50 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-green-700">
                {t('execution_success', { count: result.imported })}
              </p>
            </div>
          )}

          {/* Errors */}
          {result.failed > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs text-amber-700">
                  {t('execution_errors', { count: result.failed })}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={handleDownloadErrors}
                >
                  <Download className="h-3 w-3" />
                  {t('execution_download_errors')}
                </Button>
              </div>
            </div>
          )}

          {/* Server error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Close button */}
      {!isRunning && result && (
        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={onClose}>
            {t('done')}
          </Button>
        </div>
      )}
    </div>
  );
}
