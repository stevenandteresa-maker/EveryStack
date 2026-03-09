/**
 * Aggregation utilities shared between SummaryFooter and GroupFooter.
 *
 * Provides field-type-specific aggregation functions, option discovery,
 * and computation over record sets.
 *
 * @see docs/reference/tables-and-views.md § Summary Footer Row
 */

import type { GridRecord } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Aggregation type constants
// ---------------------------------------------------------------------------

export const AGGREGATION_TYPES = {
  NONE: 'none',
  COUNT: 'count',
  SUM: 'sum',
  AVG: 'avg',
  MIN: 'min',
  MAX: 'max',
  EARLIEST: 'earliest',
  LATEST: 'latest',
  RANGE: 'range',
  CHECKED_COUNT: 'checked_count',
  UNCHECKED_COUNT: 'unchecked_count',
  PERCENT_CHECKED: 'percent_checked',
  COUNT_PER_VALUE: 'count_per_value',
  UNIQUE_COUNT: 'unique_count',
  TOTAL_COUNT: 'total_count',
  LINKED_ROW_COUNT: 'linked_row_count',
  TOTAL_LINK_COUNT: 'total_link_count',
  ROWS_WITH_FILES: 'rows_with_files',
  TOTAL_FILE_COUNT: 'total_file_count',
  FILLED_COUNT: 'filled_count',
  EMPTY_COUNT: 'empty_count',
} as const;

export type AggregationType = (typeof AGGREGATION_TYPES)[keyof typeof AGGREGATION_TYPES];

// ---------------------------------------------------------------------------
// Aggregation result
// ---------------------------------------------------------------------------

export interface AggregationResult {
  /** Formatted display value. */
  value: string;
  /** Raw numeric result (null for non-numeric or distribution results). */
  raw: number | null;
  /** Distribution data for count_per_value (select fields). */
  distribution?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Field type → available aggregation types
// ---------------------------------------------------------------------------

const NUMERIC_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.SUM,
  AGGREGATION_TYPES.AVG,
  AGGREGATION_TYPES.MIN,
  AGGREGATION_TYPES.MAX,
  AGGREGATION_TYPES.COUNT,
  AGGREGATION_TYPES.NONE,
];

const DATE_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.EARLIEST,
  AGGREGATION_TYPES.LATEST,
  AGGREGATION_TYPES.RANGE,
  AGGREGATION_TYPES.COUNT,
  AGGREGATION_TYPES.NONE,
];

const CHECKBOX_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.CHECKED_COUNT,
  AGGREGATION_TYPES.UNCHECKED_COUNT,
  AGGREGATION_TYPES.PERCENT_CHECKED,
  AGGREGATION_TYPES.NONE,
];

const SELECT_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.COUNT_PER_VALUE,
  AGGREGATION_TYPES.NONE,
];

const MULTI_SELECT_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.UNIQUE_COUNT,
  AGGREGATION_TYPES.TOTAL_COUNT,
  AGGREGATION_TYPES.NONE,
];

const PEOPLE_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.UNIQUE_COUNT,
  AGGREGATION_TYPES.NONE,
];

const LINKED_RECORD_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.LINKED_ROW_COUNT,
  AGGREGATION_TYPES.TOTAL_LINK_COUNT,
  AGGREGATION_TYPES.NONE,
];

const ATTACHMENT_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.ROWS_WITH_FILES,
  AGGREGATION_TYPES.TOTAL_FILE_COUNT,
  AGGREGATION_TYPES.NONE,
];

const TEXT_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.FILLED_COUNT,
  AGGREGATION_TYPES.EMPTY_COUNT,
  AGGREGATION_TYPES.NONE,
];

const DEFAULT_AGGREGATIONS: AggregationType[] = [
  AGGREGATION_TYPES.COUNT,
  AGGREGATION_TYPES.NONE,
];

const FIELD_TYPE_AGGREGATIONS: Record<string, AggregationType[]> = {
  number: NUMERIC_AGGREGATIONS,
  currency: NUMERIC_AGGREGATIONS,
  percent: NUMERIC_AGGREGATIONS,
  duration: NUMERIC_AGGREGATIONS,
  rating: NUMERIC_AGGREGATIONS,
  date: DATE_AGGREGATIONS,
  datetime: DATE_AGGREGATIONS,
  checkbox: CHECKBOX_AGGREGATIONS,
  single_select: SELECT_AGGREGATIONS,
  status: SELECT_AGGREGATIONS,
  multi_select: MULTI_SELECT_AGGREGATIONS,
  people: PEOPLE_AGGREGATIONS,
  linked_record: LINKED_RECORD_AGGREGATIONS,
  attachment: ATTACHMENT_AGGREGATIONS,
  text: TEXT_AGGREGATIONS,
  textarea: TEXT_AGGREGATIONS,
  url: TEXT_AGGREGATIONS,
  email: TEXT_AGGREGATIONS,
  phone: TEXT_AGGREGATIONS,
};

/**
 * Returns the available aggregation types for a field type.
 */
export function getAggregationOptions(fieldType: string): AggregationType[] {
  return FIELD_TYPE_AGGREGATIONS[fieldType] ?? DEFAULT_AGGREGATIONS;
}

/**
 * Returns the default aggregation type for a field type.
 */
export function getDefaultAggregation(fieldType: string): AggregationType {
  // Rating fields default to average (more meaningful than sum)
  if (fieldType === 'rating') return AGGREGATION_TYPES.AVG;
  const options = getAggregationOptions(fieldType);
  return options[0] ?? AGGREGATION_TYPES.COUNT;
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * Compute an aggregation over a set of records for a given field.
 */
export function computeAggregation(
  records: GridRecord[],
  fieldId: string,
  aggregation: AggregationType,
): AggregationResult {
  const values: unknown[] = [];
  for (const record of records) {
    const data = record.canonicalData as Record<string, unknown> | null;
    values.push(data?.[fieldId] ?? null);
  }

  const numericValues = values
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

  switch (aggregation) {
    case AGGREGATION_TYPES.COUNT:
      return { value: String(records.length), raw: records.length };

    case AGGREGATION_TYPES.SUM: {
      const sum = numericValues.reduce((acc, v) => acc + v, 0);
      return { value: formatNumber(sum), raw: sum };
    }

    case AGGREGATION_TYPES.AVG: {
      if (numericValues.length === 0) return { value: '-', raw: null };
      const avg = numericValues.reduce((acc, v) => acc + v, 0) / numericValues.length;
      return { value: formatNumber(avg), raw: avg };
    }

    case AGGREGATION_TYPES.MIN: {
      if (numericValues.length === 0) return { value: '-', raw: null };
      const min = Math.min(...numericValues);
      return { value: formatNumber(min), raw: min };
    }

    case AGGREGATION_TYPES.MAX: {
      if (numericValues.length === 0) return { value: '-', raw: null };
      const max = Math.max(...numericValues);
      return { value: formatNumber(max), raw: max };
    }

    case AGGREGATION_TYPES.EARLIEST: {
      const dates = values
        .filter((v): v is string => typeof v === 'string' && !isNaN(Date.parse(v)))
        .map((v) => new Date(v).getTime());
      if (dates.length === 0) return { value: '-', raw: null };
      const earliest = Math.min(...dates);
      return { value: formatDate(earliest), raw: earliest };
    }

    case AGGREGATION_TYPES.LATEST: {
      const dates = values
        .filter((v): v is string => typeof v === 'string' && !isNaN(Date.parse(v)))
        .map((v) => new Date(v).getTime());
      if (dates.length === 0) return { value: '-', raw: null };
      const latest = Math.max(...dates);
      return { value: formatDate(latest), raw: latest };
    }

    case AGGREGATION_TYPES.RANGE: {
      const dates = values
        .filter((v): v is string => typeof v === 'string' && !isNaN(Date.parse(v)))
        .map((v) => new Date(v).getTime());
      if (dates.length < 2) return { value: '-', raw: null };
      const min = Math.min(...dates);
      const max = Math.max(...dates);
      const days = Math.round((max - min) / (1000 * 60 * 60 * 24));
      return { value: `${days}d`, raw: days };
    }

    case AGGREGATION_TYPES.CHECKED_COUNT: {
      const checked = values.filter((v) => v === true).length;
      return { value: String(checked), raw: checked };
    }

    case AGGREGATION_TYPES.UNCHECKED_COUNT: {
      const unchecked = values.filter((v) => v !== true).length;
      return { value: String(unchecked), raw: unchecked };
    }

    case AGGREGATION_TYPES.PERCENT_CHECKED: {
      if (records.length === 0) return { value: '-', raw: null };
      const checked = values.filter((v) => v === true).length;
      const pct = Math.round((checked / records.length) * 100);
      return { value: `${pct}%`, raw: pct };
    }

    case AGGREGATION_TYPES.COUNT_PER_VALUE: {
      const dist: Record<string, number> = {};
      for (const v of values) {
        if (v == null || v === '') continue;
        const key = String(v);
        dist[key] = (dist[key] ?? 0) + 1;
      }
      const entries = Object.entries(dist);
      if (entries.length === 0) return { value: '-', raw: null, distribution: dist };
      const summary = entries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, c]) => `${k}: ${c}`)
        .join(', ');
      return { value: summary, raw: entries.length, distribution: dist };
    }

    case AGGREGATION_TYPES.UNIQUE_COUNT: {
      const unique = new Set<string>();
      for (const v of values) {
        if (v == null) continue;
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item != null) unique.add(String(item));
          }
        } else {
          unique.add(String(v));
        }
      }
      return { value: String(unique.size), raw: unique.size };
    }

    case AGGREGATION_TYPES.TOTAL_COUNT: {
      let total = 0;
      for (const v of values) {
        if (Array.isArray(v)) {
          total += v.length;
        } else if (v != null && v !== '') {
          total += 1;
        }
      }
      return { value: String(total), raw: total };
    }

    case AGGREGATION_TYPES.LINKED_ROW_COUNT: {
      const rowsWithLinks = values.filter((v) => {
        if (Array.isArray(v)) return v.length > 0;
        return v != null && v !== '';
      }).length;
      return { value: String(rowsWithLinks), raw: rowsWithLinks };
    }

    case AGGREGATION_TYPES.TOTAL_LINK_COUNT: {
      let total = 0;
      for (const v of values) {
        if (Array.isArray(v)) {
          total += v.length;
        } else if (v != null && v !== '') {
          total += 1;
        }
      }
      return { value: String(total), raw: total };
    }

    case AGGREGATION_TYPES.ROWS_WITH_FILES: {
      const rowsWithFiles = values.filter((v) => {
        if (Array.isArray(v)) return v.length > 0;
        return v != null && v !== '';
      }).length;
      return { value: String(rowsWithFiles), raw: rowsWithFiles };
    }

    case AGGREGATION_TYPES.TOTAL_FILE_COUNT: {
      let total = 0;
      for (const v of values) {
        if (Array.isArray(v)) {
          total += v.length;
        } else if (v != null && v !== '') {
          total += 1;
        }
      }
      return { value: String(total), raw: total };
    }

    case AGGREGATION_TYPES.FILLED_COUNT: {
      const filled = values.filter((v) => v != null && v !== '').length;
      return { value: String(filled), raw: filled };
    }

    case AGGREGATION_TYPES.EMPTY_COUNT: {
      const empty = values.filter((v) => v == null || v === '').length;
      return { value: String(empty), raw: empty };
    }

    case AGGREGATION_TYPES.NONE:
    default:
      return { value: '', raw: null };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
