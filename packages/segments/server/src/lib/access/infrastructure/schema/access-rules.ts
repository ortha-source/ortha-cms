import {
    index,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** @see ACCESS_FALLBACK in `@orthacms/segments-domain` */
export const accessFallback = pgEnum('access_fallback', [
    'hidden',
    'teaser',
    'paywall'
]);

/** Which level an assignment attaches a rule to. @see ACCESS_LEVEL */
export const accessTargetKind = pgEnum('access_target_kind', [
    'workspace',
    'type',
    'entry'
]);

/**
 * A reusable rule — exclusions, condition groups, a window, and what a reader
 * who matched no group is served.
 *
 * `exclusions` and `groups` are `jsonb` holding the kernel's own shapes
 * (`Exclusions` / `AuthoredConditionGroup[]`) rather than normalised tables.
 * They are read and written whole, always by the rule that owns them, and
 * exploding a disjunctive normal form across three join tables would buy
 * nothing but the ability to query for "rules mentioning segment X" — which the
 * usage counter answers from the projection instead.
 */
export const accessRules = pgTable(
    'access_rules',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * The workspace this rule belongs to, or null for an installation-wide
         * one. A global rule is usable from every workspace that subscribes to
         * it; a workspace rule is private to its own.
         */
        workspaceId: uuid('workspace_id'),
        /** Stable key, used in the API and in exports. */
        key: text('key').notNull(),
        /** Human-readable name. */
        label: text('label').notNull(),
        /** Segment type key → segment ids that never see the content. */
        exclusions: jsonb('exclusions')
            .notNull()
            .default(sql`'{}'::jsonb`),
        /** OR-ed condition groups. Empty means this rule adds no condition. */
        groups: jsonb('groups')
            .notNull()
            .default(sql`'[]'::jsonb`),
        /** Start of the visibility window; null = no lower bound. */
        startsAt: timestamp('starts_at', { withTimezone: true }),
        /** End of the visibility window; null = no upper bound. */
        endsAt: timestamp('ends_at', { withTimezone: true }),
        /** What a reader who matched no group gets. */
        fallback: accessFallback('fallback').notNull().default('teaser'),
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
        // A key is unique per workspace, and separately unique among the global
        // rules. Two partial indexes rather than one over `COALESCE(workspace_id,
        // '…')`, so the null case is expressed rather than encoded in a
        // sentinel uuid nobody can read.
        uniqueIndex('access_rules_workspace_key_unique')
            .on(table.workspaceId, table.key)
            .where(sql`${table.workspaceId} IS NOT NULL`),
        uniqueIndex('access_rules_global_key_unique')
            .on(table.key)
            .where(sql`${table.workspaceId} IS NULL`),
        index('access_rules_workspace_idx').on(table.workspaceId)
    ]
);
