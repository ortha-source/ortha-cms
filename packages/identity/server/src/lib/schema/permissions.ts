import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Catalog of `resource:action` permissions. Reference data (not seeded
 * yet); roles attach to these rows via `role_permissions`.
 */
export const permissions = pgTable('permissions', {
    /** Primary key. */
    id: uuid('id').primaryKey().defaultRandom(),
    /** `resource:action` key, e.g. 'content:publish'. Unique. */
    key: text('key').notNull().unique(),
    /** Optional human-readable description. */
    description: text('description'),
    /** Row creation timestamp. */
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow()
});
