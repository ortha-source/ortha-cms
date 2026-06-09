import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Tenancy boundary. First-class even though v1 seeds exactly one
 * workspace — keeping it a table now avoids a painful migration later.
 */
export const workspaces = pgTable('workspaces', {
    /** Primary key. */
    id: uuid('id').primaryKey().defaultRandom(),
    /** Human-readable workspace name. */
    name: text('name').notNull(),
    /** URL-safe identifier. Unique across the system. */
    slug: text('slug').notNull().unique(),
    /** Optional short summary of what the workspace holds. */
    description: text('description'),
    /** Row creation timestamp. */
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    /** Last-modified timestamp; refreshed on every update. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date())
});
