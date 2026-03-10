'use client';

/**
 * CsvImportWizard — 5-step linear CSV import flow.
 *
 * Steps: Upload → Preview → Field Mapping → Validation → Execution
 * Opens from the "Import" button in the grid toolbar.
 *
 * @see docs/reference/tables-and-views.md § CSV/Data Import — MVP
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Field } from '@everystack/shared/db';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { ImportUpload } from './ImportUpload';
import { ImportPreview } from './ImportPreview';
import { ImportFieldMapping } from './ImportFieldMapping';
import { ImportValidation } from './ImportValidation';
import { ImportExecution } from './ImportExecution';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedCsvData {
  headers: string[];
  rows: string[][];
}

export interface FieldMapping {
  csvColumnIndex: number;
  csvColumnName: string;
  fieldId: string | null; // null = skip
}

export interface CsvImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  tableName: string;
  fields: Field[];
  isSynced: boolean;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type ImportStep = 1 | 2 | 3 | 4 | 5;

const TOTAL_STEPS = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CsvImportWizard({
  open,
  onOpenChange,
  tableId,
  tableName,
  fields,
  isSynced,
}: CsvImportWizardProps) {
  const t = useTranslations('import');

  const [step, setStep] = useState<ImportStep>(1);
  const [csvData, setCsvData] = useState<ParsedCsvData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [hasHeader, setHasHeader] = useState(true);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setCsvData(null);
    setFileName('');
    setHasHeader(true);
    setMappings([]);
    setIsComplete(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset],
  );

  const handleUploadComplete = useCallback(
    (data: ParsedCsvData, name: string) => {
      setCsvData(data);
      setFileName(name);
      setStep(2);
    },
    [],
  );

  const handlePreviewConfirm = useCallback(
    (headerToggle: boolean) => {
      setHasHeader(headerToggle);
      setStep(3);
    },
    [],
  );

  const handleMappingConfirm = useCallback(
    (newMappings: FieldMapping[]) => {
      setMappings(newMappings);
      setStep(4);
    },
    [],
  );

  const handleValidationConfirm = useCallback(() => {
    setStep(5);
  }, []);

  const handleImportComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => (s > 1 ? ((s - 1) as ImportStep) : s));
  }, []);

  // Compute effective headers and rows based on header toggle
  const effectiveHeaders = csvData
    ? hasHeader
      ? csvData.headers
      : csvData.headers.map((_, i) => t('column_default', { index: i + 1 }))
    : [];
  const effectiveRows = csvData
    ? hasHeader
      ? csvData.rows
      : [csvData.headers, ...csvData.rows]
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        {/* Step indicator */}
        <div className="flex items-center gap-2 border-b px-6 py-4">
          <span className="text-sm font-semibold">{t('title')}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {t('step_indicator', { current: step, total: TOTAL_STEPS })}
          </span>
        </div>

        <div className="px-6 py-4">
          {/* Step 1: Upload */}
          {step === 1 && (
            <ImportUpload
              onUploadComplete={handleUploadComplete}
              isSynced={isSynced}
            />
          )}

          {/* Step 2: Preview */}
          {step === 2 && csvData && (
            <ImportPreview
              headers={csvData.headers}
              rows={hasHeader ? csvData.rows : [csvData.headers, ...csvData.rows]}
              hasHeader={hasHeader}
              onHasHeaderChange={setHasHeader}
              fileName={fileName}
              onNext={() => handlePreviewConfirm(hasHeader)}
              onBack={goBack}
            />
          )}

          {/* Step 3: Field Mapping */}
          {step === 3 && (
            <ImportFieldMapping
              csvHeaders={effectiveHeaders}
              fields={fields}
              onConfirm={handleMappingConfirm}
              onBack={goBack}
            />
          )}

          {/* Step 4: Validation */}
          {step === 4 && (
            <ImportValidation
              csvHeaders={effectiveHeaders}
              csvRows={effectiveRows}
              mappings={mappings}
              fields={fields}
              onConfirm={handleValidationConfirm}
              onBack={goBack}
            />
          )}

          {/* Step 5: Execution */}
          {step === 5 && (
            <ImportExecution
              tableId={tableId}
              tableName={tableName}
              csvRows={effectiveRows}
              mappings={mappings}
              fields={fields}
              onComplete={handleImportComplete}
              onClose={() => handleOpenChange(false)}
              isComplete={isComplete}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
