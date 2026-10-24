import type { Workspace } from '../../domain/types/workspace';
import type { InviteOutcome, MemberDraft } from '../../domain/types/wizard';
import type { WorkspaceGateway } from '../../infrastructure/workspaceGateway';

/**
 * After a create, issues the invitation of every address the wizard invited
 * that the server provisioned as a **pending** account, one at a time (the
 * users plugin throttles rotations, and a burst gains nothing).
 *
 * The create itself only provisions the account; the invitation — token and,
 * with a mail provider, the email — belongs to the users plugin, so it is a
 * second request. It is best effort: without `users:create` (`canInvite`) or
 * on a failed request the address is reported `pending` and waits in Members,
 * so the workspace is never rolled back over a mail. An address that already
 * had an active account is a member outright and needs no invitation, so it
 * is left out.
 */
export async function issueInvites(
    gateway: Pick<WorkspaceGateway, 'sendInvite'>,
    created: Pick<Workspace, 'members'>,
    drafts: readonly MemberDraft[],
    canInvite: boolean
): Promise<InviteOutcome[]> {
    const invited = new Set(
        drafts
            .filter((draft) => draft.invited)
            .map((draft) => draft.email.trim().toLowerCase())
    );
    const outcomes: InviteOutcome[] = [];
    for (const member of created.members) {
        const email = member.email.trim().toLowerCase();
        if (!member.pending || !invited.has(email)) continue;
        if (!canInvite) {
            outcomes.push({ email, delivery: 'pending' });
            continue;
        }
        try {
            outcomes.push({
                email,
                delivery: await gateway.sendInvite(member.id)
            });
        } catch {
            outcomes.push({ email, delivery: 'pending' });
        }
    }
    return outcomes;
}
