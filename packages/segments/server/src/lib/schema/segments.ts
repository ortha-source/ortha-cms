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
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [index('segments_label_idx').on(table.label)]
);
