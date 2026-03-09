import '@testing-library/jest-dom/vitest';
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
  // Use DELETE with disabled triggers to avoid both:
  // 1. TRUNCATE's relfilenode bloat (hundreds of thousands of files over test runs)
  // 2. FK constraint violations from unordered DELETE
  // session_replication_role = 'replica' disables FK trigger checks.
  await db.execute(sql`
    DO $$ DECLARE
      tbl TEXT;
    BEGIN
      SET session_replication_role = 'replica';
      FOR tbl IN
        SELECT quote_ident(tablename)
          FROM pg_tables
         WHERE schemaname = 'public'
      LOOP
        EXECUTE 'DELETE FROM ' || tbl;
      END LOOP;
      SET session_replication_role = 'origin';
    END $$;
  `);
});
