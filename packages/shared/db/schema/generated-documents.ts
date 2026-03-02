import {
  boolean,
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
import { documentTemplates } from './document-templates';
import { users } from './users';

export const generatedDocuments = pgTable(
  'generated_documents',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    templateId: uuid('template_id')
      .notNull()
      .references(() => documentTemplates.id),
    sourceRecordId: uuid('source_record_id').notNull(),
    fileUrl: varchar('file_url', { length: 2048 }).notNull(),
    fileType: varchar('file_type', { length: 20 }).default('pdf').notNull(),
    generatedBy: uuid('generated_by').references(() => users.id),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    automationRunId: uuid('automation_run_id'),
    aiDrafted: boolean('ai_drafted').default(false).notNull(),
  },
  (table) => [
    index('generated_documents_tenant_template_idx').on(table.tenantId, table.templateId),
    index('generated_documents_tenant_record_idx').on(table.tenantId, table.sourceRecordId),
  ],
);

export const generatedDocumentsRelations = relations(generatedDocuments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [generatedDocuments.tenantId],
    references: [tenants.id],
  }),
  template: one(documentTemplates, {
    fields: [generatedDocuments.templateId],
    references: [documentTemplates.id],
  }),
  generator: one(users, {
    fields: [generatedDocuments.generatedBy],
    references: [users.id],
  }),
}));

export type GeneratedDocument = InferSelectModel<typeof generatedDocuments>;
export type NewGeneratedDocument = InferInsertModel<typeof generatedDocuments>;
