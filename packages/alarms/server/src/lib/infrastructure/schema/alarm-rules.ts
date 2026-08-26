import {
    boolean,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';

/**
 * A content rule the workspace watches for.
 *
 * `filter` is a **records-list filter tree** — the exact JSON the admin's
 * query builder puts in `?filter=`, stored verbatim. That is the whole design:
 * a rule is not a second query language, it is a saved list filter, so what a
 * rule matches and what the list showed when it was saved cannot drift.
 *
 * Two columns are worth explaining:
 *
 * - **`brokenReason`** is set when the stored tree stops parsing against its
 *   type — a field renamed out from under it, a relation removed. A rule in
 *   that state is skipped by the evaluator and surfaced in the UI as needing
 *   attention. Silently never matching is the worst thing a rule can do: it
 *   looks exactly like "everything is fine".
 * - **`createdBy`** is a uuid with **no FK**, like `activity_events.actorId` —
 *   the author may be deleted and the rule must outlive them.
 *
 * `workspaceId` carries no FK either: the `workspaces` table is identity-owned
 * and cross-plugin foreign keys are not how this codebase scopes rows.
 */
export const alarmRules = pgTable(
    'alarm_rules',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        workspaceId: uuid('workspace_id').notNull(),
        contentType: text('content_type').notNull(),
        name: text('name').notNull(),
        /** What a finding of this rule says to the editor who hits it. */
        findingTitle: text('finding_title').notNull(),
        description: text('description'),
        severity: text('severity').notNull(),
        filter: jsonb('filter').notNull(),
        enabled: boolean('enabled').notNull().default(true),
        /** Why the stored filter no longer parses; null while it is fine. */
        brokenReason: text('broken_reason'),
        /** When the last full rescan of this rule finished. */
        lastScanAt: timestamp('last_scan_at', { withTimezone: true }),
        createdBy: uuid('created_by'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // A workspace's rule names are its vocabulary; two rules called
        // "Missing cover" would make every finding ambiguous in the UI.
        uniqueIndex('alarm_rules_workspace_name_idx').on(
            table.workspaceId,
            table.name
        ),
        // The evaluator's hot path: "every enabled rule of this type in this
        // workspace", run once per entry write.
        index('alarm_rules_workspace_type_idx').on(
            table.workspaceId,
            table.contentType,
            table.enabled
        )
    ]
);
