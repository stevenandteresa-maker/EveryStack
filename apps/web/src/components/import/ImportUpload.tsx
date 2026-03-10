'use client';

/**
 * ImportUpload — Step 1: file upload via drag-and-drop or file input.
 *
 * Accepts .csv and .tsv files, max 10MB.
 * Parses client-side using Papaparse.
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Papa from 'papaparse';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import type { ParsedCsvData } from './CsvImportWizard';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_EXTENSIONS = ['.csv', '.tsv'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportUploadProps {
  onUploadComplete: (data: ParsedCsvData, fileName: string) => void;
  isSynced: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportUpload({ onUploadComplete, isSynced }: ImportUploadProps) {
  const t = useTranslations('import');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (isSynced) {
        return t('error_synced_table');
      }

      const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        return t('error_invalid_type');
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return t('error_file_too_large', { maxMb: 10 });
      }

      return null;
    },
    [isSynced, t],
  );

  const parseFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setIsParsing(true);

      const isTsv = file.name.toLowerCase().endsWith('.tsv');

      Papa.parse(file, {
        delimiter: isTsv ? '\t' : undefined,
        skipEmptyLines: true,
        complete: (results) => {
          setIsParsing(false);
          const data = results.data as string[][];

          if (data.length < 2) {
            setError(t('error_no_data'));
            return;
          }

          const headers = data[0] ?? [];
          const rows = data.slice(1);

          onUploadComplete({ headers, rows }, file.name);
        },
        error: (err) => {
          setIsParsing(false);
          setError(t('error_parse_failed', { message: err.message }));
        },
      });
    },
    [validateFile, onUploadComplete, t],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        parseFile(file);
      }
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [parseFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        parseFile(file);
      }
    },
    [parseFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  if (isSynced) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('error_synced_table')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{t('upload_title')}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t('upload_description')}</p>
      </div>

      {/* Drop zone */}
      <div
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed
          py-12 px-6 transition-colors cursor-pointer
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={t('upload_drop_zone')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        {isParsing ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-10 w-10 text-muted-foreground animate-pulse" />
            <p className="text-sm text-muted-foreground">{t('parsing')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm">{t('upload_drag_prompt')}</p>
            <p className="text-xs text-muted-foreground">{t('upload_formats')}</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv"
        className="hidden"
        onChange={handleFileSelect}
        aria-label={t('upload_file_input')}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
