import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * One row per **restricted** entry — the two lists an editor set, stored as
 * they were set.
 *
 * Three decisions are worth knowing before changing anything here.
 *
 * **One row per entry, not one per decision.** The read asks a single question
 * of a single row, so the predicate is a primary-key probe and two array
 * intersections rather than a join. An entry's whole answer arrives together,
 * which is also what makes a write a plain upsert of what the editor submitted.
 *
 * **No rows means unrestricted.** That is what every entry starts as, and
 * reading absence as a closed door would black out an installation the moment
 * the plugin is enabled. The writer deletes the row when both lists come back
 * empty, so an open entry costs an index probe that finds nothing rather than a
 * row of empty arrays. `COALESCE(…, true)` in the predicate is the other half.
 *
 * **The workspace and the type slug are carried, not joined for.** Neither is
 * needed by the read — the entry id is unique on its own — but both are what
 * lets the admin ask "what is restricted in this collection" without touching
 * every content table, and what a cleanup pass keys on.
 */
export const entryAccess = pgTable(
    'entry_access',
    {
        /** The entry these lists govern. One row per entry. */
        entryId: uuid('entry_id').primaryKey(),
        /** The workspace the entry belongs to. */
        workspaceId: uuid('workspace_id').notNull(),
        /** The entry's content type slug. */
        typeSlug: text('type_slug').notNull(),
        /** Segments that may read it. **Empty means everyone.** */
        allow: uuid('allow')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Segments that may not, whatever `allow` says. */
        deny: uuid('deny')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // GIN on both lists: the predicate's `&&` is an array intersection, and
        // these are what keep it from degrading to a scan once a workspace has
        // restricted a lot of entries.
        index('entry_access_allow_idx').using('gin', table.allow),
        index('entry_access_deny_idx').using('gin', table.deny),
        // What the admin's "restricted in this collection" list reads.
        index('entry_access_scope_idx').on(table.workspaceId, table.typeSlug)
    ]
);
