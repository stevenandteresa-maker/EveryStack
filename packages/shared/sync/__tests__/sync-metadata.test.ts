import { describe, it, expect } from 'vitest';
import {
  createInitialSyncMetadata,
  updateLastSyncedValues,
  getLastSyncedValue,
} from '../sync-metadata';
import { SyncMetadataSchema } from '../types';
import type { SyncMetadata } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSyncMetadata(overrides?: Partial<SyncMetadata>): SyncMetadata {
  return {
    platform_record_id: 'rec_abc',
    last_synced_at: '2026-01-15T10:00:00.000Z',
    last_synced_values: {},
    sync_status: 'active',
    sync_direction: 'inbound',
    orphaned_at: null,
    orphaned_reason: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createInitialSyncMetadata
// ---------------------------------------------------------------------------

describe('createInitialSyncMetadata', () => {
  it('populates all synced field values with timestamps', () => {
    const canonicalData: Record<string, unknown> = {
      'field-1': { type: 'text', value: 'Alice' },
      'field-2': { type: 'number', value: 42 },
      'field-3': { type: 'checkbox', value: true },
    };
    const fieldIds = ['field-1', 'field-2', 'field-3'];

    const result = createInitialSyncMetadata('rec_001', canonicalData, fieldIds);

    expect(result.platform_record_id).toBe('rec_001');
    expect(result.sync_status).toBe('active');
    expect(result.sync_direction).toBe('inbound');
    expect(result.orphaned_at).toBeNull();
    expect(result.orphaned_reason).toBeNull();

    // All three fields should have entries
    expect(Object.keys(result.last_synced_values)).toHaveLength(3);
    for (const fieldId of fieldIds) {
      expect(result.last_synced_values[fieldId]).toBeDefined();
      expect(result.last_synced_values[fieldId]!.value).toEqual(canonicalData[fieldId]);
      expect(result.last_synced_values[fieldId]!.synced_at).toBe(result.last_synced_at);
    }
  });

  it('skips fields not present in canonicalData', () => {
    const canonicalData = { 'field-1': { type: 'text', value: 'Alice' } };
    const fieldIds = ['field-1', 'field-missing'];

    const result = createInitialSyncMetadata('rec_002', canonicalData, fieldIds);

    expect(Object.keys(result.last_synced_values)).toHaveLength(1);
    expect(result.last_synced_values['field-1']).toBeDefined();
    expect(result.last_synced_values['field-missing']).toBeUndefined();
  });

  it('handles empty fieldIds', () => {
    const canonicalData = { 'field-1': { type: 'text', value: 'Alice' } };

    const result = createInitialSyncMetadata('rec_003', canonicalData, []);

    expect(Object.keys(result.last_synced_values)).toHaveLength(0);
    expect(result.last_synced_at).toBeTruthy();
  });

  it('handles empty canonicalData', () => {
    const result = createInitialSyncMetadata('rec_004', {}, ['field-1', 'field-2']);

    expect(Object.keys(result.last_synced_values)).toHaveLength(0);
  });

  it('respects custom sync_direction', () => {
    const result = createInitialSyncMetadata('rec_005', {}, [], 'both');

    expect(result.sync_direction).toBe('both');
  });

  it('defaults sync_direction to inbound', () => {
    const result = createInitialSyncMetadata('rec_006', {}, []);

    expect(result.sync_direction).toBe('inbound');
  });

  it('preserves null field values', () => {
    const canonicalData = { 'field-1': { type: 'text', value: null } };

    const result = createInitialSyncMetadata('rec_007', canonicalData, ['field-1']);

    expect(result.last_synced_values['field-1']!.value).toEqual({ type: 'text', value: null });
  });

  it('produces a valid SyncMetadata per Zod schema', () => {
    const canonicalData = { 'field-1': { type: 'text', value: 'test' } };
    const result = createInitialSyncMetadata('rec_008', canonicalData, ['field-1']);

    expect(() => SyncMetadataSchema.parse(result)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateLastSyncedValues
// ---------------------------------------------------------------------------

describe('updateLastSyncedValues', () => {
  it('updates only specified fields, preserves others', () => {
    const existing = makeSyncMetadata({
      last_synced_values: {
        'field-1': { value: 'old-val-1', synced_at: '2026-01-01T00:00:00.000Z' },
        'field-2': { value: 'old-val-2', synced_at: '2026-01-01T00:00:00.000Z' },
        'field-3': { value: 'old-val-3', synced_at: '2026-01-01T00:00:00.000Z' },
      },
    });

    const newCanonical = {
      'field-1': 'new-val-1',
      'field-2': 'new-val-2',
      'field-3': 'old-val-3',
    };

    const result = updateLastSyncedValues(existing, ['field-1', 'field-2'], newCanonical);

    // Updated fields have new values and new timestamps
    expect(result.last_synced_values['field-1']!.value).toBe('new-val-1');
    expect(result.last_synced_values['field-2']!.value).toBe('new-val-2');
    expect(result.last_synced_values['field-1']!.synced_at).toBe(result.last_synced_at);

    // Preserved field is unchanged
    expect(result.last_synced_values['field-3']!.value).toBe('old-val-3');
    expect(result.last_synced_values['field-3']!.synced_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('adds new fields that did not exist before', () => {
    const existing = makeSyncMetadata({
      last_synced_values: {
        'field-1': { value: 'val-1', synced_at: '2026-01-01T00:00:00.000Z' },
      },
    });

    const newCanonical = {
      'field-1': 'val-1',
      'field-new': 'brand-new',
    };

    const result = updateLastSyncedValues(existing, ['field-new'], newCanonical);

    const newEntry = result.last_synced_values['field-new'];
    expect(newEntry).toBeDefined();
    expect(newEntry!.value).toBe('brand-new');
    // Original field is preserved
    expect(result.last_synced_values['field-1']!.value).toBe('val-1');
  });

  it('skips updatedFieldIds not present in canonicalData', () => {
    const existing = makeSyncMetadata({
      last_synced_values: {
        'field-1': { value: 'val', synced_at: '2026-01-01T00:00:00.000Z' },
      },
    });

    const result = updateLastSyncedValues(existing, ['field-missing'], {});

    expect(result.last_synced_values['field-missing']).toBeUndefined();
    expect(result.last_synced_values['field-1']!.value).toBe('val');
  });

  it('handles empty updatedFieldIds', () => {
    const existing = makeSyncMetadata({
      last_synced_values: {
        'field-1': { value: 'val', synced_at: '2026-01-01T00:00:00.000Z' },
      },
    });

    const result = updateLastSyncedValues(existing, [], { 'field-1': 'new-val' });

    // Nothing updated, last_synced_at still changes
    expect(result.last_synced_values['field-1']!.value).toBe('val');
    expect(result.last_synced_values['field-1']!.synced_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('preserves non-value metadata fields', () => {
    const existing = makeSyncMetadata({
      platform_record_id: 'rec_xyz',
      sync_status: 'active',
      sync_direction: 'both',
      orphaned_at: null,
      orphaned_reason: null,
    });

    const result = updateLastSyncedValues(existing, [], {});

    expect(result.platform_record_id).toBe('rec_xyz');
    expect(result.sync_status).toBe('active');
    expect(result.sync_direction).toBe('both');
    expect(result.orphaned_at).toBeNull();
    expect(result.orphaned_reason).toBeNull();
  });

  it('updates last_synced_at timestamp', () => {
    const existing = makeSyncMetadata({
      last_synced_at: '2020-01-01T00:00:00.000Z',
    });

    const result = updateLastSyncedValues(existing, [], {});

    expect(result.last_synced_at).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('produces a valid SyncMetadata per Zod schema', () => {
    const existing = makeSyncMetadata({
      last_synced_values: {
        'field-1': { value: 'old', synced_at: '2026-01-01T00:00:00.000Z' },
      },
    });
    const result = updateLastSyncedValues(existing, ['field-1'], { 'field-1': 'new' });

    expect(() => SyncMetadataSchema.parse(result)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getLastSyncedValue
// ---------------------------------------------------------------------------

describe('getLastSyncedValue', () => {
  it('returns the value for an existing field', () => {
    const metadata = makeSyncMetadata({
      last_synced_values: {
        'field-1': { value: { type: 'text', value: 'Alice' }, synced_at: '2026-01-15T10:00:00.000Z' },
      },
    });

    const result = getLastSyncedValue(metadata, 'field-1');

    expect(result).toEqual({ type: 'text', value: 'Alice' });
  });

  it('returns undefined for a missing field', () => {
    const metadata = makeSyncMetadata({ last_synced_values: {} });

    const result = getLastSyncedValue(metadata, 'field-nonexistent');

    expect(result).toBeUndefined();
  });

  it('returns null when the field value is null', () => {
    const metadata = makeSyncMetadata({
      last_synced_values: {
        'field-1': { value: null, synced_at: '2026-01-15T10:00:00.000Z' },
      },
    });

    const result = getLastSyncedValue(metadata, 'field-1');

    expect(result).toBeNull();
  });

  it('returns complex objects intact', () => {
    const complexValue = {
      type: 'multiple_select',
      value: [
        { id: 'opt1', label: 'High', source_refs: { airtable: 'High' } },
        { id: 'opt2', label: 'Low', source_refs: { airtable: 'Low' } },
      ],
    };

    const metadata = makeSyncMetadata({
      last_synced_values: {
        'field-1': { value: complexValue, synced_at: '2026-01-15T10:00:00.000Z' },
      },
    });

    const result = getLastSyncedValue(metadata, 'field-1');

    expect(result).toEqual(complexValue);
  });
});

// ---------------------------------------------------------------------------
// SyncMetadataSchema validation
// ---------------------------------------------------------------------------

describe('SyncMetadataSchema', () => {
  it('validates a correct SyncMetadata object', () => {
    const valid = {
      platform_record_id: 'rec_abc',
      last_synced_at: '2026-01-15T10:00:00.000Z',
      last_synced_values: {
        'field-1': { value: 'hello', synced_at: '2026-01-15T10:00:00.000Z' },
      },
      sync_status: 'active',
      sync_direction: 'inbound',
      orphaned_at: null,
      orphaned_reason: null,
    };

    const result = SyncMetadataSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing platform_record_id', () => {
    const invalid = {
      last_synced_at: '2026-01-15T10:00:00.000Z',
      last_synced_values: {},
      sync_status: 'active',
      sync_direction: 'inbound',
      orphaned_at: null,
      orphaned_reason: null,
    };

    const result = SyncMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid sync_status', () => {
    const invalid = {
      platform_record_id: 'rec_abc',
      last_synced_at: '2026-01-15T10:00:00.000Z',
      last_synced_values: {},
      sync_status: 'paused',
      sync_direction: 'inbound',
      orphaned_at: null,
      orphaned_reason: null,
    };

    const result = SyncMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid sync_direction', () => {
    const invalid = {
      platform_record_id: 'rec_abc',
      last_synced_at: '2026-01-15T10:00:00.000Z',
      last_synced_values: {},
      sync_status: 'active',
      sync_direction: 'bidirectional',
      orphaned_at: null,
      orphaned_reason: null,
    };

    const result = SyncMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts orphaned status with orphan metadata', () => {
    const valid = {
      platform_record_id: 'rec_abc',
      last_synced_at: '2026-01-15T10:00:00.000Z',
      last_synced_values: {},
      sync_status: 'orphaned',
      sync_direction: 'inbound',
      orphaned_at: '2026-01-16T10:00:00.000Z',
      orphaned_reason: 'filter_changed',
    };

    const result = SyncMetadataSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects non-ISO timestamps', () => {
    const invalid = {
      platform_record_id: 'rec_abc',
      last_synced_at: 'not-a-date',
      last_synced_values: {},
      sync_status: 'active',
      sync_direction: 'inbound',
      orphaned_at: null,
      orphaned_reason: null,
    };

    const result = SyncMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates nested SyncedFieldValue entries', () => {
    const valid = {
      platform_record_id: 'rec_abc',
      last_synced_at: '2026-01-15T10:00:00.000Z',
      last_synced_values: {
        'field-1': { value: { type: 'text', value: 'hello' }, synced_at: '2026-01-15T10:00:00.000Z' },
        'field-2': { value: 42, synced_at: '2026-01-15T10:00:00.000Z' },
        'field-3': { value: null, synced_at: '2026-01-15T10:00:00.000Z' },
      },
      sync_status: 'active',
      sync_direction: 'both',
      orphaned_at: null,
      orphaned_reason: null,
    };

    const result = SyncMetadataSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
