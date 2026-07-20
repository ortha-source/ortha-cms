import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Colour theme the admin renders in. `system` follows the OS/browser
 * `prefers-color-scheme` at runtime; `light`/`dark` pin it.
 */
export const themePreference = pgEnum('theme_preference', [
    'light',
    'dark',
    'system'
]);

/**
 * Per-user appearance preferences — the durable, cross-device home for the
 * choice made on the account **Preferences** tab. One row per user (the
 * `userId` is the primary key), created lazily the first time a user saves a
 * preference; until then the app renders the column default below.
 *
 * Owned by identity because it hangs directly off the `users` aggregate and
 * shares its migration lifecycle; the row is cascaded away with the user.
 */
export const userPreferences = pgTable('user_preferences', {
    /** Owner — also the primary key, so a user has at most one row. */
    userId: uuid('user_id')
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    /** Colour theme (`light` / `dark` / `system`). */
    theme: themePreference('theme').notNull().default('system'),
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
