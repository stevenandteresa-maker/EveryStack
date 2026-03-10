/**
 * Grid view TypeScript types.
 *
 * Typed wrappers around database rows and Zod schemas for JSONB config shapes.
 *
 * @see docs/reference/tables-and-views.md § Grid Anatomy
 * @see docs/reference/data-model.md § Views
 */

import { z } from 'zod';
import type { DbRecord, Field, View } from '@everystack/shared/db';
import { filterConfigSchema, filterConditionSchema } from '@/components/grid/filter-types';

// ---------------------------------------------------------------------------
// GridRecord — typed wrapper around records table row
// ---------------------------------------------------------------------------

export type GridRecord = DbRecord;

// ---------------------------------------------------------------------------
// GridField — typed wrapper around fields table row
// ---------------------------------------------------------------------------

export type GridField = Field;

// ---------------------------------------------------------------------------
// ViewConfig — Zod schema for views.config JSONB
// ---------------------------------------------------------------------------

/**
 * Column visibility and width configuration per field.
 */
const columnConfigSchema = z.object({
  fieldId: z.string().uuid(),
  width: z.number().int().min(60).max(800).optional(),
  visible: z.boolean().optional(),
});

/**
 * View configuration stored in views.config JSONB.
 *
 * Controls column widths, frozen columns, row density, and the
 * manager-assigned default flag.
 */
/**
 * Sort level — one sort criterion in a multi-level sort.
 */
export const sortLevelSchema = z.object({
  fieldId: z.string().uuid(),
  direction: z.enum(['asc', 'desc']),
});

export type SortLevel = z.infer<typeof sortLevelSchema>;

/**
 * Group level — one grouping criterion in a multi-level group.
 */
export const groupLevelSchema = z.object({
  fieldId: z.string().uuid(),
  direction: z.enum(['asc', 'desc']),
});

export type GroupLevel = z.infer<typeof groupLevelSchema>;

/**
 * Color rule schemas for conditional row + cell coloring.
 */
const rowColorRuleSchema = z.object({
  id: z.string(),
  conditions: z.array(filterConditionSchema),
  color: z.string(),
});

const cellColorRuleSchema = z.object({
  id: z.string(),
  fieldId: z.string().uuid(),
  conditions: z.array(filterConditionSchema),
  color: z.string(),
});

const colorRulesConfigSchema = z.object({
  row_rules: z.array(rowColorRuleSchema),
  cell_rules: z.array(cellColorRuleSchema),
});

/**
 * Summary footer configuration schema.
 */
const summaryFooterConfigSchema = z.object({
  enabled: z.boolean(),
  columns: z.record(z.string(), z.string()),
});

/**
 * Card layout type — single column, grid, or compact list.
 */
export const cardLayoutSchema = z.enum(['single_column', 'grid', 'compact_list']);
export type CardLayout = z.infer<typeof cardLayoutSchema>;

export const viewConfigSchema = z.object({
  columns: z.array(columnConfigSchema).optional(),
  frozenColumns: z.number().int().min(0).max(5).optional(),
  density: z.enum(['compact', 'medium', 'tall']).optional(),
  isDefault: z.boolean().optional(),
  columnOrder: z.array(z.string().uuid()).optional(),
  columnColors: z.record(z.string().uuid(), z.string()).optional(),
  hidden_fields: z.array(z.string().uuid()).optional(),
  sorts: z.array(sortLevelSchema).optional(),
  filters: filterConfigSchema.optional(),
  groups: z.array(groupLevelSchema).optional(),
  color_rules: colorRulesConfigSchema.optional(),
  summary_footer: summaryFooterConfigSchema.optional(),
  // Card view specific config
  card_layout: cardLayoutSchema.optional(),
  card_columns: z.union([z.literal(2), z.literal(3)]).optional(),
  field_config: z.array(z.string().uuid()).optional(),
});

export type ViewConfig = z.infer<typeof viewConfigSchema>;

// ---------------------------------------------------------------------------
// GridView — typed wrapper around views table row with typed config
// ---------------------------------------------------------------------------

export interface GridView extends Omit<View, 'config'> {
  config: ViewConfig;
}

// ---------------------------------------------------------------------------
// Row density pixel heights
// ---------------------------------------------------------------------------

export const ROW_DENSITY_HEIGHTS = {
  compact: 32,
  medium: 44,
  tall: 64,
} as const;

export type RowDensity = keyof typeof ROW_DENSITY_HEIGHTS;
