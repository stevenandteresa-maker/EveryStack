import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema',
  out: './db/migrations',
  dbCredentials: {
    // Direct connection bypasses PgBouncer — required for migrations
    // (DDL statements need session-mode connections, not transaction-mode)
    url: process.env.DATABASE_URL_DIRECT!,
  },
});
