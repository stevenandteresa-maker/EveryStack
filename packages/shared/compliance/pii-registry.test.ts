import { describe, it, expect } from 'vitest';
import { getPiiColumnsForTable, getAllPiiTables } from './pii-registry';
import type { PiiTableEntry } from './pii-registry';

describe('PII Registry', () => {
  // ─── getPiiColumnsForTable ───────────────────────────────────────────────

  describe('getPiiColumnsForTable', () => {
    it('returns 4 PII columns for users table', () => {
      const columns = getPiiColumnsForTable('users');
      expect(columns).toHaveLength(4);

      const columnNames = columns.map((c) => c.column);
      expect(columnNames).toEqual(['email', 'name', 'avatar_url', 'preferences']);
    });

    it('returns correct anonymization strategies for users', () => {
      const columns = getPiiColumnsForTable('users');

      const email = columns.find((c) => c.column === 'email');
      expect(email).toBeDefined();
      expect(email?.sensitivity).toBe('direct');
      expect(email?.onUserDeletion).toBe('anonymize');
      expect(email?.anonymizeTo).toBe('deleted_user_<hash>');

      const name = columns.find((c) => c.column === 'name');
      expect(name).toBeDefined();
      expect(name?.sensitivity).toBe('direct');
      expect(name?.onUserDeletion).toBe('anonymize');
      expect(name?.anonymizeTo).toBeNull();

      const prefs = columns.find((c) => c.column === 'preferences');
      expect(prefs).toBeDefined();
      expect(prefs?.onUserDeletion).toBe('anonymize');
      expect(prefs?.anonymizeTo).toBe('{}');
    });

    it('returns 1 column for workspace_memberships (retained FK)', () => {
      const columns = getPiiColumnsForTable('workspace_memberships');
      expect(columns).toHaveLength(1);
      expect(columns[0]?.column).toBe('user_id');
      expect(columns[0]?.sensitivity).toBe('indirect');
      expect(columns[0]?.onUserDeletion).toBe('retain');
    });

    it('returns 1 column for records (content, retained)', () => {
      const columns = getPiiColumnsForTable('records');
      expect(columns).toHaveLength(1);
      expect(columns[0]?.column).toBe('canonical_data');
      expect(columns[0]?.sensitivity).toBe('content');
      expect(columns[0]?.onUserDeletion).toBe('retain');
    });

    it('returns 2 columns for thread_messages', () => {
      const columns = getPiiColumnsForTable('thread_messages');
      expect(columns).toHaveLength(2);

      const sender = columns.find((c) => c.column === 'sender_id');
      expect(sender).toBeDefined();
      expect(sender?.onUserDeletion).toBe('anonymize');

      const content = columns.find((c) => c.column === 'content');
      expect(content).toBeDefined();
      expect(content?.onUserDeletion).toBe('retain');
    });

    it('returns 2 columns for ai_usage_log (all deleted)', () => {
      const columns = getPiiColumnsForTable('ai_usage_log');
      expect(columns).toHaveLength(2);
      expect(columns.every((c) => c.onUserDeletion === 'delete')).toBe(true);
    });

    it('returns 2 columns for command_bar_sessions (all deleted)', () => {
      const columns = getPiiColumnsForTable('command_bar_sessions');
      expect(columns).toHaveLength(2);
      expect(columns.every((c) => c.onUserDeletion === 'delete')).toBe(true);
    });

    it('returns 2 columns for audit_log', () => {
      const columns = getPiiColumnsForTable('audit_log');
      expect(columns).toHaveLength(2);

      const actor = columns.find((c) => c.column === 'actor_id');
      expect(actor).toBeDefined();
      expect(actor?.onUserDeletion).toBe('anonymize');

      const details = columns.find((c) => c.column === 'action_details');
      expect(details).toBeDefined();
      expect(details?.onUserDeletion).toBe('retain');
    });

    it('returns empty array for nonexistent table', () => {
      expect(getPiiColumnsForTable('nonexistent')).toEqual([]);
    });

    it('returns empty array for table without PII', () => {
      expect(getPiiColumnsForTable('tenants')).toEqual([]);
    });
  });

  // ─── getAllPiiTables ─────────────────────────────────────────────────────

  describe('getAllPiiTables', () => {
    it('returns all 7 PII-bearing tables', () => {
      const tables = getAllPiiTables();
      expect(tables).toHaveLength(7);
    });

    it('returns entries with correct shape', () => {
      const tables = getAllPiiTables();
      for (const entry of tables) {
        expect(entry).toHaveProperty('table');
        expect(entry).toHaveProperty('columns');
        expect(typeof entry.table).toBe('string');
        expect(Array.isArray(entry.columns)).toBe(true);
        expect(entry.columns.length).toBeGreaterThan(0);
      }
    });

    it('includes all expected table names', () => {
      const tables = getAllPiiTables();
      const tableNames = tables.map((t: PiiTableEntry) => t.table);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('workspace_memberships');
      expect(tableNames).toContain('records');
      expect(tableNames).toContain('thread_messages');
      expect(tableNames).toContain('ai_usage_log');
      expect(tableNames).toContain('command_bar_sessions');
      expect(tableNames).toContain('audit_log');
    });

    it('every column has required fields', () => {
      const tables = getAllPiiTables();
      for (const entry of tables) {
        for (const col of entry.columns) {
          expect(col).toHaveProperty('column');
          expect(col).toHaveProperty('sensitivity');
          expect(col).toHaveProperty('onUserDeletion');
          expect(['direct', 'indirect', 'content']).toContain(col.sensitivity);
          expect(['anonymize', 'delete', 'retain']).toContain(col.onUserDeletion);
        }
      }
    });

    it('anonymized columns have anonymizeTo defined', () => {
      const tables = getAllPiiTables();
      for (const entry of tables) {
        for (const col of entry.columns) {
          if (col.onUserDeletion === 'anonymize') {
            expect(col).toHaveProperty('anonymizeTo');
          }
        }
      }
    });
  });
});
