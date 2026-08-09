import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { copilotConversations } from './conversations';
import { users, workspaces } from './external-refs';

/**
 * **The accept boundary** — one row per change the copilot proposed
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §5).
 *
 * Every mutating tool writes here first and a human decides; a workspace that
 * opted a tool into auto-apply still gets the row, accepted in the same breath.
 * That is what makes a direct apply "undoable, never invisible" rather than a
 * write with no paper trail — the row records what was proposed, by which run,
 * on whose behalf, and who decided.
 *
 * `target` and `patch` are opaque jsonb on purpose: their shape belongs to the
 * applier that declared the `kind`, and teaching this table about content
 * entries would make the copilot the thing that changes when content does.
 */
export const copilotProposals = pgTable(
    'copilot_proposals',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The thread the proposal was made in. */
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => copilotConversations.id, { onDelete: 'cascade' }),
        /** The run that produced it — provenance on the eventual effect. */
        runId: uuid('run_id').notNull(),
        /**
         * The provider-assigned tool-call id, so a proposal joins to its row in
         * `copilot_tool_calls` and the UI can attach the card to the step that
         * produced it.
         */
        toolCallId: text('tool_call_id').notNull(),
        /**
         * The tool that proposed it. Load-bearing rather than descriptive:
         * accepting re-resolves the capability profile and requires this tool to
         * still be offered to the accepting user, so "you may accept what you
         * could have proposed" needs no second permission model.
         */
        toolName: text('tool_name').notNull(),
        /** Which applier carries it out, e.g. `content.entry.update`. */
        kind: text('kind').notNull(),
        /** The workspace it belongs to. */
        workspaceId: uuid('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        /** The user the run acted as — never a copilot identity. */
        createdBy: uuid('created_by')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** Where the change lands; shape owned by the applier. */
        target: jsonb('target').notNull(),
        /** The change itself; shape owned by the applier's use-case. */
        patch: jsonb('patch').notNull(),
        /** One line naming the change — the card's title. */
        summary: text('summary').notNull(),
        /** Per-field before/after for the review diff, when field-shaped. */
        changes: jsonb('changes'),
        /** `pending` | `accepted` | `rejected`. */
        status: text('status').notNull().default('pending'),
        /** Who decided. Null while pending. */
        decidedBy: uuid('decided_by').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** When they decided. Null while pending. */
        decidedAt: timestamp('decided_at', { withTimezone: true }),
        /** What the applier reported — the entity id and any detail. */
        result: jsonb('result'),
        /**
         * Why the last accept failed, when one did. The proposal stays
         * `pending`, so a transient failure is retryable and a permanent one is
         * legible — rather than stranding the row in a fourth state nobody
         * clears.
         */
        error: text('error'),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // "What is waiting for me in this workspace?" — the review queue.
        index('copilot_proposals_workspace_idx').on(
            table.workspaceId,
            table.status,
            table.createdAt
        ),
        // "What did this run propose?" — the transcript's card lookup.
        index('copilot_proposals_run_idx').on(table.runId)
    ]
);
