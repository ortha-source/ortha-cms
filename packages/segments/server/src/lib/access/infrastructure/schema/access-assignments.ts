import {
    index,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accessRules, accessTargetKind } from './access-rules';
import { segments } from './segments';

/**
 * Where a rule applies — the content side of the two ways access is declared.
 *
 * One assignment per target, so re-assigning replaces rather than accumulates.
 * `target_slug` names a content type, `target_entry_id` one entry; both are
 * plain values rather than foreign keys, because content tables are generated
 * per type and live in the host's schema, not this plugin's.
 */
export const accessAssignments = pgTable(
    'access_assignments',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The rule being applied. */
        ruleId: uuid('rule_id')
            .notNull()
            .references(() => accessRules.id, { onDelete: 'cascade' }),
        /** The workspace the assignment is scoped to. */
        workspaceId: uuid('workspace_id').notNull(),
        /** Which level this attaches to. */
        targetKind: accessTargetKind('target_kind').notNull(),
        /** Content type slug, for `type` and `entry` targets. */
        targetSlug: text('target_slug'),
        /** Entry id, for an `entry` target. */
        targetEntryId: uuid('target_entry_id'),
        /** Who assigned it. Null for a migration or a system write. */
        createdBy: uuid('created_by'),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // One rule per target, per level. Three partial indexes rather than one
        // over nullable columns, because in Postgres a null never equals a null
        // — a single unique index across the three target columns would let the
        // same workspace-level assignment be inserted any number of times.
        uniqueIndex('access_assignments_workspace_unique')
            .on(table.workspaceId)
            .where(sql`${table.targetKind} = 'workspace'`),
        uniqueIndex('access_assignments_type_unique')
            .on(table.workspaceId, table.targetSlug)
            .where(sql`${table.targetKind} = 'type'`),
        uniqueIndex('access_assignments_entry_unique')
            .on(table.workspaceId, table.targetEntryId)
            .where(sql`${table.targetKind} = 'entry'`),
        index('access_assignments_rule_idx').on(table.ruleId)
    ]
);

/**
 * The segment side of the same declaration: what this segment may reach.
 *
 * A grant carries **only** the `only` mode. "Everyone except Globex" through
 * grants would mean issuing 399 of them out of 400 — storing the complement
 * instead of the exclusion, which is the one thing the projection invariant
 * forbids. Exclusions therefore live on the content side, in a rule.
 */
export const segmentGrants = pgTable(
    'segment_grants',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The segment being granted access. */
        segmentId: uuid('segment_id')
            .notNull()
            .references(() => segments.id, { onDelete: 'cascade' }),
        /** The workspace the grant reaches into. */
        workspaceId: uuid('workspace_id').notNull(),
        /** Which level this grants. */
        targetKind: accessTargetKind('target_kind').notNull(),
        /** Content type slug, for `type` and `entry` targets. */
        targetSlug: text('target_slug'),
        /** Entry id, for an `entry` target. */
        targetEntryId: uuid('target_entry_id'),
        /** When the grant lapses; null = open-ended. */
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        /** Who issued it. */
        createdBy: uuid('created_by'),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        uniqueIndex('segment_grants_workspace_unique')
            .on(table.segmentId, table.workspaceId)
            .where(sql`${table.targetKind} = 'workspace'`),
        uniqueIndex('segment_grants_type_unique')
            .on(table.segmentId, table.workspaceId, table.targetSlug)
            .where(sql`${table.targetKind} = 'type'`),
        uniqueIndex('segment_grants_entry_unique')
            .on(table.segmentId, table.workspaceId, table.targetEntryId)
            .where(sql`${table.targetKind} = 'entry'`),
        index('segment_grants_segment_idx').on(table.segmentId),
        index('segment_grants_workspace_idx').on(table.workspaceId)
    ]
);
