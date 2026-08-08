import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type { WorkspaceCopilotPolicy } from '@ortha-cms/copilot-domain';
import { copilotWorkspacePolicies } from '../infrastructure/schema/workspace-policies';

/** The policy a workspace with no stored row behaves as. */
const CLOSED: WorkspaceCopilotPolicy = { autoApplyTools: [] };

/**
 * Reads and writes a workspace's copilot policy.
 *
 * **Closed by default, and absence is not a special case.** A workspace with no
 * row reads as an empty `autoApplyTools`, so enabling the copilot never
 * silently enables direct writes and there is nothing to migrate for existing
 * workspaces ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §6).
 *
 * Not cached, for the same reason the capability profile isn't (§2): a policy
 * revoked mid-thread must take effect on the next tool call, not at the end of
 * the conversation. One indexed primary-key read per run is the cost the ADR
 * accepts.
 */
@Injectable()
export class CopilotPolicyService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** The workspace's policy, or the closed default. */
    async forWorkspace(workspaceId: string): Promise<WorkspaceCopilotPolicy> {
        const [row] = await this.db
            .select()
            .from(copilotWorkspacePolicies)
            .where(eq(copilotWorkspacePolicies.workspaceId, workspaceId))
            .limit(1);
        return row ? { autoApplyTools: row.autoApplyTools } : CLOSED;
    }

    /**
     * Replaces the workspace's auto-apply list.
     *
     * Upsert rather than insert-or-update in two round trips: the row is
     * identified by its workspace, and a policy edit racing another one should
     * end with one of the two lists, not a unique-violation 500.
     */
    async setAutoApplyTools(
        workspaceId: string,
        toolNames: readonly string[]
    ): Promise<WorkspaceCopilotPolicy> {
        // De-duplicated and sorted so the stored list is canonical — the
        // settings UI round-trips this value, and an unstable order would show
        // up as a spurious diff every time it saves.
        const tools = [...new Set(toolNames)].sort();
        const [row] = await this.db
            .insert(copilotWorkspacePolicies)
            .values({ workspaceId, autoApplyTools: tools })
            .onConflictDoUpdate({
                target: copilotWorkspacePolicies.workspaceId,
                set: { autoApplyTools: tools, updatedAt: new Date() }
            })
            .returning();
        return { autoApplyTools: row.autoApplyTools };
    }
}
