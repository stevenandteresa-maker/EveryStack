import { describe, it, expect } from 'vitest';
import {
  detectConflicts,
  valuesAreEqual,
} from '../conflict-detection';
import type { SyncMetadata } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSyncMetadata(
  lastSyncedValues: Record<string, { value: unknown; synced_at: string }>,
): SyncMetadata {
  return {
    platform_record_id: 'rec_abc',
    last_synced_at: '2026-01-15T10:00:00.000Z',
    last_synced_values: lastSyncedValues,
    sync_status: 'active',
    sync_direction: 'inbound',
    orphaned_at: null,
    orphaned_reason: null,
  };
}

const SYNCED_AT = '2026-01-15T10:00:00.000Z';

// ---------------------------------------------------------------------------
// valuesAreEqual
// ---------------------------------------------------------------------------

describe('valuesAreEqual', () => {
  it('treats null and undefined as equal', () => {
    expect(valuesAreEqual(null, undefined)).toBe(true);
    expect(valuesAreEqual(undefined, null)).toBe(true);
  });

  it('treats two nulls as equal', () => {
    expect(valuesAreEqual(null, null)).toBe(true);
  });

  it('treats two undefineds as equal', () => {
    expect(valuesAreEqual(undefined, undefined)).toBe(true);
  });

  it('compares primitives correctly', () => {
    expect(valuesAreEqual('hello', 'hello')).toBe(true);
    expect(valuesAreEqual('hello', 'world')).toBe(false);
    expect(valuesAreEqual(42, 42)).toBe(true);
    expect(valuesAreEqual(42, 43)).toBe(false);
    expect(valuesAreEqual(true, true)).toBe(true);
    expect(valuesAreEqual(true, false)).toBe(false);
  });

  it('compares objects deeply', () => {
    const obj1 = { type: 'text', value: 'Alice' };
    const obj2 = { type: 'text', value: 'Alice' };
    const obj3 = { type: 'text', value: 'Bob' };
    expect(valuesAreEqual(obj1, obj2)).toBe(true);
    expect(valuesAreEqual(obj1, obj3)).toBe(false);
  });

  it('compares arrays deeply', () => {
    expect(valuesAreEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(valuesAreEqual([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it('differentiates null from non-null', () => {
    expect(valuesAreEqual(null, 'hello')).toBe(false);
    expect(valuesAreEqual(0, null)).toBe(false);
    expect(valuesAreEqual('', null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectConflicts — five comparison outcomes
// ---------------------------------------------------------------------------

describe('detectConflicts', () => {
  const fieldId = 'field-1';
  const syncedFieldIds = [fieldId];

  describe('outcome: unchanged', () => {
    it('all three values equal → unchanged', () => {
      const base = { type: 'text', value: 'Alice' };
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: base, synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { [fieldId]: base },
        { [fieldId]: base },
        syncMeta,
        syncedFieldIds,
      );

      expect(result.unchangedFieldIds).toContain(fieldId);
      expect(result.cleanRemoteChanges).toHaveLength(0);
      expect(result.cleanLocalChanges).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
      expect(result.convergentFieldIds).toHaveLength(0);
    });
  });

  describe('outcome: clean remote change', () => {
    it('local unchanged + remote changed → clean remote', () => {
      const base = { type: 'text', value: 'Alice' };
      const remote = { type: 'text', value: 'Bob' };
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: base, synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { [fieldId]: base },   // local == base
        { [fieldId]: remote }, // remote != base
        syncMeta,
        syncedFieldIds,
      );

      expect(result.cleanRemoteChanges).toHaveLength(1);
      expect(result.cleanRemoteChanges[0]).toEqual({ fieldId, value: remote });
      expect(result.cleanLocalChanges).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('outcome: clean local change', () => {
    it('local changed + remote unchanged → clean local', () => {
      const base = { type: 'text', value: 'Alice' };
      const local = { type: 'text', value: 'Charlie' };
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: base, synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { [fieldId]: local }, // local != base
        { [fieldId]: base },  // remote == base
        syncMeta,
        syncedFieldIds,
      );

      expect(result.cleanLocalChanges).toHaveLength(1);
      expect(result.cleanLocalChanges[0]).toEqual({ fieldId, value: local });
      expect(result.cleanRemoteChanges).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('outcome: conflict', () => {
    it('both changed to different values → conflict', () => {
      const base = { type: 'text', value: 'Alice' };
      const local = { type: 'text', value: 'Bob' };
      const remote = { type: 'text', value: 'Charlie' };
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: base, synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { [fieldId]: local },
        { [fieldId]: remote },
        syncMeta,
        syncedFieldIds,
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        fieldId,
        localValue: local,
        remoteValue: remote,
        baseValue: base,
      });
      expect(result.cleanRemoteChanges).toHaveLength(0);
      expect(result.cleanLocalChanges).toHaveLength(0);
    });
  });

  describe('outcome: convergent', () => {
    it('both changed to the SAME value → convergent (no conflict)', () => {
      const base = { type: 'text', value: 'Alice' };
      const same = { type: 'text', value: 'Bob' };
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: base, synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { [fieldId]: same },
        { [fieldId]: same },
        syncMeta,
        syncedFieldIds,
      );

      expect(result.convergentFieldIds).toContain(fieldId);
      expect(result.conflicts).toHaveLength(0);
      expect(result.cleanRemoteChanges).toHaveLength(0);
      expect(result.cleanLocalChanges).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('null sync_metadata', () => {
    it('treats all inbound values as clean remote changes', () => {
      const local = { type: 'text', value: 'Alice' };
      const remote = { type: 'text', value: 'Bob' };

      const result = detectConflicts(
        { [fieldId]: local },
        { [fieldId]: remote },
        null, // no sync_metadata
        syncedFieldIds,
      );

      expect(result.cleanRemoteChanges).toHaveLength(1);
      expect(result.cleanRemoteChanges[0]).toEqual({ fieldId, value: remote });
      expect(result.conflicts).toHaveLength(0);
    });

    it('marks as unchanged when local == remote and no metadata', () => {
      const same = { type: 'text', value: 'Alice' };

      const result = detectConflicts(
        { [fieldId]: same },
        { [fieldId]: same },
        null,
        syncedFieldIds,
      );

      expect(result.unchangedFieldIds).toContain(fieldId);
      expect(result.cleanRemoteChanges).toHaveLength(0);
    });
  });

  describe('empty last_synced_values', () => {
    it('treats field without base entry as clean remote change', () => {
      const syncMeta = makeSyncMetadata({}); // no entries
      const local = { type: 'number', value: 10 };
      const remote = { type: 'number', value: 20 };

      const result = detectConflicts(
        { [fieldId]: local },
        { [fieldId]: remote },
        syncMeta,
        syncedFieldIds,
      );

      expect(result.cleanRemoteChanges).toHaveLength(1);
      expect(result.cleanRemoteChanges[0]).toEqual({ fieldId, value: remote });
    });
  });

  describe('null/undefined equivalence', () => {
    it('treats null base and undefined local as equal (unchanged)', () => {
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: null, synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { /* fieldId not present — undefined */ },
        { [fieldId]: null },
        syncMeta,
        syncedFieldIds,
      );

      // local (undefined) == base (null) == remote (null) → unchanged
      expect(result.unchangedFieldIds).toContain(fieldId);
    });

    it('treats undefined remote and null base as equal (clean local change)', () => {
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: null, synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { [fieldId]: { type: 'text', value: 'Changed' } },
        { /* fieldId not present — undefined for remote */ },
        syncMeta,
        syncedFieldIds,
      );

      // local changed, remote (undefined) == base (null) → clean local
      expect(result.cleanLocalChanges).toHaveLength(1);
    });
  });

  describe('multiple fields', () => {
    it('classifies each field independently', () => {
      const fieldA = 'field-a';
      const fieldB = 'field-b';
      const fieldC = 'field-c';
      const fieldD = 'field-d';
      const fieldE = 'field-e';

      const syncMeta = makeSyncMetadata({
        [fieldA]: { value: 'a-base', synced_at: SYNCED_AT },
        [fieldB]: { value: 'b-base', synced_at: SYNCED_AT },
        [fieldC]: { value: 'c-base', synced_at: SYNCED_AT },
        [fieldD]: { value: 'd-base', synced_at: SYNCED_AT },
        [fieldE]: { value: 'e-base', synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        {
          [fieldA]: 'a-base',      // unchanged
          [fieldB]: 'b-base',      // clean remote
          [fieldC]: 'c-local',     // clean local
          [fieldD]: 'd-local',     // conflict
          [fieldE]: 'e-both',      // convergent
        },
        {
          [fieldA]: 'a-base',      // unchanged
          [fieldB]: 'b-remote',    // clean remote
          [fieldC]: 'c-base',      // clean local
          [fieldD]: 'd-remote',    // conflict
          [fieldE]: 'e-both',      // convergent
        },
        syncMeta,
        [fieldA, fieldB, fieldC, fieldD, fieldE],
      );

      expect(result.unchangedFieldIds).toEqual([fieldA]);
      expect(result.cleanRemoteChanges).toEqual([{ fieldId: fieldB, value: 'b-remote' }]);
      expect(result.cleanLocalChanges).toEqual([{ fieldId: fieldC, value: 'c-local' }]);
      expect(result.conflicts).toEqual([{
        fieldId: fieldD,
        localValue: 'd-local',
        remoteValue: 'd-remote',
        baseValue: 'd-base',
      }]);
      expect(result.convergentFieldIds).toEqual([fieldE]);
    });
  });

  describe('complex canonical values', () => {
    it('detects conflict on nested objects', () => {
      const base = { type: 'single_select', value: { id: 'opt-1', label: 'Open' } };
      const local = { type: 'single_select', value: { id: 'opt-2', label: 'Closed' } };
      const remote = { type: 'single_select', value: { id: 'opt-3', label: 'In Progress' } };
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: base, synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { [fieldId]: local },
        { [fieldId]: remote },
        syncMeta,
        syncedFieldIds,
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]!.baseValue).toEqual(base);
    });

    it('detects convergence on nested objects', () => {
      const base = { type: 'number', value: 10 };
      const both = { type: 'number', value: 20 };
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: base, synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { [fieldId]: both },
        { [fieldId]: both },
        syncMeta,
        syncedFieldIds,
      );

      expect(result.convergentFieldIds).toContain(fieldId);
    });
  });

  describe('fields not in syncedFieldIds are ignored', () => {
    it('only processes fields in the syncedFieldIds list', () => {
      const syncMeta = makeSyncMetadata({
        [fieldId]: { value: 'base', synced_at: SYNCED_AT },
        'field-extra': { value: 'extra', synced_at: SYNCED_AT },
      });

      const result = detectConflicts(
        { [fieldId]: 'base', 'field-extra': 'changed' },
        { [fieldId]: 'remote', 'field-extra': 'also-changed' },
        syncMeta,
        [fieldId], // only fieldId, not field-extra
      );

      // field-extra should not appear anywhere
      expect(result.cleanRemoteChanges).toHaveLength(1);
      expect(result.cleanRemoteChanges[0]!.fieldId).toBe(fieldId);
      const allFieldIds = [
        ...result.unchangedFieldIds,
        ...result.cleanRemoteChanges.map((c) => c.fieldId),
        ...result.cleanLocalChanges.map((c) => c.fieldId),
        ...result.conflicts.map((c) => c.fieldId),
        ...result.convergentFieldIds,
      ];
      expect(allFieldIds).not.toContain('field-extra');
    });
  });
});
