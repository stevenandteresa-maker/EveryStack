import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { forms } from './forms';

export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    recordId: uuid('record_id'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 512 }),
  },
  (table) => [
    index('form_submissions_tenant_form_idx').on(table.tenantId, table.formId),
    index('form_submissions_form_submitted_idx').on(table.formId, table.submittedAt),
  ],
);

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  form: one(forms, {
    fields: [formSubmissions.formId],
    references: [forms.id],
  }),
  tenant: one(tenants, {
    fields: [formSubmissions.tenantId],
    references: [tenants.id],
  }),
}));

export type FormSubmission = InferSelectModel<typeof formSubmissions>;
export type NewFormSubmission = InferInsertModel<typeof formSubmissions>;
