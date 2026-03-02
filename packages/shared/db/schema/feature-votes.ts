import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { featureSuggestions } from './feature-suggestions';
import { users } from './users';

/**
 * Feature votes — one vote per user per suggestion.
 */
export const featureVotes = pgTable(
  'feature_votes',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    suggestionId: uuid('suggestion_id')
      .notNull()
      .references(() => featureSuggestions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('feature_votes_suggestion_user_idx').on(table.suggestionId, table.userId),
  ],
);

export const featureVotesRelations = relations(featureVotes, ({ one }) => ({
  suggestion: one(featureSuggestions, {
    fields: [featureVotes.suggestionId],
    references: [featureSuggestions.id],
  }),
  user: one(users, {
    fields: [featureVotes.userId],
    references: [users.id],
  }),
}));

export type FeatureVote = InferSelectModel<typeof featureVotes>;
export type NewFeatureVote = InferInsertModel<typeof featureVotes>;
