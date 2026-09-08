import {
    boolean,
    check,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    unique,
    uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The rule on one `(workspace, content type)` pair — whether publishing an
 * entry of that type needs approvals, and how many.
 *
 * Addressed exactly the way `workspace_content` addresses a grant, and for the
 * same reason: a rule is about a type the workspace was given, so the two are
 * the same coordinate. There is no condition column and no per-entry
 * exception — "why is this entry blocked and its neighbour not" must answer in
 * one word, and the word is the type.
 *
 * Two columns are worth explaining:
 *
 * - **`kind`** is `text` with a check constraint, **not** the `content_kind`
 *   enum. That enum belongs to `workspaces`' schema, and importing another
 *   plugin's schema object to share a type is a dependency this package should
 *   not take — the check constraint carries the same two values without it.
 * - **`updatedBy`** is a uuid with **no FK**: the administrator who last
 *   changed the rule may be deleted, and the rule must outlive them. The audit
 *   row names the actor too; this column is for the settings screen, which
 *   shows who last touched the rule without joining to an event log.
 *
 * `workspaceId` carries no FK either — `workspaces` belongs to
 * `workspaces-server`, and cross-plugin foreign keys are not how this codebase
 * scopes rows. `ProtectionWorkspacePurger` is what removes these instead.
 */
export const protectionRules = pgTable(
    'protection_rules',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        workspaceId: uuid('workspace_id').notNull(),
        /** `collection` or `single` — see the check constraint below. */
        kind: text('kind').notNull(),
        /** The code-defined content type name. */
        slug: text('slug').notNull(),
        /**
         * Off means the type behaves exactly as it does with no row at all.
         * The row is kept so the settings screen remembers the numbers a
         * workspace had chosen before it switched the rule off.
         */
        enabled: boolean('enabled').notNull().default(false),
        /** How many approvals on the head revision unlock publication. */
        requiredApprovals: integer('required_approvals').notNull().default(1),
        /** The four-eyes switch: the head revision's author cannot approve it. */
        requireOtherPerson: boolean('require_other_person')
            .notNull()
            .default(true),
        /** Whether approvals on earlier revisions still count. Not recommended. */
        countStaleApprovals: boolean('count_stale_approvals')
            .notNull()
            .default(false),
        /** Whether an administrator may publish past the rule, with a reason. */
        adminBypass: boolean('admin_bypass').notNull().default(true),
        /** Whether a bearer token may publish this type at all. */
        allowTokenPublish: boolean('allow_token_publish')
            .notNull()
            .default(false),
        /** Who last changed the rule. No FK — the rule outlives the author. */
        updatedBy: uuid('updated_by'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // The same shape `workspace_content` uses, and the reason the upsert
        // needs no read-then-write: one rule per type per workspace, enforced
        // by the database rather than by a count inside a transaction.
        unique('protection_rules_workspace_type_unique').on(
            table.workspaceId,
            table.kind,
            table.slug
        ),
        // "Every rule in this workspace" — the settings tab's only query.
        index('protection_rules_workspace_idx').on(table.workspaceId),
        // What the `content_kind` enum would have given us, without taking a
        // dependency on the package that owns it.
        check(
            'protection_rules_kind_check',
            sql`${table.kind} in ('collection', 'single')`
        ),
        // A rule that asks for nothing is a rule that protects nothing, and it
        // would be indistinguishable in the interface from one that works.
        // The API refuses it too; this is the floor under a direct SQL write.
        check(
            'protection_rules_required_approvals_check',
            sql`${table.requiredApprovals} >= 1`
        )
    ]
);
