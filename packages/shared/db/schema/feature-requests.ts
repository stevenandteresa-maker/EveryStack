import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { users } from './users';

/**
 * Feature requests logged by the support AI or manually by support staff.
 *
 * source values: support_ai | manual
 * status values: new | under_review | planned | shipped | declined
 */
export const featureRequests = pgTable(
  'feature_requests',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    submittedByUser: uuid('submitted_by_user').references(() => users.id, { onDelete: 'set null' }),
    source: varchar('source', { length: 20 }).default('support_ai').notNull(),
    requestText: text('request_text').notNull(),
    aiSummary: text('ai_summary'),
    category: varchar('category', { length: 50 }),
    status: varchar('status', { length: 20 }).default('new').notNull(),
    adminNotes: text('admin_notes'),
    voteCount: integer('vote_count').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_feature_requests_status').on(table.status, table.createdAt.desc()),
    index('idx_feature_requests_tenant').on(table.tenantId),
  ],
);

export const featureRequestsRelations = relations(featureRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [featureRequests.tenantId],
    references: [tenants.id],
  }),
  submitter: one(users, {
    fields: [featureRequests.submittedByUser],
    references: [users.id],
  }),
}));

export type FeatureRequest = InferSelectModel<typeof featureRequests>;
export type NewFeatureRequest = InferInsertModel<typeof featureRequests>;
