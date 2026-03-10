'use client';

/**
 * Color rules state hook for the grid view.
 *
 * Manages conditional row-level and cell-level color rules,
 * persisted to views.config.color_rules.
 *
 * Row rules apply a background tint to entire rows matching conditions.
 * Cell rules apply a background tint to specific cells matching conditions.
 * Cell rules have higher specificity than row rules.
 *
 * @see docs/reference/tables-and-views.md § Color Coding (Conditional)
 */

import { useCallback, useState } from 'react';
import { generateUUIDv7 } from '@everystack/shared/db';
import type { FilterCondition } from './filter-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColorRule {
  /** Unique identifier for this rule. */
  id: string;
  /** Conditions that must be met for the rule to apply. */
  conditions: FilterCondition[];
  /** Data palette color (light tone hex) to apply as background tint. */
  color: string;
}

export type RowColorRule = ColorRule;

export interface CellColorRule extends ColorRule {
  /** The field ID this cell rule applies to. */
  fieldId: string;
}

export interface ColorRulesConfig {
  row_rules: RowColorRule[];
  cell_rules: CellColorRule[];
}

// ---------------------------------------------------------------------------
// Hook options & return type
// ---------------------------------------------------------------------------

export interface UseColorRulesOptions {
  viewId: string;
  initialColorRules?: ColorRulesConfig;
  onPersist: (viewId: string, colorRules: ColorRulesConfig) => void;
}

export interface UseColorRulesReturn {
  colorRules: ColorRulesConfig;
  addRowRule: (conditions: FilterCondition[], color: string) => void;
  addCellRule: (fieldId: string, conditions: FilterCondition[], color: string) => void;
  updateRule: (ruleId: string, updates: { conditions?: FilterCondition[]; color?: string }) => void;
  removeRule: (ruleId: string) => void;
  clearRules: () => void;
  hasRules: boolean;
}

// ---------------------------------------------------------------------------
// Default empty config
// ---------------------------------------------------------------------------

export function createEmptyColorRulesConfig(): ColorRulesConfig {
  return { row_rules: [], cell_rules: [] };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useColorRules({
  viewId,
  initialColorRules,
  onPersist,
}: UseColorRulesOptions): UseColorRulesReturn {
  const [colorRules, setColorRules] = useState<ColorRulesConfig>(
    initialColorRules ?? createEmptyColorRulesConfig(),
  );

  const addRowRule = useCallback(
    (conditions: FilterCondition[], color: string) => {
      setColorRules((prev) => {
        const newRule: RowColorRule = {
          id: generateUUIDv7(),
          conditions,
          color,
        };
        const next = {
          ...prev,
          row_rules: [...prev.row_rules, newRule],
        };
        onPersist(viewId, next);
        return next;
      });
    },
    [viewId, onPersist],
  );

  const addCellRule = useCallback(
    (fieldId: string, conditions: FilterCondition[], color: string) => {
      setColorRules((prev) => {
        const newRule: CellColorRule = {
          id: generateUUIDv7(),
          fieldId,
          conditions,
          color,
        };
        const next = {
          ...prev,
          cell_rules: [...prev.cell_rules, newRule],
        };
        onPersist(viewId, next);
        return next;
      });
    },
    [viewId, onPersist],
  );

  const updateRule = useCallback(
    (ruleId: string, updates: { conditions?: FilterCondition[]; color?: string }) => {
      setColorRules((prev) => {
        const next = {
          row_rules: prev.row_rules.map((r) =>
            r.id === ruleId ? { ...r, ...updates } : r,
          ),
          cell_rules: prev.cell_rules.map((r) =>
            r.id === ruleId ? { ...r, ...updates } : r,
          ),
        };
        onPersist(viewId, next);
        return next;
      });
    },
    [viewId, onPersist],
  );

  const removeRule = useCallback(
    (ruleId: string) => {
      setColorRules((prev) => {
        const next = {
          row_rules: prev.row_rules.filter((r) => r.id !== ruleId),
          cell_rules: prev.cell_rules.filter((r) => r.id !== ruleId),
        };
        onPersist(viewId, next);
        return next;
      });
    },
    [viewId, onPersist],
  );

  const clearRules = useCallback(() => {
    const empty = createEmptyColorRulesConfig();
    setColorRules(empty);
    onPersist(viewId, empty);
  }, [viewId, onPersist]);

  const hasRules =
    colorRules.row_rules.length > 0 ||
    colorRules.cell_rules.length > 0;

  return {
    colorRules,
    addRowRule,
    addCellRule,
    updateRule,
    removeRule,
    clearRules,
    hasRules,
  };
}

// ---------------------------------------------------------------------------
// Color evaluation — determines row/cell background colors
// ---------------------------------------------------------------------------

/**
 * Evaluate color rules against a record to determine row and cell colors.
 *
 * Returns:
 *  - rowColor: the background tint for the entire row (or null)
 *  - cellColors: map of fieldId → background tint for individual cells
 *
 * Cell colors override row colors (higher specificity).
 */
export function evaluateColorRules(
  record: { canonicalData: unknown },
  colorRules: ColorRulesConfig,
): { rowColor: string | null; cellColors: Record<string, string> } {
  let rowColor: string | null = null;
  const cellColors: Record<string, string> = {};

  const data = record.canonicalData as Record<string, unknown> | null;

  // Evaluate row rules — first matching rule wins
  for (const rule of colorRules.row_rules) {
    if (rule.conditions.length === 0) continue;
    if (matchesConditions(data, rule.conditions)) {
      rowColor = rule.color;
      break;
    }
  }

  // Evaluate cell rules — first matching rule per field wins
  for (const rule of colorRules.cell_rules) {
    if (rule.conditions.length === 0) continue;
    if (cellColors[rule.fieldId]) continue; // already matched
    if (matchesConditions(data, rule.conditions)) {
      cellColors[rule.fieldId] = rule.color;
    }
  }

  return { rowColor, cellColors };
}

/**
 * Check if a record's data matches all conditions (AND logic).
 */
function matchesConditions(
  data: Record<string, unknown> | null,
  conditions: FilterCondition[],
): boolean {
  return conditions.every((c) => matchesCondition(data, c));
}

function matchesCondition(
  data: Record<string, unknown> | null,
  condition: FilterCondition,
): boolean {
  const fieldValue = data?.[condition.fieldId] ?? null;
  const condValue = condition.value;

  switch (condition.operator) {
    case 'is':
      return fieldValue != null && String(fieldValue) === String(condValue);
    case 'is_not':
      return fieldValue == null || String(fieldValue) !== String(condValue);
    case 'contains':
      return (
        typeof fieldValue === 'string' &&
        typeof condValue === 'string' &&
        fieldValue.toLowerCase().includes(condValue.toLowerCase())
      );
    case 'does_not_contain':
      return (
        typeof fieldValue !== 'string' ||
        typeof condValue !== 'string' ||
        !fieldValue.toLowerCase().includes(condValue.toLowerCase())
      );
    case 'starts_with':
      return (
        typeof fieldValue === 'string' &&
        typeof condValue === 'string' &&
        fieldValue.toLowerCase().startsWith(condValue.toLowerCase())
      );
    case 'ends_with':
      return (
        typeof fieldValue === 'string' &&
        typeof condValue === 'string' &&
        fieldValue.toLowerCase().endsWith(condValue.toLowerCase())
      );
    case 'gt':
      return typeof fieldValue === 'number' && typeof condValue === 'number' && fieldValue > condValue;
    case 'gte':
      return typeof fieldValue === 'number' && typeof condValue === 'number' && fieldValue >= condValue;
    case 'lt':
      return typeof fieldValue === 'number' && typeof condValue === 'number' && fieldValue < condValue;
    case 'lte':
      return typeof fieldValue === 'number' && typeof condValue === 'number' && fieldValue <= condValue;
    case 'is_empty':
      return fieldValue == null || fieldValue === '';
    case 'is_not_empty':
      return fieldValue != null && fieldValue !== '';
    case 'is_any_of':
      if (!Array.isArray(condValue)) return false;
      return condValue.some((v) => String(v) === String(fieldValue));
    case 'is_none_of':
      if (!Array.isArray(condValue)) return true;
      return !condValue.some((v) => String(v) === String(fieldValue));
    case 'is_before': {
      if (typeof fieldValue !== 'string' || typeof condValue !== 'string') return false;
      return new Date(fieldValue).getTime() < new Date(condValue).getTime();
    }
    case 'is_after': {
      if (typeof fieldValue !== 'string' || typeof condValue !== 'string') return false;
      return new Date(fieldValue).getTime() > new Date(condValue).getTime();
    }
    default:
      return false;
  }
}
