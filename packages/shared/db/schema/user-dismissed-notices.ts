import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { users } from './users';
import { platformNotices } from './platform-notices';

/**
 * Tracks which users have dismissed which platform notices.
 * UNIQUE(user_id, notice_id) prevents duplicate dismissals.
 */
export const userDismissedNotices = pgTable(
  'user_dismissed_notices',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    noticeId: uuid('notice_id')
      .notNull()
      .references(() => platformNotices.id, { onDelete: 'cascade' }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_dismissed_notices_user_notice_idx').on(table.userId, table.noticeId),
  ],
);

export const userDismissedNoticesRelations = relations(userDismissedNotices, ({ one }) => ({
  user: one(users, {
    fields: [userDismissedNotices.userId],
    references: [users.id],
  }),
  notice: one(platformNotices, {
    fields: [userDismissedNotices.noticeId],
    references: [platformNotices.id],
  }),
}));

export type UserDismissedNotice = InferSelectModel<typeof userDismissedNotices>;
export type NewUserDismissedNotice = InferInsertModel<typeof userDismissedNotices>;
