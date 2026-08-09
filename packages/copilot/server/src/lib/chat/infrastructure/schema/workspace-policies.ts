import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './external-refs';

/**
 * A workspace's copilot policy — the opt-ins an admin makes per workspace
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §6).
 *
 * **Absence is the default, and the default is "propose everything".** A
 * workspace with no row here behaves exactly as one with an empty
 * `auto_apply_tools`, so enabling the copilot never silently enables direct
 * writes — the row exists only once someone deliberately opts a tool in.
 *
 * `auto_apply_tools` is a list of **tool names**, never a wildcard. §6's example
 * is a team that trusts alt-text generation and should not click twice a hundred
 * times a day; that is a per-tool judgement, and an `all` switch would turn one
 * such judgement into blanket write access the next time a tool is added.
 */
export const copilotWorkspacePolicies = pgTable('copilot_workspace_policies', {
    /** The workspace the policy belongs to — one row per workspace at most. */
    workspaceId: uuid('workspace_id')
        .primaryKey()
        .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Tool names allowed to write directly instead of producing a proposal. */
    autoApplyTools: jsonb('auto_apply_tools')
        .notNull()
        .$type<string[]>()
        .default([]),
    /** Who last changed the policy, and when. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
});
