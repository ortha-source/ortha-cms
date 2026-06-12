import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Lifecycle state of a workspace. New workspaces start `active`. */
export const workspaceStatus = pgEnum('workspace_status', [
    'active',
    'archived'
]);

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
    /** Optional long description; empty string when omitted. */
    description: text('description').notNull().default(''),
    /**
     * Accent color key for the workspace monogram. A free-form text rather than
     * an enum so the design-system's `AvatarColor` palette can grow without a
     * migration; the admin is the source of truth for valid values.
     */
    color: text('color').notNull().default('slate'),
    /** Lifecycle state. */
    status: workspaceStatus('status').notNull().default('active'),
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
