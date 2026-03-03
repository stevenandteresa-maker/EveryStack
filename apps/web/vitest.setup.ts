import { beforeAll, afterEach } from 'vitest';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { getTestDb } from '@everystack/shared/testing';

const hasTestDb = Boolean(process.env.DATABASE_URL);

beforeAll(async () => {
  if (!hasTestDb) return;
  const db = getTestDb();
  await migrate(db, {
    migrationsFolder: '../../packages/shared/db/migrations',
  });
});

afterEach(async () => {
  if (!hasTestDb) return;
  const db = getTestDb();
  // Use a single TRUNCATE for all tables to avoid deadlocks between forked processes.
  // Individual per-table TRUNCATE with CASCADE causes lock contention.
  await db.execute(sql`
    DO $$ DECLARE
      tables_to_truncate TEXT;
    BEGIN
      SELECT string_agg(quote_ident(tablename), ', ')
        INTO tables_to_truncate
        FROM pg_tables
       WHERE schemaname = 'public';
      IF tables_to_truncate IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || tables_to_truncate || ' CASCADE';
      END IF;
    END $$;
  `);
});
