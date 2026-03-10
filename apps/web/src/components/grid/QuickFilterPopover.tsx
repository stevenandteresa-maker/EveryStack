'use client';

/**
 * QuickFilterPopover — field-appropriate dropdown from column header
 * for quickly applying a single filter condition.
 *
 * @see docs/reference/tables-and-views.md § Filtering
 */

import { memo, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Filter } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getOperatorsForFieldType,
  isUnaryOperator,
  ME_TOKEN,
} from './filter-types';
import type { GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuickFilterPopoverProps {
  field: GridField;
  hasActiveFilter: boolean;
  onApplyFilter: (
    fieldId: string,
    operator: string,
    value: unknown,
  ) => void;
  onClearFilter: (fieldId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const QuickFilterPopover = memo(function QuickFilterPopover({
  field,
  hasActiveFilter,
  onApplyFilter,
  onClearFilter,
}: QuickFilterPopoverProps) {
  const t = useTranslations('grid.filter');
  const [open, setOpen] = useState(false);
  const operators = getOperatorsForFieldType(field.fieldType);
  const [selectedOperator, setSelectedOperator] = useState<string>(
    operators[0] ?? 'is',
  );
  const [filterValue, setFilterValue] = useState<unknown>(null);

  const handleApply = useCallback(() => {
    onApplyFilter(field.id, selectedOperator, filterValue);
    setOpen(false);
  }, [field.id, selectedOperator, filterValue, onApplyFilter]);

  const handleClear = useCallback(() => {
    onClearFilter(field.id);
    setFilterValue(null);
    setSelectedOperator(operators[0] ?? 'is');
    setOpen(false);
  }, [field.id, onClearFilter, operators]);

  const handleOperatorChange = useCallback(
    (value: string) => {
      setSelectedOperator(value);
      if (isUnaryOperator(value)) {
        setFilterValue(null);
      }
    },
    [],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 flex items-center justify-center w-4 h-4 rounded-sm transition-opacity opacity-0 group-hover/header:opacity-40 hover:opacity-100"
          aria-label={t('quick_filter_label', { field: field.name })}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-600">
            {t('quick_filter_title', { field: field.name })}
          </p>

          {/* Operator selector */}
          <Select
            value={selectedOperator}
            onValueChange={handleOperatorChange}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op} className="text-xs">
                  {t(`operator_${op}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value input (hidden for unary operators) */}
          {!isUnaryOperator(selectedOperator) && (
            <FilterValueInput
              field={field}
              operator={selectedOperator}
              value={filterValue}
              onChange={setFilterValue}
            />
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={handleApply}
            >
              {t('apply')}
            </Button>
            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleClear}
              >
                {t('clear')}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

// ---------------------------------------------------------------------------
// Value input per field type
// ---------------------------------------------------------------------------

interface FilterValueInputProps {
  field: GridField;
  operator: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FilterValueInput({
  field,
  operator,
  value,
  onChange,
}: FilterValueInputProps) {
  const t = useTranslations('grid.filter');
  const fieldType = field.fieldType;

  // Checkbox — simple toggle
  if (fieldType === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span className="text-xs text-slate-600">
          {value === true ? t('checked') : t('unchecked')}
        </span>
      </div>
    );
  }

  // Number / Currency / Percent / Rating / Duration
  if (
    fieldType === 'number' ||
    fieldType === 'currency' ||
    fieldType === 'percent' ||
    fieldType === 'rating' ||
    fieldType === 'duration'
  ) {
    if (operator === 'between') {
      const between = (value as { min?: number; max?: number }) ?? {};
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="h-8 text-xs flex-1"
            placeholder={t('min')}
            value={between.min ?? ''}
            onChange={(e) =>
              onChange({ ...between, min: e.target.value ? Number(e.target.value) : undefined })
            }
          />
          <span className="text-xs text-slate-400">–</span>
          <Input
            type="number"
            className="h-8 text-xs flex-1"
            placeholder={t('max')}
            value={between.max ?? ''}
            onChange={(e) =>
              onChange({ ...between, max: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
      );
    }
    return (
      <Input
        type="number"
        className="h-8 text-xs"
        placeholder={t('value_placeholder')}
        value={(value as number) ?? ''}
        onChange={(e) =>
          onChange(e.target.value ? Number(e.target.value) : null)
        }
      />
    );
  }

  // Date / DateTime
  if (fieldType === 'date' || fieldType === 'datetime') {
    if (operator === 'is_within') {
      return (
        <Select
          value={(value as string) ?? ''}
          onValueChange={onChange}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={t('select_preset')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_7_days" className="text-xs">
              {t('preset_last_7_days')}
            </SelectItem>
            <SelectItem value="last_30_days" className="text-xs">
              {t('preset_last_30_days')}
            </SelectItem>
            <SelectItem value="this_week" className="text-xs">
              {t('preset_this_week')}
            </SelectItem>
            <SelectItem value="this_month" className="text-xs">
              {t('preset_this_month')}
            </SelectItem>
            <SelectItem value="this_year" className="text-xs">
              {t('preset_this_year')}
            </SelectItem>
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        type={fieldType === 'datetime' ? 'datetime-local' : 'date'}
        className="h-8 text-xs"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    );
  }

  // People — includes $me token
  if (fieldType === 'people') {
    return (
      <div className="space-y-2">
        <Button
          variant={value === ME_TOKEN ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs w-full"
          onClick={() => onChange(value === ME_TOKEN ? null : ME_TOKEN)}
        >
          {t('me_token')}
        </Button>
        <Input
          className="h-8 text-xs"
          placeholder={t('value_placeholder')}
          value={value === ME_TOKEN ? '' : ((value as string) ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    );
  }

  // Default: text input
  return (
    <Input
      className="h-8 text-xs"
      placeholder={t('value_placeholder')}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}
