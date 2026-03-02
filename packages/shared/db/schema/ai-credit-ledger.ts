import {
  date,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';

/**
 * AI credit ledger — monthly credit budget per tenant.
 * credits_remaining is a GENERATED ALWAYS AS column (credits_total - credits_used).
 */
export const aiCreditLedger = pgTable(
  'ai_credit_ledger',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    creditsTotal: integer('credits_total').notNull(),
    creditsUsed: numeric('credits_used', { precision: 10, scale: 2 }).default('0').notNull(),
    creditsRemaining: numeric('credits_remaining', { precision: 10, scale: 2 })
      .generatedAlwaysAs(sql`credits_total - credits_used`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('ai_credit_ledger_tenant_period_idx').on(table.tenantId, table.periodStart),
  ],
);

export const aiCreditLedgerRelations = relations(aiCreditLedger, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiCreditLedger.tenantId],
    references: [tenants.id],
  }),
}));

export type AiCreditLedger = InferSelectModel<typeof aiCreditLedger>;
export type NewAiCreditLedger = InferInsertModel<typeof aiCreditLedger>;
