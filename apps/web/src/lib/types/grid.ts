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
import { filterConfigSchema } from '@/components/grid/filter-types';

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

export const viewConfigSchema = z.object({
  columns: z.array(columnConfigSchema).optional(),
  frozenColumns: z.number().int().min(0).max(5).optional(),
  density: z.enum(['compact', 'medium', 'tall']).optional(),
  isDefault: z.boolean().optional(),
  columnOrder: z.array(z.string().uuid()).optional(),
  columnColors: z.record(z.string().uuid(), z.string()).optional(),
  sorts: z.array(sortLevelSchema).optional(),
  filters: filterConfigSchema.optional(),
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
