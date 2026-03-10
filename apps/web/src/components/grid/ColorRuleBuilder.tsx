'use client';

/**
 * ColorRuleBuilder — panel for managing conditional row and cell color rules.
 *
 * Displays row rules and cell rules in separate sections, each with
 * condition builder + color palette swatch picker. Uses the same
 * FilterCondition type from the filter system.
 *
 * @see docs/reference/tables-and-views.md § Color Coding (Conditional)
 */

import { memo, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Paintbrush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { DATA_COLORS } from '@/lib/design-system/colors';
import type { GridField } from '@/lib/types/grid';
import type { FilterCondition } from './filter-types';
import {
  getOperatorsForFieldType,
  isUnaryOperator,
  createFilterCondition,
} from './filter-types';
import type { ColorRulesConfig, RowColorRule, CellColorRule } from './use-color-rules';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ColorRuleBuilderProps {
  colorRules: ColorRulesConfig;
  fields: GridField[];
  onAddRowRule: (conditions: FilterCondition[], color: string) => void;
  onAddCellRule: (fieldId: string, conditions: FilterCondition[], color: string) => void;
  onUpdateRule: (ruleId: string, updates: { conditions?: FilterCondition[]; color?: string }) => void;
  onRemoveRule: (ruleId: string) => void;
  onClearRules: () => void;
}

// ---------------------------------------------------------------------------
// Color palette swatches (light tones from data palette)
// ---------------------------------------------------------------------------

const COLOR_SWATCHES = DATA_COLORS.map((c) => ({
  name: c.name,
  hex: c.light,
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ColorRuleBuilder = memo(function ColorRuleBuilder({
  colorRules,
  fields,
  onAddRowRule,
  onAddCellRule,
  onUpdateRule,
  onRemoveRule,
  onClearRules,
}: ColorRuleBuilderProps) {
  const t = useTranslations('grid.color');

  const handleAddRowRule = useCallback(() => {
    const firstField = fields[0];
    if (!firstField) return;
    const condition = createFilterCondition(firstField.id, firstField.fieldType);
    onAddRowRule([condition], COLOR_SWATCHES[0]?.hex ?? '#FEE2E2');
  }, [fields, onAddRowRule]);

  const handleAddCellRule = useCallback(() => {
    const firstField = fields[0];
    if (!firstField) return;
    const condition = createFilterCondition(firstField.id, firstField.fieldType);
    onAddCellRule(firstField.id, [condition], COLOR_SWATCHES[0]?.hex ?? '#FEE2E2');
  }, [fields, onAddCellRule]);

  return (
    <div className="flex flex-col gap-4 p-3" style={{ minWidth: 320 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paintbrush className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium">{t('title')}</span>
        </div>
        {(colorRules.row_rules.length > 0 || colorRules.cell_rules.length > 0) && (
          <Button variant="ghost" size="sm" onClick={onClearRules} className="h-7 text-xs">
            {t('clear_all')}
          </Button>
        )}
      </div>

      {/* Row rules section */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-slate-500">{t('row_rules')}</span>
        {colorRules.row_rules.length === 0 && (
          <span className="text-xs text-slate-400">{t('no_row_rules')}</span>
        )}
        {colorRules.row_rules.map((rule) => (
          <RowRuleRow
            key={rule.id}
            rule={rule}
            fields={fields}
            onUpdate={(updates) => onUpdateRule(rule.id, updates)}
            onRemove={() => onRemoveRule(rule.id)}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddRowRule}
          className="h-7 w-fit text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          {t('add_row_rule')}
        </Button>
      </div>

      <Separator />

      {/* Cell rules section */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-slate-500">{t('cell_rules')}</span>
        {colorRules.cell_rules.length === 0 && (
          <span className="text-xs text-slate-400">{t('no_cell_rules')}</span>
        )}
        {colorRules.cell_rules.map((rule) => (
          <CellRuleRow
            key={rule.id}
            rule={rule}
            fields={fields}
            onUpdate={(updates) => onUpdateRule(rule.id, updates)}
            onRemove={() => onRemoveRule(rule.id)}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddCellRule}
          className="h-7 w-fit text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          {t('add_cell_rule')}
        </Button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Row rule row
// ---------------------------------------------------------------------------

interface RowRuleRowProps {
  rule: RowColorRule;
  fields: GridField[];
  onUpdate: (updates: { conditions?: FilterCondition[]; color?: string }) => void;
  onRemove: () => void;
}

const RowRuleRow = memo(function RowRuleRow({ rule, fields, onUpdate, onRemove }: RowRuleRowProps) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <ColorSwatchPicker
          selectedColor={rule.color}
          onChange={(color) => onUpdate({ color })}
        />
        <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {rule.conditions.map((condition, idx) => (
        <ConditionRow
          key={condition.id}
          condition={condition}
          fields={fields}
          onChange={(updated) => {
            const newConditions = [...rule.conditions];
            newConditions[idx] = updated;
            onUpdate({ conditions: newConditions });
          }}
        />
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Cell rule row
// ---------------------------------------------------------------------------

interface CellRuleRowProps {
  rule: CellColorRule;
  fields: GridField[];
  onUpdate: (updates: { conditions?: FilterCondition[]; color?: string }) => void;
  onRemove: () => void;
}

const CellRuleRow = memo(function CellRuleRow({ rule, fields, onUpdate, onRemove }: CellRuleRowProps) {
  const t = useTranslations('grid.color');
  const field = fields.find((f) => f.id === rule.fieldId);

  return (
    <div className="flex flex-col gap-1 rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {t('cell_field', { field: field?.name ?? '' })}
        </span>
        <div className="flex items-center gap-1">
          <ColorSwatchPicker
            selectedColor={rule.color}
            onChange={(color) => onUpdate({ color })}
          />
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {rule.conditions.map((condition, idx) => (
        <ConditionRow
          key={condition.id}
          condition={condition}
          fields={fields}
          onChange={(updated) => {
            const newConditions = [...rule.conditions];
            newConditions[idx] = updated;
            onUpdate({ conditions: newConditions });
          }}
        />
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Condition row (field + operator + value)
// ---------------------------------------------------------------------------

interface ConditionRowProps {
  condition: FilterCondition;
  fields: GridField[];
  onChange: (updated: FilterCondition) => void;
}

const ConditionRow = memo(function ConditionRow({ condition, fields, onChange }: ConditionRowProps) {
  const t = useTranslations('grid.filter');
  const field = fields.find((f) => f.id === condition.fieldId);
  const operators = field ? getOperatorsForFieldType(field.fieldType) : [];
  const isUnary = isUnaryOperator(condition.operator);

  return (
    <div className="flex items-center gap-1">
      <Select
        value={condition.fieldId}
        onValueChange={(fieldId) => {
          const newField = fields.find((f) => f.id === fieldId);
          const newOps = newField ? getOperatorsForFieldType(newField.fieldType) : [];
          onChange({
            ...condition,
            fieldId,
            operator: newOps[0] ?? 'is',
            value: null,
          });
        }}
      >
        <SelectTrigger className="h-7 w-[100px] text-xs">
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

      <Select
        value={condition.operator}
        onValueChange={(operator) =>
          onChange({ ...condition, operator, value: isUnaryOperator(operator) ? null : condition.value })
        }
      >
        <SelectTrigger className="h-7 w-[110px] text-xs">
          <SelectValue>
            {t(`operator_${condition.operator}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op} value={op} className="text-xs">
              {t(`operator_${op}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!isUnary && (
        <Input
          className="h-7 w-[80px] text-xs"
          value={condition.value != null ? String(condition.value) : ''}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder={t('value_placeholder')}
        />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Color swatch picker
// ---------------------------------------------------------------------------

interface ColorSwatchPickerProps {
  selectedColor: string;
  onChange: (color: string) => void;
}

function ColorSwatchPicker({ selectedColor, onChange }: ColorSwatchPickerProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('grid.color');

  return (
    <div className="relative">
      <button
        type="button"
        className="h-5 w-5 rounded border border-slate-200"
        style={{ backgroundColor: selectedColor }}
        onClick={() => setOpen(!open)}
        aria-label={t('pick_color')}
      />
      {open && (
        <div className="absolute left-0 top-6 z-10 flex flex-wrap gap-1 rounded-md border bg-white p-2 shadow-md"
          style={{ width: 156 }}
        >
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              className="h-5 w-5 rounded border border-slate-200"
              style={{
                backgroundColor: swatch.hex,
                outline: swatch.hex === selectedColor ? '2px solid #3B82F6' : 'none',
                outlineOffset: 1,
              }}
              onClick={() => {
                onChange(swatch.hex);
                setOpen(false);
              }}
              aria-label={swatch.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
