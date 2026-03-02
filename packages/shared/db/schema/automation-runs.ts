import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { automations } from './automations';

export const automationRuns = pgTable(
  'automation_runs',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    triggerRecordId: uuid('trigger_record_id'),
    status: varchar('status', { length: 20 }).default('running').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    stepLog: jsonb('step_log').$type<Record<string, unknown>[]>().default([]).notNull(),
  },
  (table) => [
    index('automation_runs_automation_started_idx').on(table.automationId, table.startedAt.desc()),
  ],
);

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  automation: one(automations, {
    fields: [automationRuns.automationId],
    references: [automations.id],
  }),
}));

export type AutomationRun = InferSelectModel<typeof automationRuns>;
export type NewAutomationRun = InferInsertModel<typeof automationRuns>;
