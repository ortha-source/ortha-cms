import {
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { segmentTypes } from './segment-types';

/** @see SEGMENT_KIND in `@orthacms/segments-domain` */
export const segmentKind = pgEnum('segment_kind', ['set', 'mask']);

/**
 * A named set of reader tags inside one segment type.
 *
 * Rules and grants point at a segment's **id**, never at a tag. That
 * indirection is what makes a plan renamed in the billing system a one-row edit
 * instead of a rewrite of every rule and every projected row.
 */
export const segments = pgTable(
    'segments',
    {
        /** Primary key — what a rule, a grant and a projected row store. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The type this segment belongs to. */
        typeId: uuid('type_id')
            .notNull()
            .references(() => segmentTypes.id, { onDelete: 'cascade' }),
        /** Key within the type, e.g. `acme` (the tag is `org:acme`). */
        key: text('key').notNull(),
        /** Human-readable name. */
        label: text('label').notNull(),
        /**
         * `mask` matches any tag in the type's namespace; `set` matches its own
         * {@link tags}. Every type gets exactly one mask, which is what keeps
         * "all except three" a deny of three.
         */
        kind: segmentKind('kind').notNull().default('set'),
        /** Tags a `set` segment matches — any one of them is enough. */
        tags: text('tags')
            .array()
            .notNull()
            .default(sql`'{}'::text[]`),
        /**
         * The record this segment mirrors, for a type sourced from a content
         * collection or an external directory. Null for a hand-maintained one.
         * Not a foreign key: the source may live in another plugin's schema, or
         * outside the database entirely.
         */
        externalRef: text('external_ref'),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Last modification timestamp. */
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        unique('segments_type_key_unique').on(table.typeId, table.key),
        index('segments_type_id_idx').on(table.typeId)
    ]
);
