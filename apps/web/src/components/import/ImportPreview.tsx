'use client';

/**
 * ImportPreview — Step 2: preview first 10 rows with header detection toggle.
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportPreviewProps {
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
  onHasHeaderChange: (value: boolean) => void;
  fileName: string;
  onNext: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportPreview({
  headers,
  rows,
  hasHeader,
  onHasHeaderChange,
  fileName,
  onNext,
  onBack,
}: ImportPreviewProps) {
  const t = useTranslations('import');

  // Display first 10 rows
  const previewRows = rows.slice(0, 10);
  const displayHeaders = hasHeader ? headers : headers.map((_, i) => t('column_default', { index: i + 1 }));
  const displayRows = hasHeader ? previewRows : [headers, ...previewRows].slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{t('preview_title')}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t('preview_description', { fileName, columns: headers.length, rows: rows.length })}
        </p>
      </div>

      {/* Header toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="first-row-header"
          checked={hasHeader}
          onChange={(e) => onHasHeaderChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="first-row-header" className="text-xs">
          {t('preview_first_row_header')}
        </Label>
      </div>

      {/* Preview table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">#</th>
              {displayHeaders.map((header, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium truncate max-w-[150px]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t">
                <td className="px-3 py-2 text-muted-foreground">{rowIdx + 1}</td>
                {displayHeaders.map((_, colIdx) => (
                  <td key={colIdx} className="px-3 py-2 truncate max-w-[150px]">
                    {row[colIdx] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 10 && (
        <p className="text-xs text-muted-foreground">
          {t('preview_more_rows', { remaining: rows.length - 10 })}
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t('back')}
        </Button>
        <Button size="sm" onClick={onNext}>
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
