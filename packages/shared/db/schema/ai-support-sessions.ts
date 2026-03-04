import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { supportRequests } from './support-requests';
import { tenants } from './tenants';
import { users } from './users';

/**
 * AI support session audit trail.
 * Records the full AI interaction context for each support request:
 * classification, confirmation, resolution attempt, confidence scoring, and cost.
 *
 * classified_category values: how_to | sync_error | billing_info | billing_action | bug_report | account_access | data_issue | feature_request
 * outcome values: auto_resolved | escalated | user_closed
 */
export const aiSupportSessions = pgTable(
  'ai_support_sessions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    supportRequestId: uuid('support_request_id').references(() => supportRequests.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    userId: uuid('user_id').notNull().references(() => users.id),

    // Request classification
    classifiedCategory: varchar('classified_category', { length: 50 }),
    urgencyScore: smallint('urgency_score'),

    // Confirmation step
    rephraseText: text('rephrase_text'),
    userConfirmed: boolean('user_confirmed'),
    clarificationRounds: smallint('clarification_rounds').default(0).notNull(),

    // Resolution attempt
    kbChunksUsed: jsonb('kb_chunks_used').$type<string[]>(),
    confidenceScore: smallint('confidence_score'),
    draftReply: text('draft_reply'),
    autoSent: boolean('auto_sent').default(false).notNull(),

    // Outcome
    outcome: varchar('outcome', { length: 20 }),

    // Cost
    aiCreditsUsed: integer('ai_credits_used').default(0).notNull(),
    modelUsed: varchar('model_used', { length: 100 }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_ai_support_tenant').on(table.tenantId),
    index('idx_ai_support_request').on(table.supportRequestId),
  ],
);

export const aiSupportSessionsRelations = relations(aiSupportSessions, ({ one }) => ({
  supportRequest: one(supportRequests, {
    fields: [aiSupportSessions.supportRequestId],
    references: [supportRequests.id],
  }),
  tenant: one(tenants, {
    fields: [aiSupportSessions.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [aiSupportSessions.userId],
    references: [users.id],
  }),
}));

export type AiSupportSession = InferSelectModel<typeof aiSupportSessions>;
export type NewAiSupportSession = InferInsertModel<typeof aiSupportSessions>;
