'use client';

/**
 * FilterBuilder — full filter panel with condition rows,
 * AND/OR toggle, nested groups, and add/remove controls.
 *
 * Opened via Cmd+Shift+F (wired as placeholder in 3A-i).
 * Will be placed in toolbar in Prompt 6.
 *
 * @see docs/reference/tables-and-views.md § Filtering
 */

import { memo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, X, FolderPlus } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
  getOperatorsForFieldType,
  isUnaryOperator,
  ME_TOKEN,
  createFilterCondition,
  type FilterCondition,
  type FilterConfig,
  type FilterGroup,
} from './filter-types';
import type { GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilterBuilderProps {
  filters: FilterConfig;
  fields: GridField[];
  activeFilterCount: number;
  onAddCondition: (fieldId: string, operator: string, value: unknown) => void;
  onRemoveCondition: (conditionId: string) => void;
  onUpdateCondition: (
    conditionId: string,
    updates: Partial<Pick<FilterCondition, 'fieldId' | 'operator' | 'value'>>,
  ) => void;
  onAddGroup: () => void;
  onAddConditionToGroup: (
    groupId: string,
    fieldId: string,
    operator: string,
    value: unknown,
  ) => void;
  onRemoveGroup: (groupId: string) => void;
  onSetLogic: (logic: 'and' | 'or') => void;
  onSetGroupLogic: (groupId: string, logic: 'and' | 'or') => void;
  onClearFilters: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FilterBuilder = memo(function FilterBuilder({
  filters,
  fields,
  activeFilterCount,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onAddGroup,
  onAddConditionToGroup,
  onRemoveGroup,
  onSetLogic,
  onSetGroupLogic,
  onClearFilters,
}: FilterBuilderProps) {
  const t = useTranslations('grid.filter');

  const handleAddCondition = useCallback(() => {
    const firstField = fields[0];
    if (!firstField) return;
    const condition = createFilterCondition(firstField.id, firstField.fieldType);
    onAddCondition(condition.fieldId, condition.operator, condition.value);
  }, [fields, onAddCondition]);

  const handleAddConditionToGroup = useCallback(
    (groupId: string) => {
      const firstField = fields[0];
      if (!firstField) return;
      const condition = createFilterCondition(
        firstField.id,
        firstField.fieldType,
      );
      onAddConditionToGroup(
        groupId,
        condition.fieldId,
        condition.operator,
        condition.value,
      );
    },
    [fields, onAddConditionToGroup],
  );

  if (fields.length === 0) return null;

  return (
    <div className="p-3 space-y-3 bg-white border rounded-lg shadow-sm min-w-[360px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('title')}</span>
          {activeFilterCount > 0 && (
            <Badge variant="default" className="h-5 text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-500"
            onClick={onClearFilters}
          >
            {t('clear_all')}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {activeFilterCount === 0 && (
        <p className="text-xs text-slate-400">{t('empty')}</p>
      )}

      {/* Top-level AND/OR toggle */}
      {activeFilterCount > 1 && (
        <LogicToggle logic={filters.logic} onToggle={onSetLogic} />
      )}

      {/* Top-level conditions */}
      {filters.conditions.map((condition) => (
        <ConditionRow
          key={condition.id}
          condition={condition}
          fields={fields}
          onUpdate={onUpdateCondition}
          onRemove={onRemoveCondition}
        />
      ))}

      {/* Nested groups */}
      {filters.groups.map((group) => (
        <GroupBlock
          key={group.id}
          group={group}
          fields={fields}
          onUpdateCondition={onUpdateCondition}
          onRemoveCondition={onRemoveCondition}
          onAddCondition={handleAddConditionToGroup}
          onRemoveGroup={onRemoveGroup}
          onSetGroupLogic={onSetGroupLogic}
        />
      ))}

      {/* Add buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleAddCondition}
        >
          <Plus className="h-3 w-3" />
          {t('add_condition')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onAddGroup}
        >
          <FolderPlus className="h-3 w-3" />
          {t('add_group')}
        </Button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Logic toggle (AND / OR)
// ---------------------------------------------------------------------------

interface LogicToggleProps {
  logic: 'and' | 'or';
  onToggle: (logic: 'and' | 'or') => void;
}

function LogicToggle({ logic, onToggle }: LogicToggleProps) {
  const t = useTranslations('grid.filter');
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={logic === 'and' ? 'default' : 'outline'}
        size="sm"
        className="h-6 text-[10px] px-2"
        onClick={() => onToggle('and')}
      >
        {t('logic_and')}
      </Button>
      <Button
        variant={logic === 'or' ? 'default' : 'outline'}
        size="sm"
        className="h-6 text-[10px] px-2"
        onClick={() => onToggle('or')}
      >
        {t('logic_or')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition row
// ---------------------------------------------------------------------------

interface ConditionRowProps {
  condition: FilterCondition;
  fields: GridField[];
  onUpdate: (
    conditionId: string,
    updates: Partial<Pick<FilterCondition, 'fieldId' | 'operator' | 'value'>>,
  ) => void;
  onRemove: (conditionId: string) => void;
}

function ConditionRow({
  condition,
  fields,
  onUpdate,
  onRemove,
}: ConditionRowProps) {
  const t = useTranslations('grid.filter');
  const field = fields.find((f) => f.id === condition.fieldId);
  const fieldType = field?.fieldType ?? 'text';
  const operators = getOperatorsForFieldType(fieldType);
  const isUnary = isUnaryOperator(condition.operator);

  const handleFieldChange = useCallback(
    (newFieldId: string) => {
      const newField = fields.find((f) => f.id === newFieldId);
      const newType = newField?.fieldType ?? 'text';
      const newOps = getOperatorsForFieldType(newType);
      onUpdate(condition.id, {
        fieldId: newFieldId,
        operator: newOps[0] ?? 'is',
        value: null,
      });
    },
    [fields, condition.id, onUpdate],
  );

  const handleOperatorChange = useCallback(
    (newOperator: string) => {
      const updates: Partial<Pick<FilterCondition, 'operator' | 'value'>> = {
        operator: newOperator,
      };
      if (isUnaryOperator(newOperator)) {
        updates.value = null;
      }
      onUpdate(condition.id, updates);
    },
    [condition.id, onUpdate],
  );

  return (
    <div className="flex items-center gap-2">
      {/* Field selector */}
      <Select value={condition.fieldId} onValueChange={handleFieldChange}>
        <SelectTrigger className="h-8 text-xs flex-1 min-w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.id} value={f.id} className="text-xs">
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select value={condition.operator} onValueChange={handleOperatorChange}>
        <SelectTrigger className="h-8 text-xs w-[130px]">
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

      {/* Value input */}
      {!isUnary && (
        <ConditionValueInput
          field={field}
          operator={condition.operator}
          value={condition.value}
          onChange={(value) => onUpdate(condition.id, { value })}
        />
      )}

      {/* Remove button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 shrink-0"
        onClick={() => onRemove(condition.id)}
        aria-label={t('remove_condition')}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group block (nested conditions with own AND/OR)
// ---------------------------------------------------------------------------

interface GroupBlockProps {
  group: FilterGroup;
  fields: GridField[];
  onUpdateCondition: (
    conditionId: string,
    updates: Partial<Pick<FilterCondition, 'fieldId' | 'operator' | 'value'>>,
  ) => void;
  onRemoveCondition: (conditionId: string) => void;
  onAddCondition: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onSetGroupLogic: (groupId: string, logic: 'and' | 'or') => void;
}

function GroupBlock({
  group,
  fields,
  onUpdateCondition,
  onRemoveCondition,
  onAddCondition,
  onRemoveGroup,
  onSetGroupLogic,
}: GroupBlockProps) {
  const t = useTranslations('grid.filter');

  return (
    <div className="ml-4 pl-3 border-l-2 border-slate-200 space-y-2">
      <div className="flex items-center justify-between">
        {group.conditions.length > 1 && (
          <LogicToggle
            logic={group.logic}
            onToggle={(logic) => onSetGroupLogic(group.id, logic)}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-slate-400"
          onClick={() => onRemoveGroup(group.id)}
          aria-label={t('remove_group')}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {group.conditions.map((condition) => (
        <ConditionRow
          key={condition.id}
          condition={condition}
          fields={fields}
          onUpdate={onUpdateCondition}
          onRemove={onRemoveCondition}
        />
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] gap-1"
        onClick={() => onAddCondition(group.id)}
      >
        <Plus className="h-3 w-3" />
        {t('add_condition')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition value input (for filter builder)
// ---------------------------------------------------------------------------

interface ConditionValueInputProps {
  field: GridField | undefined;
  operator: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ConditionValueInput({
  field,
  operator,
  value,
  onChange,
}: ConditionValueInputProps) {
  const t = useTranslations('grid.filter');
  const fieldType = field?.fieldType ?? 'text';

  // Checkbox — simple toggle
  if (fieldType === 'checkbox') {
    return (
      <div className="flex items-center gap-2 flex-1">
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

  // Numeric types
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
        <div className="flex items-center gap-1 flex-1">
          <Input
            type="number"
            className="h-8 text-xs flex-1"
            placeholder={t('min')}
            value={between.min ?? ''}
            onChange={(e) =>
              onChange({
                ...between,
                min: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
          <span className="text-xs text-slate-400">–</span>
          <Input
            type="number"
            className="h-8 text-xs flex-1"
            placeholder={t('max')}
            value={between.max ?? ''}
            onChange={(e) =>
              onChange({
                ...between,
                max: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
      );
    }
    return (
      <Input
        type="number"
        className="h-8 text-xs flex-1"
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
          <SelectTrigger className="h-8 text-xs flex-1">
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
        className="h-8 text-xs flex-1"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    );
  }

  // People — includes $me token
  if (fieldType === 'people') {
    return (
      <div className="flex items-center gap-1 flex-1">
        <Button
          variant={value === ME_TOKEN ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs shrink-0"
          onClick={() => onChange(value === ME_TOKEN ? null : ME_TOKEN)}
        >
          {t('me_token')}
        </Button>
        {value !== ME_TOKEN && (
          <Input
            className="h-8 text-xs flex-1"
            placeholder={t('value_placeholder')}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
        )}
      </div>
    );
  }

  // Default: text input
  return (
    <Input
      className="h-8 text-xs flex-1"
      placeholder={t('value_placeholder')}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}
