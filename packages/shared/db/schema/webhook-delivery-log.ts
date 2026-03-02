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
import { tenants } from './tenants';
import { webhookEndpoints } from './webhook-endpoints';

export const webhookDeliveryLog = pgTable(
  'webhook_delivery_log',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    webhookEndpointId: uuid('webhook_endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    event: varchar('event', { length: 64 }).notNull(),
    deliveryId: uuid('delivery_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    statusCode: integer('status_code'),
    durationMs: integer('duration_ms'),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    retryCount: integer('retry_count').default(0).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('webhook_delivery_log_endpoint_created_idx').on(
      table.tenantId,
      table.webhookEndpointId,
      table.createdAt.desc(),
    ),
    index('webhook_delivery_log_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const webhookDeliveryLogRelations = relations(webhookDeliveryLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [webhookDeliveryLog.tenantId],
    references: [tenants.id],
  }),
  webhookEndpoint: one(webhookEndpoints, {
    fields: [webhookDeliveryLog.webhookEndpointId],
    references: [webhookEndpoints.id],
  }),
}));

export type WebhookDeliveryLog = InferSelectModel<typeof webhookDeliveryLog>;
export type NewWebhookDeliveryLog = InferInsertModel<typeof webhookDeliveryLog>;
