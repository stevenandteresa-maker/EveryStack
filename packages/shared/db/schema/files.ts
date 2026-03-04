import {
  bigint,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations, sql } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { users } from './users';

/**
 * File metadata table — tracks all uploaded files across the platform.
 *
 * Every file goes through: presign → client upload → completion verification.
 * The `scan_status` column drives the processing pipeline (scan, thumbnail).
 * Storage objects live in R2/S3 under tenant-isolated keys.
 *
 * context_type values: record_attachment, smart_doc, doc_gen_output,
 * portal_asset, email_attachment, chat_attachment, template
 */
export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
    storageKey: varchar('storage_key', { length: 1024 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 127 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    checksumSha256: varchar('checksum_sha256', { length: 64 }),
    // Values: pending, clean, infected, skipped
    scanStatus: varchar('scan_status', { length: 20 }).default('pending').notNull(),
    // Values: record_attachment, smart_doc, doc_gen_output, portal_asset, email_attachment, chat_attachment, template
    contextType: varchar('context_type', { length: 50 }).notNull(),
    contextId: uuid('context_id'),
    thumbnailKey: varchar('thumbnail_key', { length: 1024 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    index('files_tenant_context_idx').on(table.tenantId, table.contextType, table.contextId),
    index('files_tenant_scan_status_idx').on(table.tenantId, table.scanStatus),
    index('files_archived_at_idx').on(table.archivedAt).where(sql`${table.archivedAt} IS NOT NULL`),
  ],
);

export const filesRelations = relations(files, ({ one }) => ({
  tenant: one(tenants, { fields: [files.tenantId], references: [tenants.id] }),
  uploader: one(users, { fields: [files.uploadedBy], references: [users.id] }),
}));

export type FileRecord = InferSelectModel<typeof files>;
export type NewFileRecord = InferInsertModel<typeof files>;
