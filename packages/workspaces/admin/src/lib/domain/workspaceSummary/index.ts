import type { Workspace } from '../types/workspace';

/**
 * How many content types a workspace can reach: its own grants plus its
 * shared ones, a type counted once however many sources grant it.
 */
export function contentTypeCount(
    workspace: Pick<Workspace, 'content' | 'sharedContent'>
): number {
    return new Set([
        ...workspace.content,
        ...workspace.sharedContent.map((grant) => grant.slug)
    ]).size;
}

/**
 * The workspace's members split into teammates and invitations still waiting
 * to be accepted — what the "ready" screen counts separately.
 */
export function splitMembers(workspace: Pick<Workspace, 'members'>): {
    active: Workspace['members'];
    pending: Workspace['members'];
} {
    return {
        active: workspace.members.filter((member) => !member.pending),
        pending: workspace.members.filter((member) => member.pending)
    };
}
