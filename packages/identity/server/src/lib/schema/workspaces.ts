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
    /** Optional short summary of what the workspace holds. */
    description: text('description'),
    /**
     * Accent color key tinting the workspace avatar in the admin. One of the
     * design-system `AVATAR_COLORS` (`slate`/`green`/`amber`/`violet`/`rose`/
     * `teal`/`indigo`); stored as plain text since the server can't depend on
     * the admin palette. Defaults to `slate` until a create flow lets the user
     * pick.
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
