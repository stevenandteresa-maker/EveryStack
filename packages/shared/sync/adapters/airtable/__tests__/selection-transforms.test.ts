import { describe, it, expect } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue, SelectOption } from '../../../types';
import {
  airtableSingleSelectTransform,
  airtableMultipleSelectTransform,
  airtableStatusTransform,
  airtableTagTransform,
} from '../selection-transforms';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldSelect001',
  name: 'Status',
  platformFieldType: 'singleSelect',
};

function configWithOptions(options: SelectOption[]): PlatformFieldConfig {
  return { ...baseConfig, options: { options } };
}

// ---------------------------------------------------------------------------
// singleSelect → single_select
// ---------------------------------------------------------------------------

describe('airtableSingleSelectTransform', () => {
  const optionInProgress: SelectOption = {
    id: 'es_opt_abc123',
    label: 'In Progress',
    color: 'blue',
    source_refs: { airtable: 'In Progress' },
  };

  const optionDone: SelectOption = {
    id: 'es_opt_def456',
    label: 'Done',
    color: 'green',
  };

  const config = configWithOptions([optionInProgress, optionDone]);

  describe('toCanonical', () => {
    it('maps Airtable label to ES option ID and preserves label in source_refs', () => {
      const result = airtableSingleSelectTransform.toCanonical('In Progress', config);
      expect(result).toEqual({
        type: 'single_select',
        value: {
          id: 'es_opt_abc123',
          label: 'In Progress',
          source_refs: { airtable: 'In Progress' },
        },
      });
    });

    it('maps a different known label correctly', () => {
      const result = airtableSingleSelectTransform.toCanonical('Done', config);
      expect(result).toEqual({
        type: 'single_select',
        value: {
          id: 'es_opt_def456',
          label: 'Done',
          source_refs: { airtable: 'Done' },
        },
      });
    });

    it('returns null value for null input', () => {
      const result = airtableSingleSelectTransform.toCanonical(null, config);
      expect(result).toEqual({ type: 'single_select', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableSingleSelectTransform.toCanonical(undefined, config);
      expect(result).toEqual({ type: 'single_select', value: null });
    });

    it('generates placeholder ID for unrecognized value (new option on Airtable)', () => {
      const result = airtableSingleSelectTransform.toCanonical('Brand New Option', config);
      expect(result.type).toBe('single_select');
      const val = (result as { type: 'single_select'; value: { id: string; label: string; source_refs: { airtable: string } } }).value;
      expect(val.id).toMatch(/^es_opt_unsynced_/);
      expect(val.label).toBe('Brand New Option');
      expect(val.source_refs.airtable).toBe('Brand New Option');
    });

    it('generates consistent placeholder IDs for the same label', () => {
      const result1 = airtableSingleSelectTransform.toCanonical('New Value', baseConfig);
      const result2 = airtableSingleSelectTransform.toCanonical('New Value', baseConfig);
      const val1 = (result1 as { type: 'single_select'; value: { id: string } }).value;
      const val2 = (result2 as { type: 'single_select'; value: { id: string } }).value;
      expect(val1.id).toBe(val2.id);
    });

    it('works with empty options config', () => {
      const result = airtableSingleSelectTransform.toCanonical('Something', baseConfig);
      expect(result.type).toBe('single_select');
      const val = (result as { type: 'single_select'; value: { id: string; label: string } }).value;
      expect(val.id).toMatch(/^es_opt_unsynced_/);
      expect(val.label).toBe('Something');
    });
  });

  describe('fromCanonical', () => {
    it('recovers the original Airtable label from source_refs', () => {
      const canonical: CanonicalValue = {
        type: 'single_select',
        value: {
          id: 'es_opt_abc123',
          label: 'In Progress',
          source_refs: { airtable: 'In Progress' },
        },
      };
      const result = airtableSingleSelectTransform.fromCanonical(canonical, config);
      expect(result).toBe('In Progress');
    });

    it('falls back to label when source_refs.airtable is missing', () => {
      const canonical: CanonicalValue = {
        type: 'single_select',
        value: {
          id: 'es_opt_abc123',
          label: 'Fallback Label',
        },
      };
      const result = airtableSingleSelectTransform.fromCanonical(canonical, config);
      expect(result).toBe('Fallback Label');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'single_select', value: null };
      const result = airtableSingleSelectTransform.fromCanonical(canonical, config);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableSingleSelectTransform.fromCanonical(canonical, config);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableSingleSelectTransform.isLossless).toBe(true);
  });

  it('supports all standard operations', () => {
    expect(airtableSingleSelectTransform.supportedOperations).toEqual([
      'read', 'write', 'filter', 'sort',
    ]);
  });
});

// ---------------------------------------------------------------------------
// multipleSelects → multiple_select
// ---------------------------------------------------------------------------

describe('airtableMultipleSelectTransform', () => {
  const options: SelectOption[] = [
    { id: 'es_opt_a', label: 'Alpha' },
    { id: 'es_opt_b', label: 'Beta' },
    { id: 'es_opt_c', label: 'Gamma' },
  ];
  const config = configWithOptions(options);

  describe('toCanonical', () => {
    it('maps multiple Airtable labels to ES option IDs with source_refs', () => {
      const result = airtableMultipleSelectTransform.toCanonical(['Alpha', 'Gamma'], config);
      expect(result).toEqual({
        type: 'multiple_select',
        value: [
          { id: 'es_opt_a', label: 'Alpha', source_refs: { airtable: 'Alpha' } },
          { id: 'es_opt_c', label: 'Gamma', source_refs: { airtable: 'Gamma' } },
        ],
      });
    });

    it('returns empty array for null input', () => {
      const result = airtableMultipleSelectTransform.toCanonical(null, config);
      expect(result).toEqual({ type: 'multiple_select', value: [] });
    });

    it('returns empty array for undefined input', () => {
      const result = airtableMultipleSelectTransform.toCanonical(undefined, config);
      expect(result).toEqual({ type: 'multiple_select', value: [] });
    });

    it('returns empty array for non-array input', () => {
      const result = airtableMultipleSelectTransform.toCanonical('not an array', config);
      expect(result).toEqual({ type: 'multiple_select', value: [] });
    });

    it('handles empty array', () => {
      const result = airtableMultipleSelectTransform.toCanonical([], config);
      expect(result).toEqual({ type: 'multiple_select', value: [] });
    });

    it('generates placeholder IDs for unrecognized values in array', () => {
      const result = airtableMultipleSelectTransform.toCanonical(['Alpha', 'Unknown'], config);
      const val = (result as { type: 'multiple_select'; value: Array<{ id: string; label: string }> }).value;
      expect(val[0]!.id).toBe('es_opt_a');
      expect(val[1]!.id).toMatch(/^es_opt_unsynced_/);
      expect(val[1]!.label).toBe('Unknown');
    });
  });

  describe('fromCanonical', () => {
    it('recovers original Airtable labels from source_refs', () => {
      const canonical: CanonicalValue = {
        type: 'multiple_select',
        value: [
          { id: 'es_opt_a', label: 'Alpha', source_refs: { airtable: 'Alpha' } },
          { id: 'es_opt_c', label: 'Gamma', source_refs: { airtable: 'Gamma' } },
        ],
      };
      const result = airtableMultipleSelectTransform.fromCanonical(canonical, config);
      expect(result).toEqual(['Alpha', 'Gamma']);
    });

    it('falls back to label when source_refs is missing', () => {
      const canonical: CanonicalValue = {
        type: 'multiple_select',
        value: [
          { id: 'es_opt_a', label: 'Alpha' },
        ],
      };
      const result = airtableMultipleSelectTransform.fromCanonical(canonical, config);
      expect(result).toEqual(['Alpha']);
    });

    it('returns empty array for empty multiple_select value', () => {
      const canonical: CanonicalValue = { type: 'multiple_select', value: [] };
      const result = airtableMultipleSelectTransform.fromCanonical(canonical, config);
      expect(result).toEqual([]);
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableMultipleSelectTransform.fromCanonical(canonical, config);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableMultipleSelectTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// singleSelect (status) → status
// ---------------------------------------------------------------------------

describe('airtableStatusTransform', () => {
  const statusOptions: SelectOption[] = [
    { id: 'es_opt_ns', label: 'Not Started' },
    { id: 'es_opt_ip', label: 'In Progress' },
    { id: 'es_opt_done', label: 'Done' },
  ];

  const statusConfig: PlatformFieldConfig = {
    ...baseConfig,
    options: {
      options: statusOptions,
      categories: {
        es_opt_ns: 'not_started',
        es_opt_ip: 'in_progress',
        es_opt_done: 'done',
      },
    },
  };

  describe('toCanonical', () => {
    it('maps to status with category from config', () => {
      const result = airtableStatusTransform.toCanonical('In Progress', statusConfig);
      expect(result).toEqual({
        type: 'status',
        value: {
          id: 'es_opt_ip',
          label: 'In Progress',
          category: 'in_progress',
          source_refs: { airtable: 'In Progress' },
        },
      });
    });

    it('maps done status category', () => {
      const result = airtableStatusTransform.toCanonical('Done', statusConfig);
      expect(result).toEqual({
        type: 'status',
        value: {
          id: 'es_opt_done',
          label: 'Done',
          category: 'done',
          source_refs: { airtable: 'Done' },
        },
      });
    });

    it('uses done_values fallback when categories map is absent', () => {
      const doneConfig: PlatformFieldConfig = {
        ...baseConfig,
        options: {
          options: statusOptions,
          done_values: ['es_opt_done'],
        },
      };
      const result = airtableStatusTransform.toCanonical('Done', doneConfig);
      const val = (result as { type: 'status'; value: { category: string } }).value;
      expect(val.category).toBe('done');
    });

    it('defaults to not_started when no category mapping exists', () => {
      const noCategories = configWithOptions(statusOptions);
      const result = airtableStatusTransform.toCanonical('In Progress', noCategories);
      const val = (result as { type: 'status'; value: { category: string } }).value;
      expect(val.category).toBe('not_started');
    });

    it('returns null value for null input', () => {
      const result = airtableStatusTransform.toCanonical(null, statusConfig);
      expect(result).toEqual({ type: 'status', value: null });
    });

    it('handles unrecognized status values gracefully', () => {
      const result = airtableStatusTransform.toCanonical('Archived', statusConfig);
      expect(result.type).toBe('status');
      const val = (result as { type: 'status'; value: { id: string; label: string; category: string } }).value;
      expect(val.id).toMatch(/^es_opt_unsynced_/);
      expect(val.label).toBe('Archived');
      expect(val.category).toBe('not_started');
    });
  });

  describe('fromCanonical', () => {
    it('recovers the original Airtable label from source_refs', () => {
      const canonical: CanonicalValue = {
        type: 'status',
        value: {
          id: 'es_opt_ip',
          label: 'In Progress',
          category: 'in_progress' as const,
          source_refs: { airtable: 'In Progress' },
        },
      };
      const result = airtableStatusTransform.fromCanonical(canonical, statusConfig);
      expect(result).toBe('In Progress');
    });

    it('falls back to label when source_refs is missing', () => {
      const canonical: CanonicalValue = {
        type: 'status',
        value: {
          id: 'es_opt_ip',
          label: 'In Progress',
          category: 'in_progress' as const,
        },
      };
      const result = airtableStatusTransform.fromCanonical(canonical, statusConfig);
      expect(result).toBe('In Progress');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'status', value: null };
      const result = airtableStatusTransform.fromCanonical(canonical, statusConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableStatusTransform.fromCanonical(canonical, statusConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableStatusTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// multipleSelects (tags) → tag
// ---------------------------------------------------------------------------

describe('airtableTagTransform', () => {
  describe('toCanonical', () => {
    it('converts string array to tag canonical form', () => {
      const result = airtableTagTransform.toCanonical(['urgent', 'bug', 'frontend'], baseConfig);
      expect(result).toEqual({ type: 'tag', value: ['urgent', 'bug', 'frontend'] });
    });

    it('returns empty array for null input', () => {
      const result = airtableTagTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'tag', value: [] });
    });

    it('returns empty array for undefined input', () => {
      const result = airtableTagTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'tag', value: [] });
    });

    it('returns empty array for non-array input', () => {
      const result = airtableTagTransform.toCanonical('not an array', baseConfig);
      expect(result).toEqual({ type: 'tag', value: [] });
    });

    it('coerces non-string values in array to strings', () => {
      const result = airtableTagTransform.toCanonical([123, true, 'text'], baseConfig);
      expect(result).toEqual({ type: 'tag', value: ['123', 'true', 'text'] });
    });

    it('handles empty array', () => {
      const result = airtableTagTransform.toCanonical([], baseConfig);
      expect(result).toEqual({ type: 'tag', value: [] });
    });
  });

  describe('fromCanonical', () => {
    it('returns the string array directly', () => {
      const canonical: CanonicalValue = { type: 'tag', value: ['urgent', 'bug'] };
      const result = airtableTagTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual(['urgent', 'bug']);
    });

    it('returns empty array for empty tags', () => {
      const canonical: CanonicalValue = { type: 'tag', value: [] };
      const result = airtableTagTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual([]);
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableTagTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableTagTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('selection transforms round-trip', () => {
  it('single_select round-trips losslessly via source_refs', () => {
    const options: SelectOption[] = [
      { id: 'es_opt_1', label: 'Active', source_refs: { airtable: 'Active' } },
    ];
    const config = configWithOptions(options);

    const canonical = airtableSingleSelectTransform.toCanonical('Active', config);
    const platformValue = airtableSingleSelectTransform.fromCanonical(canonical, config);
    expect(platformValue).toBe('Active');
  });

  it('multiple_select round-trips losslessly via source_refs', () => {
    const options: SelectOption[] = [
      { id: 'es_opt_a', label: 'Red' },
      { id: 'es_opt_b', label: 'Blue' },
    ];
    const config = configWithOptions(options);

    const canonical = airtableMultipleSelectTransform.toCanonical(['Red', 'Blue'], config);
    const platformValue = airtableMultipleSelectTransform.fromCanonical(canonical, config);
    expect(platformValue).toEqual(['Red', 'Blue']);
  });

  it('tag round-trips losslessly', () => {
    const canonical = airtableTagTransform.toCanonical(['a', 'b', 'c'], baseConfig);
    const platformValue = airtableTagTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toEqual(['a', 'b', 'c']);
  });
});
