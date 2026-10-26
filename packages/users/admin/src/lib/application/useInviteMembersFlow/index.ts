import { useCallback, useState } from 'react';
import { Email } from '../../domain/value-objects/email';
import type { MemberRole } from '../../domain/types/member';
import { inviteLinkFor } from '../../infrastructure/inviteLink';
import { memberConflictOf } from '../../infrastructure/memberConflict';
import { useInviteMembers } from '../useInviteMembers';

/** What the invite sheet collects before Send. */
export type InviteMembersDraft = {
    /** The addresses, as chips (lower-cased, de-duplicated). */
    emails: string[];
    /** The one role every invitee gets. */
    role: MemberRole;
    /** The workspaces every invitee joins. */
    workspaceIds: string[];
};

/** One invite the batch created, and what the admin now has to hand over. */
export type SentInvite = {
    /** The member's id. */
    id: string;
    /** The invitee's address. */
    email: string;
    /** The invite link, or `null` when a mail provider sent it instead. */
    link: string | null;
    /** When the link stops working, when the server said. */
    expiresAt: Date | null;
};

/** Why the last Send failed: some addresses are members already, or anything else. */
export type InviteMembersError = 'taken' | 'failed';

/** What {@link useInviteMembersFlow} returns. */
export type InviteMembersFlow = {
    /**
     * Sends the batch. Resolves with the created invites, or `null` when the
     * server refused — {@link error} and {@link takenEmails} then say why.
     * Never rejects.
     */
    submit: (draft: InviteMembersDraft) => Promise<SentInvite[] | null>;
    /** Whether a batch is in flight. */
    submitting: boolean;
    /** Why the last Send failed, or `null`. */
    error: InviteMembersError | null;
    /**
     * Addresses the server said already belong to members — the authority the
     * sheet's live check only anticipates (a member could have been added a
     * second ago). Kept until {@link reset}.
     */
    takenEmails: string[];
    /** Clears the error state (a new attempt, or a fresh sheet). */
    reset: () => void;
};

/**
 * The invite sheet's use case: guard every address through the {@link Email}
 * value object, send them as one all-or-nothing batch, and turn the answer
 * into links to hand over. It does not navigate or close anything — with no
 * mailer the response holds the only copy of every link, so the sheet stays
 * open on them until the admin is done.
 */
export function useInviteMembersFlow(): InviteMembersFlow {
    const invite = useInviteMembers();
    const [takenEmails, setTakenEmails] = useState<string[]>([]);
    const [error, setError] = useState<InviteMembersError | null>(null);

    const submit = useCallback(
        async (draft: InviteMembersDraft): Promise<SentInvite[] | null> => {
            setError(null);
            try {
                // The last guard before the request: the sheet already blocks
                // a malformed chip, so this only catches a bug, not a person.
                const emails = draft.emails.map(
                    (email) => Email.create(email).value
                );
                const created = await invite.mutateAsync({
                    emails,
                    role: draft.role,
                    workspaceIds: draft.workspaceIds
                });
                return created.map((member) => ({
                    id: member.id,
                    email: member.email,
                    link: member.inviteToken
                        ? inviteLinkFor(member.inviteToken)
                        : null,
                    expiresAt: member.inviteExpiresAt
                }));
            } catch (caught) {
                const conflict = memberConflictOf(
                    caught as Parameters<typeof memberConflictOf>[0]
                );
                if (conflict?.code === 'EMAIL_TAKEN') {
                    setTakenEmails((previous) => [
                        ...new Set([...previous, ...conflict.emails])
                    ]);
                    setError('taken');
                    return null;
                }
                setError('failed');
                return null;
            }
        },
        [invite]
    );

    const reset = useCallback(() => {
        setError(null);
        setTakenEmails([]);
        invite.reset();
    }, [invite]);

    return {
        submit,
        submitting: invite.isPending,
        error,
        takenEmails,
        reset
    };
}
