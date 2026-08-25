import {
    index,
    integer,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accessFallback } from './access-rules';

/**
 * The **projection** — one row per condition group of one entry's resolved
 * rule, and the only table the read path touches.
 *
 * Three decisions are worth knowing before changing anything here.
 *
 * **A row is a group, not an entry.** An entry whose rule has two OR-ed groups
 * has two rows, and it is visible if **any** of them admits the reader. An entry
 * with one group — the common case — has one row, so the semi-join degenerates
 * to a primary-key lookup and the cost of the disjunction is paid only where it
 * was actually asked for.
 *
 * **No rows means unrestricted.** That is what every entry starts life with, and
 * reading absence as a closed door would black out an installation the moment
 * the plugin is enabled. The projector deletes an entry's rows when its resolved
 * rule restricts nothing, so an open entry costs one index probe that finds
 * nothing rather than a row full of empty arrays.
 *
 * **Slots, not columns per type.** `allow_d1…allow_d8` are generic pairs a
 * segment type claims (`segment_types.slot`). Creating a type in the admin then
 * needs no DDL, while the schema stays reproducible from a checkout — the
 * alternative, `ALTER TABLE` at runtime, would put the app's schema outside the
 * migrations that define it. Running out is one migration adding the next batch;
 * `MAX_SEGMENT_TYPES` in `@orthacms/segments-domain` is the number to keep in
 * step.
 *
 * The GIN indexes on all sixteen columns are cheap while a slot is unused —
 * `array_ops` produces no index entries for an empty array — but they are not
 * free on write, so the count of slots is a number to revisit against a
 * benchmark rather than to raise on instinct.
 */
export const entryAccess = pgTable(
    'entry_access',
    {
        /** The entry this row constrains. */
        entryId: uuid('entry_id').notNull(),
        /** Index of the condition group within the entry's resolved rule. */
        groupNo: integer('group_no').notNull(),
        /** The workspace the entry belongs to. */
        workspaceId: uuid('workspace_id').notNull(),
        /** The entry's content type slug, for bulk re-projection. */
        typeSlug: text('type_slug').notNull(),

        /** Slot 1 — segments admitted by this group. Empty = unconstrained. */
        allowD1: uuid('allow_d1')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 1 — segments refused, exclusions included. */
        denyD1: uuid('deny_d1')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 2 — admitted. */
        allowD2: uuid('allow_d2')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 2 — refused. */
        denyD2: uuid('deny_d2')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 3 — admitted. */
        allowD3: uuid('allow_d3')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 3 — refused. */
        denyD3: uuid('deny_d3')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 4 — admitted. */
        allowD4: uuid('allow_d4')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 4 — refused. */
        denyD4: uuid('deny_d4')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 5 — admitted. */
        allowD5: uuid('allow_d5')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 5 — refused. */
        denyD5: uuid('deny_d5')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 6 — admitted. */
        allowD6: uuid('allow_d6')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 6 — refused. */
        denyD6: uuid('deny_d6')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 7 — admitted. */
        allowD7: uuid('allow_d7')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 7 — refused. */
        denyD7: uuid('deny_d7')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 8 — admitted. */
        allowD8: uuid('allow_d8')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),
        /** Slot 8 — refused. */
        denyD8: uuid('deny_d8')
            .array()
            .notNull()
            .default(sql`'{}'::uuid[]`),

        /** Start of the visibility window; null = no lower bound. */
        accessFrom: timestamp('access_from', { withTimezone: true }),
        /** End of the visibility window; null = no upper bound. */
        accessTo: timestamp('access_to', { withTimezone: true }),
        /** The rule this row was projected from, for explanation and re-projection. */
        ruleId: uuid('rule_id'),
        /** What a reader refused by every group is served. */
        fallback: accessFallback('fallback').notNull().default('teaser'),
        /** When this row was last projected. */
        projectedAt: timestamp('projected_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        primaryKey({ columns: [table.entryId, table.groupNo] }),
        // Covers "re-project everything of this type in this workspace", which
        // is what a rule or assignment change triggers.
        index('entry_access_workspace_type_idx').on(
            table.workspaceId,
            table.typeSlug
        ),
        index('entry_access_rule_idx').on(table.ruleId),
        index('entry_access_allow_d1_idx').using('gin', table.allowD1),
        index('entry_access_deny_d1_idx').using('gin', table.denyD1),
        index('entry_access_allow_d2_idx').using('gin', table.allowD2),
        index('entry_access_deny_d2_idx').using('gin', table.denyD2),
        index('entry_access_allow_d3_idx').using('gin', table.allowD3),
        index('entry_access_deny_d3_idx').using('gin', table.denyD3),
        index('entry_access_allow_d4_idx').using('gin', table.allowD4),
        index('entry_access_deny_d4_idx').using('gin', table.denyD4),
        index('entry_access_allow_d5_idx').using('gin', table.allowD5),
        index('entry_access_deny_d5_idx').using('gin', table.denyD5),
        index('entry_access_allow_d6_idx').using('gin', table.allowD6),
        index('entry_access_deny_d6_idx').using('gin', table.denyD6),
        index('entry_access_allow_d7_idx').using('gin', table.allowD7),
        index('entry_access_deny_d7_idx').using('gin', table.denyD7),
        index('entry_access_allow_d8_idx').using('gin', table.allowD8),
        index('entry_access_deny_d8_idx').using('gin', table.denyD8)
    ]
);

/** Column names for one slot, as the predicate compiler addresses them. */
export function slotColumnNames(slot: number): {
    allow: string;
    deny: string;
} {
    return { allow: `allow_d${slot}`, deny: `deny_d${slot}` };
}
