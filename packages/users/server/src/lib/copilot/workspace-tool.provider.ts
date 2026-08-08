import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import type {
    CopilotToolProvider,
    ToolContext,
    ToolSpec
} from '@ortha-cms/copilot-domain';
import { WorkspaceMembersQuery } from '../member/infrastructure/queries/workspace-members.query';

/** Members a single `workspace.members` call may return. */
const MAX_TOOL_PAGE_SIZE = 50;

/**
 * The users plugin's contribution to the copilot's tool catalogue —
 * `workspace.members`.
 *
 * It answers "who can I assign this to?" and "who is on this team?", and it is
 * what turns an `actorEmail` from `activity.recent` or an `authorId` on a
 * revision into a person's name.
 *
 * **Scoped to the run's workspace**, via a purpose-built query rather than the
 * users grid's deployment-wide directory. `users:read` would permit listing
 * every account in the deployment; a workspace-scoped run has no business doing
 * that, and the narrower read is also the more useful answer.
 *
 * Nothing security-relevant is returned — email, name, role and account status,
 * exactly the columns the members page renders for the same permission. No
 * invite tokens, no session data, no password state.
 */
@Injectable()
export class WorkspaceCopilotToolProvider implements CopilotToolProvider {
    constructor(private readonly members: WorkspaceMembersQuery) {}

    /** The one workspace-directory tool. */
    tools(): readonly ToolSpec[] {
        return [this.workspaceMembers()];
    }

    /** `workspace.members` — the people in the current workspace. */
    private workspaceMembers(): ToolSpec {
        return {
            name: 'workspace.members',
            description:
                'List the people who are members of the current workspace, with their email, ' +
                'name, global role (admin / contributor / viewer) and account status. Use it ' +
                'to answer “who is on this workspace?”, to suggest who could take a task, or ' +
                'to put a name to an email or user id you saw in another tool’s result. ' +
                'Covers this workspace only, not every account in the CMS.',
            inputSchema: {
                type: 'object',
                properties: {
                    page: {
                        type: 'integer',
                        minimum: 1,
                        description: '1-based page number.'
                    },
                    pageSize: {
                        type: 'integer',
                        minimum: 1,
                        maximum: MAX_TOOL_PAGE_SIZE,
                        description: `Members per page (max ${MAX_TOOL_PAGE_SIZE}).`
                    }
                },
                additionalProperties: false
            },
            permissions: [PERMISSIONS.USERS_READ],
            effect: 'read',
            run: async (input, ctx: ToolContext) => {
                const args = (input ?? {}) as {
                    page?: number;
                    pageSize?: number;
                };
                // Clamped here as well as declared: the schema validator is
                // defence in depth, not the boundary.
                const pageSize = Math.min(
                    Math.max(args.pageSize ?? 25, 1),
                    MAX_TOOL_PAGE_SIZE
                );
                return this.members.list(
                    ctx.workspaceId,
                    Math.max(args.page ?? 1, 1),
                    pageSize
                );
            }
        };
    }
}
