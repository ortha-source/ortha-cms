import {
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** @see SEGMENT_CARDINALITY in `@orthacms/segments-domain` */
export const segmentCardinality = pgEnum('segment_cardinality', [
    'low',
    'high'
]);

/** @see SEGMENT_TYPE_STATE */
export const segmentTypeState = pgEnum('segment_type_state', [
    'active',
    'draining',
    'free'
]);

/** @see SEGMENT_TYPE_MANAGED_BY */
export const segmentTypeManagedBy = pgEnum('segment_type_managed_by', [
    'config',
    'ui'
]);

/**
 * One axis of the access decision, and one tag namespace.
 *
 * `slot` is the pair of projection columns this type reads and writes
 * (`allow_d<slot>` / `deny_d<slot>` on `entry_access`). Slots are pre-created by
 * migration rather than by runtime DDL, which is what lets a type be created in
 * the admin while the schema stays reproducible from a checkout — see the
 * package `AGENTS.md`.
 */
export const segmentTypes = pgTable(
    'segment_types',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** Tag namespace this type owns, e.g. `org` for `org:acme`. Unique. */
        key: text('key').notNull().unique(),
        /** Human-readable name, shown in the editor. */
        label: text('label').notNull(),
        /** Rendering hint: matrix columns, or a searchable picker. */
        cardinality: segmentCardinality('cardinality').notNull().default('low'),
        /** Which projection slot pair this type owns. */
        slot: integer('slot').notNull(),
        /** @see SEGMENT_TYPE_STATE — only `active` types reach the predicate. */
        state: segmentTypeState('state').notNull().default('active'),
        /** Config-declared types are read-only in the admin. */
        managedBy: segmentTypeManagedBy('managed_by').notNull().default('ui'),
        /**
         * Where this type's segments come from — `{ kind, … }`, mirroring
         * `SEGMENT_SOURCE_KIND`. Interpreted by the catalog, never by the
         * kernel.
         */
        source: jsonb('source')
            .notNull()
            .default(sql`'{"kind":"manual"}'::jsonb`),
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
        // A slot may be claimed by at most one type that is not free. A
        // `draining` type still holds its slot: its columns carry ids nobody
        // may match against any more, and handing the slot to a new type before
        // they are zeroed is how that type would silently inherit them.
        uniqueIndex('segment_types_slot_unique')
            .on(table.slot)
            .where(sql`${table.state} <> 'free'`)
    ]
);
