'use client';

/**
 * SyncFilterBuilder — Reusable filter builder for sync setup and view filters.
 *
 * Supports two modes:
 * - `platform`: fieldId = external platform field ID (used during sync setup)
 * - `es`: fieldId = EveryStack field UUID (used post-setup)
 *
 * Operator compatibility is defined via a Map (not switch statements),
 * per the FieldTypeRegistry pattern.
 */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FilterOperator, FilterRule } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterField {
  id: string;
  name: string;
  type: string;
}

export interface SyncFilterBuilderProps {
  fields: FilterField[];
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
  mode: 'platform' | 'es';
}

// ---------------------------------------------------------------------------
// Operator compatibility map (per field type category)
// ---------------------------------------------------------------------------

const TEXT_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty',
];

const NUMBER_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal',
  'less_equal', 'is_empty', 'is_not_empty',
];

const SELECT_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'is_any_of', 'is_none_of', 'is_empty', 'is_not_empty',
];

const DATE_OPERATORS: FilterOperator[] = [
  'equals', 'is_before', 'is_after', 'is_empty', 'is_not_empty',
];

const CHECKBOX_OPERATORS: FilterOperator[] = ['equals'];

const DEFAULT_OPERATORS: FilterOperator[] = [
  'equals', 'not_equals', 'is_empty', 'is_not_empty',
];

/**
 * Maps Airtable field type strings to compatible operators.
 * Uses field type category mapping rather than switch statements.
 */
const FIELD_TYPE_OPERATORS = new Map<string, FilterOperator[]>([
  // Text types
  ['singleLineText', TEXT_OPERATORS],
  ['multilineText', TEXT_OPERATORS],
  ['richText', TEXT_OPERATORS],
  ['email', TEXT_OPERATORS],
  ['url', TEXT_OPERATORS],
  ['phoneNumber', TEXT_OPERATORS],
  ['text', TEXT_OPERATORS],
  ['text_area', TEXT_OPERATORS],
  // Number types
  ['number', NUMBER_OPERATORS],
  ['currency', NUMBER_OPERATORS],
  ['percent', NUMBER_OPERATORS],
  ['rating', NUMBER_OPERATORS],
  ['duration', NUMBER_OPERATORS],
  ['autoNumber', NUMBER_OPERATORS],
  ['count', NUMBER_OPERATORS],
  // Select types
  ['singleSelect', SELECT_OPERATORS],
  ['multipleSelects', SELECT_OPERATORS],
  ['status', SELECT_OPERATORS],
  ['single_select', SELECT_OPERATORS],
  ['multiple_select', SELECT_OPERATORS],
  // Date types
  ['date', DATE_OPERATORS],
  ['dateTime', DATE_OPERATORS],
  ['createdTime', DATE_OPERATORS],
  ['lastModifiedTime', DATE_OPERATORS],
  // Checkbox
  ['checkbox', CHECKBOX_OPERATORS],
]);

function getOperatorsForFieldType(fieldType: string): FilterOperator[] {
  return FIELD_TYPE_OPERATORS.get(fieldType) ?? DEFAULT_OPERATORS;
}

// ---------------------------------------------------------------------------
// Operator display labels
// ---------------------------------------------------------------------------

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  greater_than: 'greater than',
  less_than: 'less than',
  greater_equal: 'greater or equal',
  less_equal: 'less or equal',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  is_any_of: 'is any of',
  is_none_of: 'is none of',
  is_before: 'is before',
  is_after: 'is after',
  is_within: 'is within',
};

const VALUE_FREE_OPERATORS = new Set<FilterOperator>([
  'is_empty', 'is_not_empty',
]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncFilterBuilder({
  fields,
  filters,
  onChange,
  mode: _mode,
}: SyncFilterBuilderProps) {
  const t = useTranslations('sync_wizard');

  const addFilter = useCallback(() => {
    const firstField = fields[0];
    if (!firstField) return;

    const operators = getOperatorsForFieldType(firstField.type);
    const newRule: FilterRule = {
      fieldId: firstField.id,
      operator: operators[0] ?? 'equals',
      value: '',
      conjunction: 'and',
    };
    onChange([...filters, newRule]);
  }, [fields, filters, onChange]);

  const removeFilter = useCallback(
    (index: number) => {
      onChange(filters.filter((_, i) => i !== index));
    },
    [filters, onChange],
  );

  const updateFilter = useCallback(
    (index: number, updates: Partial<FilterRule>) => {
      onChange(
        filters.map((rule, i) => (i === index ? { ...rule, ...updates } : rule)),
      );
    },
    [filters, onChange],
  );

  const handleFieldChange = useCallback(
    (index: number, fieldId: string) => {
      const field = fields.find((f) => f.id === fieldId);
      const operators = field
        ? getOperatorsForFieldType(field.type)
        : DEFAULT_OPERATORS;
      updateFilter(index, {
        fieldId,
        operator: operators[0] ?? 'equals',
        value: '',
      });
    },
    [fields, updateFilter],
  );

  return (
    <div className="space-y-2" data-testid="sync-filter-builder">
      {filters.map((rule, index) => {
        const field = fields.find((f) => f.id === rule.fieldId);
        const operators = field
          ? getOperatorsForFieldType(field.type)
          : DEFAULT_OPERATORS;

        return (
          <div key={index} className="flex items-center gap-2">
            {/* Conjunction label */}
            {index > 0 && (
              <Select
                value={rule.conjunction}
                onValueChange={(val: 'and' | 'or') =>
                  updateFilter(index, { conjunction: val })
                }
              >
                <SelectTrigger className="w-[72px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">{t('filter_and')}</SelectItem>
                  <SelectItem value="or">{t('filter_or')}</SelectItem>
                </SelectContent>
              </Select>
            )}
            {index === 0 && <div className="w-[72px] text-xs text-muted-foreground px-2">{t('filter_where')}</div>}

            {/* Field selector */}
            <Select
              value={rule.fieldId}
              onValueChange={(val) => handleFieldChange(index, val)}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Operator selector */}
            <Select
              value={rule.operator}
              onValueChange={(val) =>
                updateFilter(index, {
                  operator: val as FilterOperator,
                  value: VALUE_FREE_OPERATORS.has(val as FilterOperator)
                    ? null
                    : rule.value,
                })
              }
            >
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Value input */}
            {!VALUE_FREE_OPERATORS.has(rule.operator) && (
              <Input
                className="h-8 text-xs flex-1"
                value={typeof rule.value === 'string' ? rule.value : ''}
                onChange={(e) =>
                  updateFilter(index, { value: e.target.value })
                }
                placeholder={t('filter_value_placeholder')}
              />
            )}

            {/* Remove button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => removeFilter(index)}
              aria-label={t('filter_remove')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={addFilter}
        disabled={fields.length === 0}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t('filter_add')}
      </Button>
    </div>
  );
}
