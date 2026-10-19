import { jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
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
 * One resizable panel's remembered layout: its width in CSS pixels and, for a
 * panel that can collapse, whether it is collapsed. Either may be absent — a
 * panel that has never been resized has no width, one that cannot collapse
 * never records `collapsed`.
 */
export interface PanelLayoutEntry {
    /** Width in CSS pixels. */
    width?: number;
    /** Whether a collapsible panel is collapsed. */
    collapsed?: boolean;
}

/**
 * The admin's resizable panels, keyed by a panel id the admin owns
 * (`shell.sidebar`, `copilot.agentsRail`, …). An open map rather than a column
 * per panel, so a plugin can add a panel without a migration here — identity
 * stores the shape and bounds it, and knows nothing about which panels exist.
 */
export type PanelLayout = Record<string, PanelLayoutEntry>;

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
    /**
     * Widths and collapsed states of the admin's resizable panels. Written
     * per panel — a save merges its entries over the stored map
     * (`layout || patch`), so two tabs resizing different panels never undo
     * each other. See `PreferencesService.save`.
     */
    layout: jsonb('layout').$type<PanelLayout>().notNull().default({}),
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
