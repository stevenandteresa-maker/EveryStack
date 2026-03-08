'use client';

/**
 * ChecklistCell — display and edit components for checklist field type.
 *
 * Display: Compact "3/7 done" text + mini progress bar.
 * Edit: Popover with checklist items, checkbox per item, add new item.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: unknown, index: number) => {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return {
        id: typeof obj['id'] === 'string' ? obj['id'] : `item-${index}`,
        text: typeof obj['text'] === 'string' ? obj['text'] : '',
        checked: Boolean(obj['checked']),
      };
    }
    return { id: `item-${index}`, text: String(item), checked: false };
  });
}

export function ChecklistCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const items = parseChecklist(value);

  if (items.length === 0) return null;

  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex w-full items-center gap-2">
      <span className="shrink-0 text-sm text-slate-600">
        {t('checklist_progress', { done, total })}
      </span>
      <div className="h-1.5 min-w-8 flex-1 rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      </div>
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

export function ChecklistCellEdit({ value, onSave, onCancel }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const [items, setItems] = useState<ChecklistItem[]>(() => parseChecklist(value));
  const [newItemText, setNewItemText] = useState('');
  const newItemRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    newItemRef.current?.focus();
  }, []);

  const handleToggle = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item,
    );
    setItems(updated);
    onSave(updated);
  };

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      checked: false,
    };
    const updated = [...items, newItem];
    setItems(updated);
    setNewItemText('');
    onSave(updated);
  };

  return (
    <div
      className="flex max-h-48 w-64 flex-col gap-1 overflow-y-auto rounded-md border bg-white p-2 shadow-md"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      {items.map((item) => (
        <label
          key={item.id}
          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50"
        >
          <Checkbox
            checked={item.checked}
            onCheckedChange={() => handleToggle(item.id)}
            aria-label={item.text}
          />
          <span
            className={cn(
              'text-sm',
              item.checked && 'text-slate-400 line-through',
            )}
          >
            {item.text}
          </span>
        </label>
      ))}
      <div className="flex items-center gap-1 border-t pt-1">
        <input
          ref={newItemRef}
          type="text"
          className="flex-1 text-sm outline-none placeholder:text-slate-400"
          placeholder={t('checklist_add_item')}
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddItem();
            }
          }}
        />
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600"
          onClick={handleAddItem}
          aria-label={t('checklist_add_item')}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
