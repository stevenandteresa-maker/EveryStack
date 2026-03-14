import { describe, it, expect } from 'vitest';

import { estimateTokens, condenseDescriptor } from '../token-estimator';
import type {
  WorkspaceDescriptor,
  FieldDescriptor,
  TableDescriptor,
  BaseDescriptor,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers — build descriptors of controlled size
// ---------------------------------------------------------------------------

function makeField(overrides: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    field_id: `fld_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Field',
    type: 'text',
    searchable: false,
    aggregatable: false,
    ...overrides,
  };
}

function makeTable(
  fieldCount: number,
  overrides: Partial<TableDescriptor> = {},
): TableDescriptor {
  const fields: FieldDescriptor[] = [];
  for (let i = 0; i < fieldCount; i++) {
    fields.push(
      makeField({
        field_id: `fld_${i}`,
        name: `Field ${i}`,
        type: i % 5 === 0 ? 'single_select' : 'text',
        searchable: i < 3,
        aggregatable: i % 7 === 0,
        options: i % 5 === 0 ? ['Option A', 'Option B', 'Option C'] : undefined,
      }),
    );
  }
  return {
    table_id: `tbl_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Table',
    record_count_approx: 1000,
    fields,
    ...overrides,
  };
}

function makeBase(tables: TableDescriptor[]): BaseDescriptor {
  return {
    base_id: `base_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Base',
    platform: 'airtable',
    tables,
  };
}

function makeWorkspace(
  bases: BaseDescriptor[],
  overrides: Partial<WorkspaceDescriptor> = {},
): WorkspaceDescriptor {
  return {
    workspace_id: 'ws_test',
    bases,
    link_graph: [],
    ...overrides,
  };
}

/** Build a small descriptor that fits well under any threshold. */
function makeSmallDescriptor(): WorkspaceDescriptor {
  return makeWorkspace([makeBase([makeTable(3)])]);
}

/** Build a descriptor large enough that Level 1 condensation is needed. */
function makeMediumDescriptor(): WorkspaceDescriptor {
  // Many select fields with long options to push size over 2k tokens
  const fields: FieldDescriptor[] = [];
  for (let i = 0; i < 15; i++) {
    fields.push(
      makeField({
        field_id: `fld_${i}`,
        name: `Select Field ${i}`,
        type: 'single_select',
        searchable: true,
        options: Array.from({ length: 20 }, (_, j) => `Option ${i}-${j} with extra text to pad`),
      }),
    );
  }
  const table: TableDescriptor = {
    table_id: 'tbl_medium',
    name: 'Medium Table',
    record_count_approx: 5000,
    fields,
  };
  return makeWorkspace([makeBase([table])]);
}

/** Build a descriptor with >20 fields per table for Level 2 testing. */
function makeLargeDescriptor(): WorkspaceDescriptor {
  const fields: FieldDescriptor[] = [];
  for (let i = 0; i < 30; i++) {
    fields.push(
      makeField({
        field_id: `fld_${i}`,
        name: `Field ${i} with a reasonable name`,
        type: i === 25 ? 'linked_record' : i % 5 === 0 ? 'single_select' : 'text',
        searchable: i < 2,
        aggregatable: i === 10,
        options: i % 5 === 0 ? Array.from({ length: 15 }, (_, j) => `Opt ${j}`) : undefined,
        linked_base: i === 25 ? 'base_other' : undefined,
        linked_table: i === 25 ? 'tbl_other' : undefined,
        cardinality: i === 25 ? 'many_to_one' : undefined,
      }),
    );
  }
  // Duplicate tables to push size higher
  const tables = Array.from({ length: 4 }, (_, idx) => ({
    table_id: `tbl_${idx}`,
    name: `Large Table ${idx}`,
    record_count_approx: 10000,
    fields: fields.map((f) => ({ ...f, field_id: `${f.field_id}_t${idx}` })),
  }));
  return makeWorkspace(
    [makeBase(tables)],
    {
      link_graph: [
        {
          from: 'base_test.tbl_0.fld_25_t0',
          to: 'base_other.tbl_other.fld_sym',
          cardinality: 'many_to_one',
          label: 'Large Table 0 → Other',
        },
      ],
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  it('returns reasonable estimate based on JSON length / 4', () => {
    const descriptor = makeSmallDescriptor();
    const jsonLength = JSON.stringify(descriptor).length;
    const tokens = estimateTokens(descriptor);
    expect(tokens).toBe(Math.ceil(jsonLength / 4));
    expect(tokens).toBeGreaterThan(0);
  });

  it('returns higher count for larger descriptors', () => {
    const small = estimateTokens(makeSmallDescriptor());
    const medium = estimateTokens(makeMediumDescriptor());
    expect(medium).toBeGreaterThan(small);
  });
});

describe('condenseDescriptor', () => {
  it('returns unchanged copy when under budget', () => {
    const input = makeSmallDescriptor();
    const maxTokens = estimateTokens(input) + 1000;
    const result = condenseDescriptor(input, maxTokens);

    // Content should match
    expect(result).toEqual(input);
    // But should be a different object (deep copy)
    expect(result).not.toBe(input);
  });

  it('never mutates the input descriptor', () => {
    const input = makeLargeDescriptor();
    const inputSnapshot = JSON.stringify(input);
    condenseDescriptor(input, 100); // Force all levels
    expect(JSON.stringify(input)).toBe(inputSnapshot);
  });

  describe('Level 1 — remove options arrays', () => {
    it('removes options from select fields', () => {
      const input = makeMediumDescriptor();
      // Set maxTokens just below current size so Level 1 kicks in
      const currentTokens = estimateTokens(input);
      // Level 1 should remove options and shrink enough
      const afterLevel1Tokens = currentTokens - 1;
      const result = condenseDescriptor(input, afterLevel1Tokens);

      // Verify no fields have options
      for (const base of result.bases) {
        for (const table of base.tables) {
          for (const field of table.fields) {
            expect(field.options).toBeUndefined();
          }
        }
      }
    });

    it('preserves all fields when only Level 1 applied', () => {
      const input = makeMediumDescriptor();
      const inputFieldCount = input.bases[0]!.tables[0]!.fields.length;

      // Token budget that Level 1 can satisfy (remove options brings it under)
      // Estimate tokens after manually removing options to find the right budget
      const withoutOptions = JSON.parse(JSON.stringify(input)) as WorkspaceDescriptor;
      for (const base of withoutOptions.bases) {
        for (const table of base.tables) {
          for (const field of table.fields) {
            delete field.options;
          }
        }
      }
      const level1Tokens = estimateTokens(withoutOptions);
      const result = condenseDescriptor(input, level1Tokens + 100);

      expect(result.bases[0]!.tables[0]!.fields.length).toBe(inputFieldCount);
    });
  });

  describe('Level 2 — collapse large tables', () => {
    it('keeps only searchable, aggregatable, and linked_record fields for tables >20 fields', () => {
      const input = makeLargeDescriptor();
      // Use a budget that requires Level 2 but not Level 3
      // First find what Level 1 gives us
      const afterLevel1 = JSON.parse(JSON.stringify(input)) as WorkspaceDescriptor;
      for (const base of afterLevel1.bases) {
        for (const table of base.tables) {
          for (const field of table.fields) {
            delete field.options;
          }
        }
      }
      const level1Tokens = estimateTokens(afterLevel1);

      // Budget below Level 1 result but above what Level 2 should produce
      const result = condenseDescriptor(input, level1Tokens - 1);

      for (const base of result.bases) {
        for (const table of base.tables) {
          // Each table had 30 fields, so Level 2 should apply
          for (const field of table.fields) {
            const isKept =
              field.searchable || field.aggregatable || field.type === 'linked_record';
            expect(isKept).toBe(true);
          }
        }
      }
    });

    it('adds hidden_field_count on collapsed tables', () => {
      const input = makeLargeDescriptor();
      // Simulate Level 1 to find its token count
      const afterLevel1 = JSON.parse(JSON.stringify(input)) as WorkspaceDescriptor;
      for (const base of afterLevel1.bases) {
        for (const table of base.tables) {
          for (const field of table.fields) {
            delete field.options;
          }
        }
      }
      const level1Tokens = estimateTokens(afterLevel1);

      // Simulate Level 2 on top of Level 1 to find its token count
      const afterLevel2 = JSON.parse(JSON.stringify(afterLevel1)) as WorkspaceDescriptor;
      for (const base of afterLevel2.bases) {
        for (const table of base.tables) {
          if (table.fields.length > 20) {
            table.fields = table.fields.filter(
              (f) => f.searchable || f.aggregatable || f.type === 'linked_record',
            );
          }
        }
      }
      const level2Tokens = estimateTokens(afterLevel2);

      // Budget between level2 and level1 results — forces Level 2 to apply
      const budget = Math.floor((level1Tokens + level2Tokens) / 2);
      // Sanity check: budget needs Level 2
      expect(budget).toBeLessThan(level1Tokens);
      expect(budget).toBeGreaterThanOrEqual(level2Tokens);

      const result = condenseDescriptor(input, budget);

      let foundHiddenCount = false;
      for (const base of result.bases) {
        for (const table of base.tables) {
          if (table.condensed && table.fields.length > 0) {
            foundHiddenCount = true;
            for (const field of table.fields) {
              expect(field.hidden_field_count).toBeDefined();
              expect(field.hidden_field_count).toBeGreaterThan(0);
            }
          }
        }
      }
      // Ensure we actually checked at least one collapsed table
      expect(foundHiddenCount).toBe(true);
    });

    it('does not collapse tables with ≤20 fields', () => {
      // Make a descriptor with one small table (5 fields) and one large (25 fields)
      const smallTable = makeTable(5, { table_id: 'tbl_small', name: 'Small' });
      const largeTable = makeTable(25, { table_id: 'tbl_large', name: 'Large' });
      const ws = makeWorkspace([makeBase([smallTable, largeTable])]);

      // Level 3 will clear all fields, so test with a budget that stops at Level 2
      // Build a version where Level 2 is enough
      const level1Copy = JSON.parse(JSON.stringify(ws)) as WorkspaceDescriptor;
      for (const b of level1Copy.bases) {
        for (const t of b.tables) {
          for (const f of t.fields) {
            delete f.options;
          }
        }
      }
      // Apply Level 2 manually to small + large
      const level2Copy = JSON.parse(JSON.stringify(level1Copy)) as WorkspaceDescriptor;
      for (const b of level2Copy.bases) {
        for (const t of b.tables) {
          if (t.fields.length > 20) {
            t.fields = t.fields.filter(
              (f) => f.searchable || f.aggregatable || f.type === 'linked_record',
            );
          }
        }
      }
      const level2Budget = estimateTokens(level2Copy) + 100;

      const result2 = condenseDescriptor(ws, level2Budget);
      // Small table should keep all 5 fields
      const smallResult = result2.bases[0]!.tables.find((t) => t.name === 'Small');
      expect(smallResult?.fields.length).toBe(5);
    });
  });

  describe('Level 3 — table names + counts + link graph only', () => {
    it('removes all field details', () => {
      const input = makeLargeDescriptor();
      const result = condenseDescriptor(input, 100);

      for (const base of result.bases) {
        for (const table of base.tables) {
          expect(table.fields).toEqual([]);
        }
      }
    });

    it('sets condensed: true on workspace and tables', () => {
      const input = makeLargeDescriptor();
      const result = condenseDescriptor(input, 100);

      expect(result.condensed).toBe(true);
      for (const base of result.bases) {
        for (const table of base.tables) {
          expect(table.condensed).toBe(true);
        }
      }
    });

    it('preserves table names and record counts', () => {
      const input = makeLargeDescriptor();
      const result = condenseDescriptor(input, 100);

      for (const base of result.bases) {
        for (const table of base.tables) {
          expect(table.name).toBeTruthy();
          expect(table.table_id).toBeTruthy();
          expect(table.record_count_approx).toBeGreaterThan(0);
        }
      }
    });

    it('preserves link_graph', () => {
      const input = makeLargeDescriptor();
      expect(input.link_graph.length).toBeGreaterThan(0);

      const result = condenseDescriptor(input, 100);
      expect(result.link_graph).toEqual(input.link_graph);
    });
  });

  describe('incremental application', () => {
    it('applies levels progressively — Level 2 includes Level 1 changes', () => {
      const input = makeLargeDescriptor();

      // Force Level 2 but not Level 3
      const level1Copy = JSON.parse(JSON.stringify(input)) as WorkspaceDescriptor;
      for (const b of level1Copy.bases) {
        for (const t of b.tables) {
          for (const f of t.fields) {
            delete f.options;
          }
        }
      }
      const level1Tokens = estimateTokens(level1Copy);
      const result = condenseDescriptor(input, level1Tokens - 1);

      // Level 1 should have been applied (no options on remaining fields)
      for (const base of result.bases) {
        for (const table of base.tables) {
          for (const field of table.fields) {
            expect(field.options).toBeUndefined();
          }
        }
      }
    });

    it('stops at first level that brings tokens under budget', () => {
      const input = makeMediumDescriptor();
      const inputTokens = estimateTokens(input);

      // Remove options manually to find Level 1 result size
      const level1Copy = JSON.parse(JSON.stringify(input)) as WorkspaceDescriptor;
      for (const b of level1Copy.bases) {
        for (const t of b.tables) {
          for (const f of t.fields) {
            delete f.options;
          }
        }
      }
      const level1Tokens = estimateTokens(level1Copy);

      // Budget between Level 1 result and original — Level 1 should suffice
      const budget = level1Tokens + 50;
      expect(budget).toBeLessThan(inputTokens); // Confirm we need condensation

      const result = condenseDescriptor(input, budget);

      // All fields should still be present (Level 2 not applied)
      const fieldCount = result.bases[0]!.tables[0]!.fields.length;
      expect(fieldCount).toBe(input.bases[0]!.tables[0]!.fields.length);

      // But options should be removed
      for (const field of result.bases[0]!.tables[0]!.fields) {
        expect(field.options).toBeUndefined();
      }
    });
  });
});
