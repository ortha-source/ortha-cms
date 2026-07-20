import { useCallback } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { HTTP_STATUS } from '@ortha-cms/utils-admin';
import { toast } from '@ortha-cms/design-system';
import { Email } from '../../domain/value-objects/email';
import type { MemberRole } from '../../domain/types/member';
import { useInviteMember } from '../useInviteMember';

/** Success-toast copy for the invite use case (co-located with the flow). */
const messages = defineMessages({
    sent: {
        id: 'users.invitePage.sent',
        defaultMessage: 'Invite sent to {email}'
    }
});

/** The fields the invite wizard collects, before the final guard + submit. */
export type InviteMemberDraft = {
    /** The invitee's email (trimmed by the flow). */
    email: string;
    /** The global role granted on acceptance. */
    role: MemberRole;
    /** Optional display name (blank becomes omitted). */
    name?: string;
    /** Workspaces to grant access to; `all` is expanded to ids by the caller. */
    workspaceIds: string[];
};

/**
 * Why the last submission failed, as a machine key the page maps to its inline
 * alert copy: `taken` (email already exists — `409`) or `failed` (anything
 * else).
 */
export type InviteErrorReason = 'taken' | 'failed';

/** What {@link useInviteMemberFlow} returns. */
export type InviteMemberFlow = {
    /**
     * Runs the invite use case: guards the email through the {@link Email} value
     * object, POSTs via the invite mutation (cache invalidation), then toasts
     * and navigates to the members list. Rejections are swallowed — the caller
     * reads {@link errorReason} to render the inline alert and let the user
     * retry.
     */
    submit: (draft: InviteMemberDraft) => Promise<void>;
    /** Whether an invite is currently in flight. */
    submitting: boolean;
    /** Why the last submission failed, or `null` when it hasn't. */
    errorReason: InviteErrorReason | null;
};

/**
 * The invite-member use-case hook. Orchestrates the wizard's submission — Email
 * VO validation → invite → toast + navigate — so the invite page stays layout +
 * fields and owns none of the flow. The step's continue gate already blocks a
 * malformed email; the {@link Email} guard here is the last check before the
 * request.
 */
export function useInviteMemberFlow(): InviteMemberFlow {
    const intl = useIntl();
    const navigate = useNavigate();
    const invite = useInviteMember();

    const submit = useCallback(
        async (draft: InviteMemberDraft): Promise<void> => {
            const email = draft.email.trim();
            try {
                // Guard the shape through the domain VO before hitting the API.
                Email.create(email);

                const created = await invite.mutateAsync({
                    email,
                    role: draft.role,
                    name: draft.name?.trim() || undefined,
                    workspaceIds: draft.workspaceIds
                });
                toast.success(
                    intl.formatMessage(messages.sent, { email: created.email })
                );
                navigate('/users');
            } catch {
                // The page's inline alert (via `errorReason`) explains; the user
                // can go back, fix the email, and retry.
            }
        },
        [invite, intl, navigate]
    );

    const errorReason: InviteErrorReason | null = invite.isError
        ? invite.error.status === HTTP_STATUS.CONFLICT
            ? 'taken'
            : 'failed'
        : null;

    return { submit, submitting: invite.isPending, errorReason };
}
