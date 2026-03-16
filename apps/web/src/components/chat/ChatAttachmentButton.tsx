'use client';

import { useRef, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Paperclip, X, FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatAttachmentButtonProps {
  onAttach: (files: File[]) => void;
  className?: string;
}

interface FilePreview {
  file: File;
  previewUrl?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * ChatAttachmentButton — paperclip button that triggers file picker.
 *
 * Shows file previews after selection: images as thumbnails,
 * other files as icon + name + size.
 */
export function ChatAttachmentButton({
  onAttach,
  className,
}: ChatAttachmentButtonProps) {
  const t = useTranslations('chatEditor');
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<FilePreview[]>([]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);
      const newPreviews: FilePreview[] = files.map((file) => ({
        file,
        previewUrl: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined,
      }));

      setPreviews((prev) => [...prev, ...newPreviews]);
      onAttach(files);

      // Reset input so the same file can be re-selected
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [onAttach],
  );

  const removePreview = useCallback((index: number) => {
    setPreviews((prev) => {
      const removed = prev[index];
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return (
    <>
      <button
        type="button"
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          className,
        )}
        onClick={handleClick}
        aria-label={t('attach')}
        data-testid="chat-attachment-button"
      >
        <Paperclip className="h-4 w-4" />
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        data-testid="chat-attachment-input"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* File previews */}
      {previews.length > 0 && (
        <div
          className="flex flex-wrap gap-2 px-3 py-2"
          data-testid="chat-attachment-previews"
        >
          {previews.map((preview, index) => (
            <div
              key={`${preview.file.name}-${index}`}
              className="relative flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1"
            >
              {preview.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic blob URL, not optimizable
                <img
                  src={preview.previewUrl}
                  alt={preview.file.name}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <FileIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="flex flex-col">
                <span className="max-w-[120px] truncate text-xs">
                  {preview.file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(preview.file.size)}
                </span>
              </div>
              <button
                type="button"
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
                onClick={() => removePreview(index)}
                aria-label={t('removeAttachment')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
