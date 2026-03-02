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
  await db.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
});
