import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Global role definitions. A role is defined once for the whole system
 * (not per workspace). Permissions are not stored inline — they attach
 * via `role_permissions` (M:N).
 */
export const roles = pgTable('roles', {
    /** Primary key. */
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Stable machine key, e.g. 'admin'. Unique. Free-form text (not an
     * enum) so non-system roles can be added without an enum migration.
     */
    key: text('key').notNull().unique(),
    /** Human-readable label. */
    name: text('name').notNull(),
    /** Protects built-in roles from deletion. */
    isSystem: boolean('is_system').notNull().default(false),
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
