import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The audiences an installation divides its readers into.
 *
 * Installation-wide rather than per-workspace, like a content type: "Acme Corp"
 * is the same customer whichever workspace's content they are reading, and one
 * copy per workspace would mean renaming them in each.
 */
export const segments = pgTable(
    'segments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Url-safe key, unique in the installation. */
        key: text('key').notNull().unique(),
        /** Human-readable name, shown in the entry editor. */
        label: text('label').notNull(),
        /**
         * Reader tags this segment answers to — any one is enough.
         *
         * A list rather than one value, because the same audience arrives under
         * more than one identifier more often than not: a legacy plan code, a
         * new one, and the id the billing system uses. Editing this row is what
         * keeps every entry that named the segment working when one of them
         * changes.
         */
        tags: text('tags')
            .array()
            .notNull()
            .default(sql`'{}'::text[]`),
        /**
         * The workspaces this audience is offered in. **Empty means every one.**
         *
         * The same reading as an entry's empty allow list, and for the same
         * reason: it is the state every existing row is already in, and taking
         * emptiness for "nowhere" would make an audience nobody had scoped yet
         * vanish from every editor the day the column shipped.
         *
         * Plain uuids, no foreign key — `workspaces` is identity-owned, and this
         * plugin holds no cross-plugin FK (the same rule `entry_access` follows
         * for `workspace_id`). A workspace deleted out from under a segment
         * leaves an id that matches nothing, which narrows the audience rather
         * than widening it.
         */
        workspaceIds: uuid('workspace_ids')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        index('segments_label_idx').on(table.label),
        // The directory and the entry editor both ask "which audiences apply
        // here?" on every open, and the answer is an array overlap.
        index('segments_workspaces_idx').using('gin', table.workspaceIds)
    ]
);
