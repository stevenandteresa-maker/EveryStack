import {
  index,
  integer,
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
import { users } from './users';
import { tenants } from './tenants';

/**
 * Feature suggestions — user-submitted feature requests.
 */
export const featureSuggestions = pgTable(
  'feature_suggestions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 64 }),
    userPriority: varchar('user_priority', { length: 32 }),
    context: jsonb('context').$type<Record<string, unknown>>().default({}).notNull(),
    status: varchar('status', { length: 32 }).default('open').notNull(),
    voteCount: integer('vote_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('feature_suggestions_tenant_status_idx').on(table.tenantId, table.status),
    index('feature_suggestions_tenant_votes_idx').on(table.tenantId, table.voteCount.desc()),
  ],
);

export const featureSuggestionsRelations = relations(featureSuggestions, ({ one }) => ({
  user: one(users, {
    fields: [featureSuggestions.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [featureSuggestions.tenantId],
    references: [tenants.id],
  }),
}));

export type FeatureSuggestion = InferSelectModel<typeof featureSuggestions>;
export type NewFeatureSuggestion = InferInsertModel<typeof featureSuggestions>;
