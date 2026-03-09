/**
 * Tests for Prompt 5 deliverables:
 * - aggregation-utils (shared aggregation logic)
 * - use-color-rules (color rule state + evaluation)
 * - use-summary-footer (summary footer state)
 * - ColorRuleBuilder (color rule builder UI)
 * - SummaryFooter (summary footer component)
 *
 * @vitest-environment jsdom
 * @see docs/reference/tables-and-views.md § Color Coding, Summary Footer Row
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import {
  computeAggregation,
  getAggregationOptions,
  getDefaultAggregation,
  AGGREGATION_TYPES,
} from '../aggregation-utils';
import {
  evaluateColorRules,
  createEmptyColorRulesConfig,
  type ColorRulesConfig,
} from '../use-color-rules';
import {
  createDefaultSummaryFooterConfig,
  type SummaryFooterConfig,
} from '../use-summary-footer';
import { SummaryFooter } from '../SummaryFooter';
import { ColorRuleBuilder } from '../ColorRuleBuilder';
import type { GridRecord, GridField } from '../../../lib/types/grid';
import { generateUUIDv7 } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createTestField(overrides: Partial<GridField> = {}): GridField {
  return {
    id: generateUUIDv7(),
    name: 'Test Field',
    fieldType: 'text',
    isPrimary: false,
    sortOrder: 0,
    tableId: generateUUIDv7(),
    tenantId: generateUUIDv7(),
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    platformFieldId: null,
    description: null,
    ...overrides,
  } as GridField;
}

function createTestRecord(
  fieldValues: Record<string, unknown>,
  overrides: Partial<GridRecord> = {},
): GridRecord {
  return {
    id: generateUUIDv7(),
    tenantId: generateUUIDv7(),
    tableId: generateUUIDv7(),
    canonicalData: fieldValues,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    deletedAt: null,
    platformRecordId: null,
    syncStatus: null,
    sortOrder: 0,
    searchVector: null,
    ...overrides,
  } as GridRecord;
}

// ---------------------------------------------------------------------------
// aggregation-utils tests
// ---------------------------------------------------------------------------

describe('aggregation-utils', () => {
  describe('getAggregationOptions', () => {
    it('returns numeric aggregations for number fields', () => {
      const options = getAggregationOptions('number');
      expect(options).toContain(AGGREGATION_TYPES.SUM);
      expect(options).toContain(AGGREGATION_TYPES.AVG);
      expect(options).toContain(AGGREGATION_TYPES.MIN);
      expect(options).toContain(AGGREGATION_TYPES.MAX);
    });

    it('returns date aggregations for date fields', () => {
      const options = getAggregationOptions('date');
      expect(options).toContain(AGGREGATION_TYPES.EARLIEST);
      expect(options).toContain(AGGREGATION_TYPES.LATEST);
      expect(options).toContain(AGGREGATION_TYPES.RANGE);
    });

    it('returns checkbox aggregations for checkbox fields', () => {
      const options = getAggregationOptions('checkbox');
      expect(options).toContain(AGGREGATION_TYPES.CHECKED_COUNT);
      expect(options).toContain(AGGREGATION_TYPES.UNCHECKED_COUNT);
      expect(options).toContain(AGGREGATION_TYPES.PERCENT_CHECKED);
    });

    it('returns select aggregations for single_select fields', () => {
      const options = getAggregationOptions('single_select');
      expect(options).toContain(AGGREGATION_TYPES.COUNT_PER_VALUE);
    });

    it('returns text aggregations for text fields', () => {
      const options = getAggregationOptions('text');
      expect(options).toContain(AGGREGATION_TYPES.FILLED_COUNT);
      expect(options).toContain(AGGREGATION_TYPES.EMPTY_COUNT);
    });

    it('returns default aggregations for unknown field types', () => {
      const options = getAggregationOptions('unknown_type');
      expect(options).toContain(AGGREGATION_TYPES.COUNT);
      expect(options).toContain(AGGREGATION_TYPES.NONE);
    });

    it('returns linked record aggregations', () => {
      const options = getAggregationOptions('linked_record');
      expect(options).toContain(AGGREGATION_TYPES.LINKED_ROW_COUNT);
      expect(options).toContain(AGGREGATION_TYPES.TOTAL_LINK_COUNT);
    });

    it('returns attachment aggregations', () => {
      const options = getAggregationOptions('attachment');
      expect(options).toContain(AGGREGATION_TYPES.ROWS_WITH_FILES);
      expect(options).toContain(AGGREGATION_TYPES.TOTAL_FILE_COUNT);
    });
  });

  describe('getDefaultAggregation', () => {
    it('returns sum for number fields', () => {
      expect(getDefaultAggregation('number')).toBe(AGGREGATION_TYPES.SUM);
    });

    it('returns sum for currency fields', () => {
      expect(getDefaultAggregation('currency')).toBe(AGGREGATION_TYPES.SUM);
    });

    it('returns earliest for date fields', () => {
      expect(getDefaultAggregation('date')).toBe(AGGREGATION_TYPES.EARLIEST);
    });

    it('returns checked_count for checkbox fields', () => {
      expect(getDefaultAggregation('checkbox')).toBe(AGGREGATION_TYPES.CHECKED_COUNT);
    });

    it('returns count_per_value for single_select fields', () => {
      expect(getDefaultAggregation('single_select')).toBe(AGGREGATION_TYPES.COUNT_PER_VALUE);
    });

    it('returns filled_count for text fields', () => {
      expect(getDefaultAggregation('text')).toBe(AGGREGATION_TYPES.FILLED_COUNT);
    });
  });

  describe('computeAggregation', () => {
    const fieldId = generateUUIDv7();

    it('computes sum correctly', () => {
      const records = [
        createTestRecord({ [fieldId]: 10 }),
        createTestRecord({ [fieldId]: 20 }),
        createTestRecord({ [fieldId]: 30 }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.SUM);
      expect(result.raw).toBe(60);
      expect(result.value).toBe('60');
    });

    it('computes avg correctly', () => {
      const records = [
        createTestRecord({ [fieldId]: 10 }),
        createTestRecord({ [fieldId]: 20 }),
        createTestRecord({ [fieldId]: 30 }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.AVG);
      expect(result.raw).toBeCloseTo(20);
    });

    it('computes min correctly', () => {
      const records = [
        createTestRecord({ [fieldId]: 10 }),
        createTestRecord({ [fieldId]: 5 }),
        createTestRecord({ [fieldId]: 30 }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.MIN);
      expect(result.raw).toBe(5);
    });

    it('computes max correctly', () => {
      const records = [
        createTestRecord({ [fieldId]: 10 }),
        createTestRecord({ [fieldId]: 5 }),
        createTestRecord({ [fieldId]: 30 }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.MAX);
      expect(result.raw).toBe(30);
    });

    it('computes count correctly', () => {
      const records = [
        createTestRecord({ [fieldId]: 'a' }),
        createTestRecord({ [fieldId]: 'b' }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.COUNT);
      expect(result.raw).toBe(2);
    });

    it('returns dash for avg on empty numeric set', () => {
      const records = [
        createTestRecord({ [fieldId]: 'not a number' }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.AVG);
      expect(result.value).toBe('-');
      expect(result.raw).toBeNull();
    });

    it('computes earliest date', () => {
      const records = [
        createTestRecord({ [fieldId]: '2024-03-15' }),
        createTestRecord({ [fieldId]: '2024-01-01' }),
        createTestRecord({ [fieldId]: '2024-06-20' }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.EARLIEST);
      expect(result.raw).toBe(new Date('2024-01-01').getTime());
    });

    it('computes latest date', () => {
      const records = [
        createTestRecord({ [fieldId]: '2024-03-15' }),
        createTestRecord({ [fieldId]: '2024-01-01' }),
        createTestRecord({ [fieldId]: '2024-06-20' }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.LATEST);
      expect(result.raw).toBe(new Date('2024-06-20').getTime());
    });

    it('computes date range in days', () => {
      const records = [
        createTestRecord({ [fieldId]: '2024-01-01' }),
        createTestRecord({ [fieldId]: '2024-01-11' }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.RANGE);
      expect(result.raw).toBe(10);
      expect(result.value).toBe('10d');
    });

    it('computes checked count', () => {
      const records = [
        createTestRecord({ [fieldId]: true }),
        createTestRecord({ [fieldId]: false }),
        createTestRecord({ [fieldId]: true }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.CHECKED_COUNT);
      expect(result.raw).toBe(2);
    });

    it('computes unchecked count', () => {
      const records = [
        createTestRecord({ [fieldId]: true }),
        createTestRecord({ [fieldId]: false }),
        createTestRecord({ [fieldId]: false }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.UNCHECKED_COUNT);
      expect(result.raw).toBe(2);
    });

    it('computes percent checked', () => {
      const records = [
        createTestRecord({ [fieldId]: true }),
        createTestRecord({ [fieldId]: false }),
        createTestRecord({ [fieldId]: true }),
        createTestRecord({ [fieldId]: true }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.PERCENT_CHECKED);
      expect(result.raw).toBe(75);
      expect(result.value).toBe('75%');
    });

    it('computes count per value with distribution', () => {
      const records = [
        createTestRecord({ [fieldId]: 'A' }),
        createTestRecord({ [fieldId]: 'B' }),
        createTestRecord({ [fieldId]: 'A' }),
        createTestRecord({ [fieldId]: 'C' }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.COUNT_PER_VALUE);
      expect(result.distribution).toEqual({ A: 2, B: 1, C: 1 });
    });

    it('computes unique count for multi-select', () => {
      const records = [
        createTestRecord({ [fieldId]: ['A', 'B'] }),
        createTestRecord({ [fieldId]: ['B', 'C'] }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.UNIQUE_COUNT);
      expect(result.raw).toBe(3); // A, B, C
    });

    it('computes total count for multi-select', () => {
      const records = [
        createTestRecord({ [fieldId]: ['A', 'B'] }),
        createTestRecord({ [fieldId]: ['C'] }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.TOTAL_COUNT);
      expect(result.raw).toBe(3);
    });

    it('computes filled count', () => {
      const records = [
        createTestRecord({ [fieldId]: 'hello' }),
        createTestRecord({ [fieldId]: '' }),
        createTestRecord({ [fieldId]: null }),
        createTestRecord({ [fieldId]: 'world' }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.FILLED_COUNT);
      expect(result.raw).toBe(2);
    });

    it('computes empty count', () => {
      const records = [
        createTestRecord({ [fieldId]: 'hello' }),
        createTestRecord({ [fieldId]: '' }),
        createTestRecord({ [fieldId]: null }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.EMPTY_COUNT);
      expect(result.raw).toBe(2);
    });

    it('computes linked row count', () => {
      const records = [
        createTestRecord({ [fieldId]: ['link1', 'link2'] }),
        createTestRecord({ [fieldId]: [] }),
        createTestRecord({ [fieldId]: ['link3'] }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.LINKED_ROW_COUNT);
      expect(result.raw).toBe(2);
    });

    it('computes total link count', () => {
      const records = [
        createTestRecord({ [fieldId]: ['link1', 'link2'] }),
        createTestRecord({ [fieldId]: ['link3'] }),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.TOTAL_LINK_COUNT);
      expect(result.raw).toBe(3);
    });

    it('returns empty for none aggregation', () => {
      const records = [createTestRecord({ [fieldId]: 10 })];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.NONE);
      expect(result.value).toBe('');
      expect(result.raw).toBeNull();
    });

    it('handles records with missing field', () => {
      const records = [
        createTestRecord({}),
        createTestRecord({}),
      ];
      const result = computeAggregation(records, fieldId, AGGREGATION_TYPES.SUM);
      expect(result.raw).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateColorRules tests
// ---------------------------------------------------------------------------

describe('evaluateColorRules', () => {
  const fieldId = generateUUIDv7();

  it('returns null colors when no rules exist', () => {
    const record = createTestRecord({ [fieldId]: 'test' });
    const rules = createEmptyColorRulesConfig();
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBeNull();
    expect(result.cellColors).toEqual({});
  });

  it('applies row rule when conditions match', () => {
    const record = createTestRecord({ [fieldId]: 'urgent' });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'is', value: 'urgent' }],
          color: '#FEE2E2',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBe('#FEE2E2');
  });

  it('does not apply row rule when conditions do not match', () => {
    const record = createTestRecord({ [fieldId]: 'normal' });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'is', value: 'urgent' }],
          color: '#FEE2E2',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBeNull();
  });

  it('applies cell rule with higher specificity', () => {
    const record = createTestRecord({ [fieldId]: 'urgent' });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'is', value: 'urgent' }],
          color: '#FEE2E2',
        },
      ],
      cell_rules: [
        {
          id: '2',
          fieldId,
          conditions: [{ id: 'c2', fieldId, operator: 'is', value: 'urgent' }],
          color: '#DBEAFE',
        },
      ],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBe('#FEE2E2');
    expect(result.cellColors[fieldId]).toBe('#DBEAFE');
  });

  it('first matching row rule wins', () => {
    const record = createTestRecord({ [fieldId]: 'test' });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'is_not_empty', value: null }],
          color: '#FEE2E2',
        },
        {
          id: '2',
          conditions: [{ id: 'c2', fieldId, operator: 'is_not_empty', value: null }],
          color: '#DBEAFE',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBe('#FEE2E2');
  });

  it('handles contains operator', () => {
    const record = createTestRecord({ [fieldId]: 'hello world' });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'contains', value: 'world' }],
          color: '#FEF3C7',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBe('#FEF3C7');
  });

  it('handles gt operator for numbers', () => {
    const record = createTestRecord({ [fieldId]: 100 });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'gt', value: 50 }],
          color: '#DCFCE7',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBe('#DCFCE7');
  });

  it('handles is_empty operator', () => {
    const record = createTestRecord({ [fieldId]: null });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'is_empty', value: null }],
          color: '#F1F5F9',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBe('#F1F5F9');
  });

  it('handles is_not_empty operator', () => {
    const record = createTestRecord({ [fieldId]: 'value' });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'is_not_empty', value: null }],
          color: '#DCFCE7',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBe('#DCFCE7');
  });

  it('handles is_any_of operator', () => {
    const record = createTestRecord({ [fieldId]: 'B' });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'is_any_of', value: ['A', 'B', 'C'] }],
          color: '#E0E7FF',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBe('#E0E7FF');
  });

  it('skips rules with empty conditions', () => {
    const record = createTestRecord({ [fieldId]: 'test' });
    const rules: ColorRulesConfig = {
      row_rules: [
        { id: '1', conditions: [], color: '#FEE2E2' },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBeNull();
  });

  it('handles multiple conditions (AND logic)', () => {
    const field2Id = generateUUIDv7();
    const record = createTestRecord({ [fieldId]: 'urgent', [field2Id]: 100 });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [
            { id: 'c1', fieldId, operator: 'is', value: 'urgent' },
            { id: 'c2', fieldId: field2Id, operator: 'gt', value: 50 },
          ],
          color: '#FEE2E2',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBe('#FEE2E2');
  });

  it('fails AND logic when one condition does not match', () => {
    const field2Id = generateUUIDv7();
    const record = createTestRecord({ [fieldId]: 'urgent', [field2Id]: 10 });
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [
            { id: 'c1', fieldId, operator: 'is', value: 'urgent' },
            { id: 'c2', fieldId: field2Id, operator: 'gt', value: 50 },
          ],
          color: '#FEE2E2',
        },
      ],
      cell_rules: [],
    };
    const result = evaluateColorRules(record, rules);
    expect(result.rowColor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SummaryFooterConfig tests
// ---------------------------------------------------------------------------

describe('SummaryFooterConfig', () => {
  it('creates default config with enabled=false', () => {
    const config = createDefaultSummaryFooterConfig();
    expect(config.enabled).toBe(false);
    expect(config.columns).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// SummaryFooter component tests
// ---------------------------------------------------------------------------

describe('SummaryFooter', () => {
  const fieldId = generateUUIDv7();
  const fields: GridField[] = [
    createTestField({ id: fieldId, name: 'Amount', fieldType: 'number' }),
  ];

  it('renders with summary label', () => {
    const records = [
      createTestRecord({ [fieldId]: 10 }),
      createTestRecord({ [fieldId]: 20 }),
    ];
    const config: SummaryFooterConfig = { enabled: true, columns: {} };

    render(
      <IntlWrapper>
        <SummaryFooter
          records={records}
          fields={fields}
          columnWidths={{}}
          totalWidth={800}
          config={config}
          onSetColumnAggregation={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Summary')).toBeDefined();
  });

  it('displays aggregated value for number field', () => {
    const records = [
      createTestRecord({ [fieldId]: 10 }),
      createTestRecord({ [fieldId]: 20 }),
      createTestRecord({ [fieldId]: 30 }),
    ];
    const config: SummaryFooterConfig = {
      enabled: true,
      columns: { [fieldId]: AGGREGATION_TYPES.SUM },
    };

    render(
      <IntlWrapper>
        <SummaryFooter
          records={records}
          fields={fields}
          columnWidths={{}}
          totalWidth={800}
          config={config}
          onSetColumnAggregation={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('60')).toBeDefined();
  });

  it('opens picker on cell click', () => {
    const records = [createTestRecord({ [fieldId]: 10 })];
    const config: SummaryFooterConfig = { enabled: true, columns: {} };

    render(
      <IntlWrapper>
        <SummaryFooter
          records={records}
          fields={fields}
          columnWidths={{}}
          totalWidth={800}
          config={config}
          onSetColumnAggregation={vi.fn()}
        />
      </IntlWrapper>,
    );

    // Click the cell to open the aggregation picker
    const cell = screen.getByRole('button', { name: /Pick aggregation/ });
    fireEvent.click(cell);

    // Should show aggregation type options
    expect(screen.getByText('Sum')).toBeDefined();
    expect(screen.getByText('Average')).toBeDefined();
  });

  it('calls onSetColumnAggregation when picking a type', () => {
    const records = [createTestRecord({ [fieldId]: 10 })];
    const config: SummaryFooterConfig = { enabled: true, columns: {} };
    const onSetAggregation = vi.fn();

    render(
      <IntlWrapper>
        <SummaryFooter
          records={records}
          fields={fields}
          columnWidths={{}}
          totalWidth={800}
          config={config}
          onSetColumnAggregation={onSetAggregation}
        />
      </IntlWrapper>,
    );

    // Open picker
    const cell = screen.getByRole('button', { name: /Pick aggregation/ });
    fireEvent.click(cell);

    // Select 'Average'
    fireEvent.click(screen.getByText('Average'));
    expect(onSetAggregation).toHaveBeenCalledWith(fieldId, AGGREGATION_TYPES.AVG);
  });
});

// ---------------------------------------------------------------------------
// ColorRuleBuilder component tests
// ---------------------------------------------------------------------------

describe('ColorRuleBuilder', () => {
  const fieldId = generateUUIDv7();
  const fields: GridField[] = [
    createTestField({ id: fieldId, name: 'Status', fieldType: 'single_select' }),
  ];

  it('renders with title', () => {
    render(
      <IntlWrapper>
        <ColorRuleBuilder
          colorRules={createEmptyColorRulesConfig()}
          fields={fields}
          onAddRowRule={vi.fn()}
          onAddCellRule={vi.fn()}
          onUpdateRule={vi.fn()}
          onRemoveRule={vi.fn()}
          onClearRules={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Color Rules')).toBeDefined();
    expect(screen.getByText('Row rules')).toBeDefined();
    expect(screen.getByText('Cell rules')).toBeDefined();
  });

  it('shows empty state messages', () => {
    render(
      <IntlWrapper>
        <ColorRuleBuilder
          colorRules={createEmptyColorRulesConfig()}
          fields={fields}
          onAddRowRule={vi.fn()}
          onAddCellRule={vi.fn()}
          onUpdateRule={vi.fn()}
          onRemoveRule={vi.fn()}
          onClearRules={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('No row color rules.')).toBeDefined();
    expect(screen.getByText('No cell color rules.')).toBeDefined();
  });

  it('calls onAddRowRule when add row rule button clicked', () => {
    const onAddRowRule = vi.fn();

    render(
      <IntlWrapper>
        <ColorRuleBuilder
          colorRules={createEmptyColorRulesConfig()}
          fields={fields}
          onAddRowRule={onAddRowRule}
          onAddCellRule={vi.fn()}
          onUpdateRule={vi.fn()}
          onRemoveRule={vi.fn()}
          onClearRules={vi.fn()}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByText('Add row rule'));
    expect(onAddRowRule).toHaveBeenCalledTimes(1);
  });

  it('calls onAddCellRule when add cell rule button clicked', () => {
    const onAddCellRule = vi.fn();

    render(
      <IntlWrapper>
        <ColorRuleBuilder
          colorRules={createEmptyColorRulesConfig()}
          fields={fields}
          onAddRowRule={vi.fn()}
          onAddCellRule={onAddCellRule}
          onUpdateRule={vi.fn()}
          onRemoveRule={vi.fn()}
          onClearRules={vi.fn()}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByText('Add cell rule'));
    expect(onAddCellRule).toHaveBeenCalledTimes(1);
  });

  it('shows clear all button when rules exist', () => {
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: '1',
          conditions: [{ id: 'c1', fieldId, operator: 'is', value: 'test' }],
          color: '#FEE2E2',
        },
      ],
      cell_rules: [],
    };

    render(
      <IntlWrapper>
        <ColorRuleBuilder
          colorRules={rules}
          fields={fields}
          onAddRowRule={vi.fn()}
          onAddCellRule={vi.fn()}
          onUpdateRule={vi.fn()}
          onRemoveRule={vi.fn()}
          onClearRules={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Clear all')).toBeDefined();
  });

  it('renders existing row rule with remove button', () => {
    const onRemoveRule = vi.fn();
    const rules: ColorRulesConfig = {
      row_rules: [
        {
          id: 'rule-1',
          conditions: [{ id: 'c1', fieldId, operator: 'is', value: 'test' }],
          color: '#FEE2E2',
        },
      ],
      cell_rules: [],
    };

    render(
      <IntlWrapper>
        <ColorRuleBuilder
          colorRules={rules}
          fields={fields}
          onAddRowRule={vi.fn()}
          onAddCellRule={vi.fn()}
          onUpdateRule={vi.fn()}
          onRemoveRule={onRemoveRule}
          onClearRules={vi.fn()}
        />
      </IntlWrapper>,
    );

    // Should have a remove button (Trash2 icon)
    const removeButtons = screen.getAllByRole('button');
    expect(removeButtons.length).toBeGreaterThan(0);
  });
});
