import {
  index,
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
import { tenants } from './tenants';
import { users } from './users';

/**
 * Support requests submitted by tenant users or created manually by platform admin.
 * Not tenant-scoped via RLS — accessed cross-tenant from /admin route.
 *
 * category values: billing | bug | feature_request | account | other
 * status values: open | in_progress | waiting | resolved | closed
 * priority values: low | normal | high | urgent
 * source values: in_app | email | manual
 * resolved_by values: ai_auto | support_agent | platform_admin | user
 * tier values: standard | priority | enterprise
 */
export const supportRequests = pgTable(
  'support_requests',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    submittedByUser: uuid('submitted_by_user').references(() => users.id, { onDelete: 'set null' }),
    category: varchar('category', { length: 50 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    body: text('body').notNull(),
    status: varchar('status', { length: 20 }).default('open').notNull(),
    priority: varchar('priority', { length: 10 }).default('normal').notNull(),
    adminNotes: text('admin_notes'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNotes: text('resolution_notes'),
    source: varchar('source', { length: 20 }).default('in_app').notNull(),

    // Support System — urgency, AI session, assignment, resolution tracking
    urgencyScore: smallint('urgency_score').default(0).notNull(),
    aiSessionId: uuid('ai_session_id'),
    assignedTo: uuid('assigned_to').references(() => users.id),
    resolvedBy: varchar('resolved_by', { length: 20 }),
    tier: varchar('tier', { length: 20 }).default('standard').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_support_requests_tenant').on(table.tenantId),
    index('idx_support_requests_status').on(table.status, table.createdAt.desc()),
    index('idx_support_requests_priority').on(table.priority, table.status),
  ],
);

export const supportRequestsRelations = relations(supportRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [supportRequests.tenantId],
    references: [tenants.id],
  }),
  submitter: one(users, {
    fields: [supportRequests.submittedByUser],
    references: [users.id],
    relationName: 'supportRequestSubmitter',
  }),
  assignee: one(users, {
    fields: [supportRequests.assignedTo],
    references: [users.id],
    relationName: 'supportRequestAssignee',
  }),
}));

export type SupportRequest = InferSelectModel<typeof supportRequests>;
export type NewSupportRequest = InferInsertModel<typeof supportRequests>;
