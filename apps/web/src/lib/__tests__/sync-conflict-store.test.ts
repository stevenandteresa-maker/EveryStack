import { describe, it, expect, beforeEach } from 'vitest';
import { useSyncConflictStore } from '../sync-conflict-store';
import type { ConflictMeta, ConflictMap } from '../sync-conflict-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createConflictMeta(overrides?: Partial<ConflictMeta>): ConflictMeta {
  return {
    id: 'conflict-1',
    localValue: 'local-val',
    remoteValue: 'remote-val',
    platform: 'airtable',
    createdAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSyncConflictStore', () => {
  beforeEach(() => {
    // Reset the store to initial state between tests
    useSyncConflictStore.setState({ conflicts: {} });
  });

  describe('setInitialConflicts', () => {
    it('replaces the entire conflict map', () => {
      const initial: ConflictMap = {
        'rec-1': {
          'field-1': createConflictMeta({ id: 'c1' }),
          'field-2': createConflictMeta({ id: 'c2' }),
        },
        'rec-2': {
          'field-3': createConflictMeta({ id: 'c3' }),
        },
      };

      useSyncConflictStore.getState().setInitialConflicts(initial);

      expect(useSyncConflictStore.getState().conflicts).toEqual(initial);
    });

    it('clears previous conflicts when called with empty map', () => {
      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', createConflictMeta());
      useSyncConflictStore.getState().setInitialConflicts({});

      expect(useSyncConflictStore.getState().conflicts).toEqual({});
    });
  });

  describe('addConflict', () => {
    it('adds a conflict to a new record', () => {
      const meta = createConflictMeta({ id: 'c1' });

      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', meta);

      expect(useSyncConflictStore.getState().conflicts).toEqual({
        'rec-1': { 'field-1': meta },
      });
    });

    it('adds a second conflict to the same record', () => {
      const meta1 = createConflictMeta({ id: 'c1' });
      const meta2 = createConflictMeta({ id: 'c2', localValue: 'other' });

      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', meta1);
      useSyncConflictStore.getState().addConflict('rec-1', 'field-2', meta2);

      expect(useSyncConflictStore.getState().conflicts['rec-1']).toEqual({
        'field-1': meta1,
        'field-2': meta2,
      });
    });

    it('overwrites an existing conflict for the same field', () => {
      const meta1 = createConflictMeta({ id: 'c1', localValue: 'old' });
      const meta2 = createConflictMeta({ id: 'c1-updated', localValue: 'new' });

      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', meta1);
      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', meta2);

      expect(useSyncConflictStore.getState().conflicts['rec-1']!['field-1']).toEqual(meta2);
    });
  });

  describe('removeConflict', () => {
    it('removes a conflict and keeps other fields on the same record', () => {
      const meta1 = createConflictMeta({ id: 'c1' });
      const meta2 = createConflictMeta({ id: 'c2' });

      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', meta1);
      useSyncConflictStore.getState().addConflict('rec-1', 'field-2', meta2);
      useSyncConflictStore.getState().removeConflict('rec-1', 'field-1');

      expect(useSyncConflictStore.getState().conflicts).toEqual({
        'rec-1': { 'field-2': meta2 },
      });
    });

    it('removes the record entry when last conflict is removed', () => {
      const meta = createConflictMeta({ id: 'c1' });

      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', meta);
      useSyncConflictStore.getState().removeConflict('rec-1', 'field-1');

      expect(useSyncConflictStore.getState().conflicts).toEqual({});
      expect(useSyncConflictStore.getState().conflicts['rec-1']).toBeUndefined();
    });

    it('is a no-op for non-existent record/field', () => {
      const meta = createConflictMeta({ id: 'c1' });
      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', meta);

      useSyncConflictStore.getState().removeConflict('rec-999', 'field-1');
      useSyncConflictStore.getState().removeConflict('rec-1', 'field-999');

      // Original state unchanged
      expect(useSyncConflictStore.getState().conflicts).toEqual({
        'rec-1': { 'field-1': meta },
      });
    });
  });

  describe('getConflictsForRecord', () => {
    it('returns conflicts for a record', () => {
      const meta = createConflictMeta({ id: 'c1' });
      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', meta);

      const result = useSyncConflictStore.getState().getConflictsForRecord('rec-1');

      expect(result).toEqual({ 'field-1': meta });
    });

    it('returns empty object for non-existent record', () => {
      const result = useSyncConflictStore.getState().getConflictsForRecord('rec-missing');

      expect(result).toEqual({});
    });
  });

  describe('conflictCount', () => {
    it('returns 0 for empty store', () => {
      expect(useSyncConflictStore.getState().conflictCount()).toBe(0);
    });

    it('counts across multiple records and fields', () => {
      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', createConflictMeta({ id: 'c1' }));
      useSyncConflictStore.getState().addConflict('rec-1', 'field-2', createConflictMeta({ id: 'c2' }));
      useSyncConflictStore.getState().addConflict('rec-2', 'field-3', createConflictMeta({ id: 'c3' }));

      expect(useSyncConflictStore.getState().conflictCount()).toBe(3);
    });

    it('decrements after removal', () => {
      useSyncConflictStore.getState().addConflict('rec-1', 'field-1', createConflictMeta({ id: 'c1' }));
      useSyncConflictStore.getState().addConflict('rec-1', 'field-2', createConflictMeta({ id: 'c2' }));

      useSyncConflictStore.getState().removeConflict('rec-1', 'field-1');

      expect(useSyncConflictStore.getState().conflictCount()).toBe(1);
    });
  });
});
